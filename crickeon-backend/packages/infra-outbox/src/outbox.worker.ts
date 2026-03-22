import type { OutboxRepository } from './outbox.repository';

export type OutboxPublisher = (event: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

export class OutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: OutboxPublisher,
    private readonly options: { intervalMs?: number; batchSize?: number } = {}
  ) {}

  start() {
    if (this.timer) return;
    const intervalMs = this.options.intervalMs ?? 200;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const batch = await this.repository.claimPending(this.options.batchSize ?? 100);
      for (const event of batch) {
        try {
          await this.publisher({
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload
          });
          await this.repository.markProcessed(event.id);
        } catch {
          await this.repository.markPending(event.id);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
