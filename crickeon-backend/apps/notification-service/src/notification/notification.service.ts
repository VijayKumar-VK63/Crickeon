import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendEmail(input: { to: string; subject: string; html: string }) {
    const webhook = process.env.EMAIL_WEBHOOK_URL;
    if (!webhook) {
      this.logger.warn('EMAIL_WEBHOOK_URL not configured; email delivery skipped.');
      return { delivered: false, channel: 'email', reason: 'webhook_not_configured' };
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });

    return { delivered: response.ok, channel: 'email', status: response.status };
  }

  async sendPush(input: { userId: string; title: string; body: string }) {
    const webhook = process.env.PUSH_WEBHOOK_URL;
    if (!webhook) {
      this.logger.warn('PUSH_WEBHOOK_URL not configured; push delivery skipped.');
      return { delivered: false, channel: 'push', reason: 'webhook_not_configured' };
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });

    return { delivered: response.ok, channel: 'push', status: response.status };
  }
}
