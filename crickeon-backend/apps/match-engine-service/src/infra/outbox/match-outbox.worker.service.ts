import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxRepository } from '@crickeon/infra-outbox/outbox.repository';
import { OutboxWorker } from '@crickeon/infra-outbox/outbox.worker';
import { MatchRealtimeService } from '../redis/match-realtime.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchOutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: OutboxWorker;

  constructor(
    prisma: PrismaService,
    private readonly realtime: MatchRealtimeService
  ) {
    const repository = new OutboxRepository(prisma);
    this.worker = new OutboxWorker(repository, async (event) => {
      if (event.aggregateType !== 'match') return;
      await this.realtime.publishMatchUpdate(event.aggregateId, event.payload);
      await this.realtime.cacheMatchState(event.aggregateId, event.payload, 20);
    }, { intervalMs: 150, batchSize: 100 });
  }

  onModuleInit() {
    this.worker.start();
  }

  async onModuleDestroy() {
    await this.worker.stop();
  }
}
