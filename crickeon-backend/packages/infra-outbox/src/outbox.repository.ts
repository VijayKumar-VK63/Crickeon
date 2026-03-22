import type { PrismaClient, Prisma } from '@prisma/client';

export type OutboxRecord = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'processed';
  createdAt: Date;
  attempts: number;
};

export class OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertInTransaction(tx: Prisma.TransactionClient, input: {
    aggregateType: 'auction' | 'match';
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0
      }
    });
  }

  async claimPending(batchSize: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      aggregate_type: string;
      aggregate_id: string;
      event_type: string;
      payload: Prisma.JsonValue;
      status: 'pending' | 'processing' | 'processed';
      created_at: Date;
      attempts: number;
    }>>(
      `
      WITH cte AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events oe
      SET status = 'processing',
          attempts = attempts + 1,
          updated_at = now()
      FROM cte
      WHERE oe.id = cte.id
      RETURNING oe.id, oe.aggregate_type, oe.aggregate_id, oe.event_type, oe.payload, oe.status, oe.created_at, oe.attempts
      `,
      batchSize
    );

    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload as Record<string, unknown>,
      status: row.status,
      createdAt: row.created_at,
      attempts: row.attempts
    }));
  }

  async markProcessed(id: string) {
    await this.prisma.outboxEvent.update({ where: { id }, data: { status: 'processed', processedAt: new Date(), updatedAt: new Date() } });
  }

  async markPending(id: string) {
    await this.prisma.outboxEvent.update({ where: { id }, data: { status: 'pending', updatedAt: new Date() } });
  }
}
