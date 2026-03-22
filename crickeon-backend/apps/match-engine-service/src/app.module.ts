import { Module } from '@nestjs/common';
import { MatchController } from './match/match.controller';
import { MatchEngineService } from './match/match.service';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { PrismaService } from './infra/prisma/prisma.service';
import { MatchRepository } from './modules/match/repositories/match.repository';
import { MatchRealtimeService } from './infra/redis/match-realtime.service';
import { MatchOutboxWorkerService } from './infra/outbox/match-outbox.worker.service';

@Module({
  controllers: [MatchController, AiController],
  providers: [MatchEngineService, AiService, PrismaService, MatchRepository, MatchRealtimeService, MatchOutboxWorkerService]
})
export class AppModule {}
