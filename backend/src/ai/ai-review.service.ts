import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestUser } from '../common/types/request-user.type';

export type AiKycReview = {
  summary: string;
  missingItems: Array<{ section: string; field: string; reason: string }>;
  inconsistencies: Array<{ subject: string; details: string; severity: 'INFO' | 'REVIEW' }>;
  reviewerQuestions: string[];
  recommendedActions: string[];
};

export type AiAssistantMessage = { role: 'user' | 'assistant'; content: string };
type OpenAiError = { message?: string; code?: string; type?: string };
type OpenAiResponse = { output_text?: string; error?: OpenAiError };

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(private readonly config: ConfigService) {}

  private async requestOpenAi(feature: 'AI review' | 'AI Assistant', request: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch('https://api.openai.com/v1/responses', request);
        if (response.ok || ![502, 503, 504].includes(response.status) || attempt === 2) return response;

        this.logger.warn(`OpenAI ${feature} request received HTTP ${response.status}; retrying (${attempt + 1}/2).`);
      } catch (error) {
        lastError = error;
        if (attempt === 2) throw error;
        this.logger.warn(`OpenAI ${feature} request could not connect; retrying (${attempt + 1}/2).`);
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
    throw lastError || new Error('OpenAI request could not be started.');
  }

  private async readOpenAiResponse(response: Response): Promise<OpenAiResponse> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as OpenAiResponse;
    } catch {
      return { error: { message: `OpenAI returned HTTP ${response.status} with an unreadable response.` } };
    }
  }

  private providerException(feature: 'AI review' | 'AI Assistant', status: number, error?: OpenAiError) {
    const code = error?.code || error?.type || 'no-provider-code';
    this.logger.warn(`OpenAI ${feature} request failed with HTTP ${status} (${code}).`);

    if (status === 429) {
      const isQuotaIssue = error?.code === 'insufficient_quota' || /quota|billing|credit/i.test(error?.message || '');
      return new HttpException(
        isQuotaIssue
          ? 'AI service is unavailable because the configured OpenAI project has no available API credits. Add billing or credits to that OpenAI project, then try again.'
          : 'AI service is temporarily rate-limited. Wait one minute and try again.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (status === 401 || status === 403) {
      return new ServiceUnavailableException('AI service authentication failed. Replace OPENAI_API_KEY in backend/.env with an active key from the correct OpenAI project, then restart the backend.');
    }

    if ([502, 503, 504].includes(status)) {
      return new ServiceUnavailableException('AI service provider is temporarily unavailable. The request was retried automatically. Wait a few minutes and try again.');
    }

    return new BadGatewayException(error?.message || `The ${feature} service could not complete the request.`);
  }

  async reviewKycForm(kycForm: Record<string, unknown>): Promise<AiKycReview> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI review is not configured. Add OPENAI_API_KEY to the backend environment, then restart the backend.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await this.requestOpenAi('AI review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini',
          store: false,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: 'You are a KYC review assistant. Review only the supplied KYC form data and document checklist. Do not make an approval, rejection, risk classification, legal conclusion, or screening decision. Identify missing information, possible inconsistencies, and precise reviewer follow-up questions. Treat all findings as suggestions for a human reviewer.' }]
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: `Review this KYC case data:\n${JSON.stringify(kycForm)}` }]
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'kyc_review',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'missingItems', 'inconsistencies', 'reviewerQuestions', 'recommendedActions'],
                properties: {
                  summary: { type: 'string' },
                  missingItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['section', 'field', 'reason'],
                      properties: { section: { type: 'string' }, field: { type: 'string' }, reason: { type: 'string' } }
                    }
                  },
                  inconsistencies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['subject', 'details', 'severity'],
                      properties: { subject: { type: 'string' }, details: { type: 'string' }, severity: { type: 'string', enum: ['INFO', 'REVIEW'] } }
                    }
                  },
                  reviewerQuestions: { type: 'array', items: { type: 'string' } },
                  recommendedActions: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        })
      });

      const body = await this.readOpenAiResponse(response);
      if (!response.ok) {
        throw this.providerException('AI review', response.status, body.error);
      }
      if (!body.output_text) {
        throw new BadGatewayException('The AI review service returned no review result. Please try again.');
      }
      return JSON.parse(body.output_text) as AiKycReview;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('OpenAI KYC review request timed out.');
        throw new BadGatewayException('The AI review took too long. Please try again.');
      }
      this.logger.error('OpenAI KYC review request failed before a response was received.', error instanceof Error ? error.stack : undefined);
      throw new BadGatewayException('Unable to contact the AI review service. Confirm the API key and server internet connection, then try again.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async answerApplicationQuestion(user: RequestUser, messages: AiAssistantMessage[], currentPath: string) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI Assistant is not configured. Add OPENAI_API_KEY to the backend environment, then restart the backend.');
    }

    const safeMessages = messages
      .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 2000) }))
      .filter((message) => message.content);

    if (!safeMessages.some((message) => message.role === 'user')) {
      throw new BadGatewayException('Enter a question for the AI Assistant.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await this.requestOpenAi('AI Assistant', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini',
          store: false,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: `You are the Newoon MIS in-application assistant. Help users understand only this KYC and Engagement application: enquiries, KYC workflow, Screening, CRRF, reviews, notifications, roles, and navigation. The signed-in user has roles: ${user.roles.join(', ') || 'none'}. They are currently viewing: ${currentPath.slice(0, 200)}. Explain workflow steps in concise, practical language. Do not claim you can see live case data, documents, audit logs, or other users' information. Do not invent application state. Do not give legal, compliance, approval, screening, or risk decisions. Do not request passwords, API keys, or other secrets. You cannot perform actions; direct the user to the relevant screen or authorized reviewer.` }]
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: `Conversation so far:\n${safeMessages.map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`).join('\n\n')}`
              }]
            }
          ]
        })
      });
      const body = await this.readOpenAiResponse(response);
      if (!response.ok) {
        throw this.providerException('AI Assistant', response.status, body.error);
      }
      if (!body.output_text) throw new BadGatewayException('The AI Assistant returned no answer. Please try again.');
      return { message: body.output_text.trim() };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('OpenAI Assistant request timed out.');
        throw new BadGatewayException('The AI Assistant took too long to respond. Please try again.');
      }
      this.logger.error('OpenAI Assistant request failed before a response was received.', error instanceof Error ? error.stack : undefined);
      throw new BadGatewayException('Unable to contact the AI Assistant. Confirm the API key and server internet connection, then try again.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
