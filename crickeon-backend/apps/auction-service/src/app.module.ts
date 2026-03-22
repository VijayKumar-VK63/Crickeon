import { Module } from '@nestjs/common';
import { AuctionController } from './auction/auction.controller';
import { AuctionService } from './auction/auction.service';
import { PrismaService } from './infra/prisma/prisma.service';
import { AuctionRepository } from './modules/auction/repositories/auction.repository';
import { AuctionRealtimeService } from './infra/redis/auction-realtime.service';
import { AuctionLockService } from './infra/locks/auction-lock.service';
import { AuctionOutboxWorkerService } from './infra/outbox/auction-outbox.worker.service';
import { PlayerValuationService } from './modules/ai/valuation/player-valuation.service';
import { DatasetBuilder } from './modules/ai/data/dataset.builder';
import { BiddingStrategyService } from './modules/ai/strategy/bidding-strategy.service';
import { MonetizationService } from './modules/monetization/monetization.service';
import { GrowthService } from './modules/growth/growth.service';

@Module({
  controllers: [AuctionController],
  providers: [
    AuctionService,
    PrismaService,
    AuctionRepository,
    AuctionRealtimeService,
    AuctionLockService,
    AuctionOutboxWorkerService,
    PlayerValuationService,
    DatasetBuilder,
    BiddingStrategyService,
    MonetizationService,
    GrowthService
  ]
})
export class AppModule {}
