import { Module } from '@nestjs/common';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { PrismaService } from './infra/prisma/prisma.service';
import { CricApiProvider } from './providers/cricket-data/cricapi.provider';
import { SportRadarProvider } from './providers/cricket-data/sportradar.provider';
import { CricketDataSyncService } from './providers/cricket-data/cricket-data-sync.service';
import { AnalyticsService } from './modules/analytics/analytics.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, PrismaService, CricApiProvider, SportRadarProvider, CricketDataSyncService, AnalyticsService]
})
export class AppModule {}
