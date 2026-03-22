import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxRepository } from '@crickeon/infra-outbox/outbox.repository';
import { OutboxWorker } from '@crickeon/infra-outbox/outbox.worker';
import { AuctionRealtimeService } from '../redis/auction-realtime.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuctionOutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: OutboxWorker;

  constructor(
    prisma: PrismaService,
    private readonly realtime: AuctionRealtimeService
  ) {
    const repository = new OutboxRepository(prisma);
    this.worker = new OutboxWorker(repository, async (event) => {
      if (event.aggregateType !== 'auction') return;
      const roomId = String(event.payload.roomId ?? '');
      if (!roomId) return;
      await this.realtime.publishBidUpdated(roomId, event.payload);
      if (typeof event.payload.remainingMs === 'number') {
        await this.realtime.cacheAuctionTimer(event.aggregateId, Number(event.payload.remainingMs));
        await this.realtime.publishAuctionTimer(roomId, {
          auctionId: event.aggregateId,
          remainingMs: event.payload.remainingMs
        });
      }
    }, { intervalMs: 150, batchSize: 100 });
  }

  onModuleInit() {
    this.worker.start();
  }

  async onModuleDestroy() {
    await this.worker.stop();
  }
}
