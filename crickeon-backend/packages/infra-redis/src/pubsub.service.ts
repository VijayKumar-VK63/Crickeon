import Redis from 'ioredis';

export class PubSubService {
  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis
  ) {}

  async publish(channel: string, payload: Record<string, unknown>) {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(channel: string, handler: (payload: Record<string, unknown>) => Promise<void> | void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (incomingChannel, rawPayload) => {
      if (incomingChannel !== channel) return;
      try {
        const payload = JSON.parse(rawPayload) as Record<string, unknown>;
        void handler(payload);
      } catch {
        return;
      }
    });
  }
}
