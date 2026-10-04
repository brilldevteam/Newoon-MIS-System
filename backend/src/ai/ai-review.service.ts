import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiKycReview = {
  summary: string;
  missingItems: Array<{ section: string; field: string; reason: string }>;
  inconsistencies: Array<{ subject: string; details: string; severity: 'INFO' | 'REVIEW' }>;
  reviewerQuestions: string[];
  recommendedActions: string[];
};

@Injectable()
export class AiReviewService {
  constructor(private readonly config: ConfigService) {}

  async reviewKycForm(kycForm: Record<string, unknown>): Promise<AiKycReview> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI review is not configured. Add OPENAI_API_KEY to the backend environment, then restart the backend.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
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

      const body = await response.json() as { output_text?: string; error?: { message?: string } };
      if (!response.ok) {
        throw new BadGatewayException(body.error?.message || 'The AI review service could not complete the request.');
      }
      if (!body.output_text) {
        throw new BadGatewayException('The AI review service returned no review result. Please try again.');
      }
      return JSON.parse(body.output_text) as AiKycReview;
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException('The AI review took too long. Please try again.');
      }
      throw new BadGatewayException('Unable to contact the AI review service. Confirm the API key and server internet connection, then try again.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
