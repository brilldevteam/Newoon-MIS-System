import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Sends sign-in codes through the SMTP account configured in backend/.env (see .env.example).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('MAIL_FROM'));
  }

  async sendLoginCode(to: string, firstName: string, code: string, minutes: number) {
    const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
    const text = [
      greeting,
      '',
      `Your Newoon MIS sign-in code is ${code}.`,
      `It expires in ${minutes} minutes and can be used once.`,
      '',
      'If you did not try to sign in, do not share this code and inform your administrator.'
    ].join('\n');
    const html = `<p>${escapeHtml(greeting)}</p>
<p>Your Newoon MIS sign-in code is:</p>
<p style="font-size:24px;font-weight:700;letter-spacing:6px;font-family:Arial,sans-serif">${escapeHtml(code)}</p>
<p>It expires in ${minutes} minutes and can be used once.</p>
<p style="color:#64748b">If you did not try to sign in, do not share this code and inform your administrator.</p>`;

    await this.transport().sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to,
      subject: `Your Newoon MIS sign-in code: ${code}`,
      text,
      html
    });
    this.logger.log(`Sign-in code emailed to ${maskEmail(to)}`);
  }

  private transport() {
    if (!this.transporter) {
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        // Port 465 uses TLS from the start; other ports upgrade with STARTTLS.
        secure: (this.config.get<string>('SMTP_SECURE') || String(port === 465)) === 'true',
        auth: user ? { user, pass: this.config.get<string>('SMTP_PASSWORD') } : undefined,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });
    }
    return this.transporter;
  }
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
