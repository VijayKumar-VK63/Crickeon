import { Injectable } from '@nestjs/common';
import { MatchBallEvent } from '@crickeon/shared-contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CricketDataSyncService } from '../providers/cricket-data/cricket-data-sync.service';
import { AnalyticsService } from '../modules/analytics/analytics.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cricketDataSync: CricketDataSyncService,
    private readonly analytics: AnalyticsService
  ) {}

  async ingest(event: MatchBallEvent) {
    const metadata = {
      seed: event.seed,
      source: 'stats-service-ingest'
    };

    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.ballEvent.findFirst({ where: { matchId: event.matchId }, orderBy: { streamVersion: 'desc' } });
      const nextStreamVersion = (latest?.streamVersion ?? 0) + 1;

      await tx.ballEvent.create({
        data: {
          matchId: event.matchId,
          streamVersion: nextStreamVersion,
          innings: event.innings,
          over: event.over,
          ball: event.ball,
          runs: event.runs,
          eventType: event.wicket ? 'wicket' : 'run',
          batsmanId: event.batsmanId,
          bowlerId: event.bowlerId,
          commentary: event.commentary,
          metadata
        }
      });

      await tx.analyticsEvent.create({
        data: {
          eventType: 'match_ball_ingested',
          entityType: 'match',
          entityId: event.matchId,
          payload: event as unknown as Prisma.InputJsonValue
        }
      });
    });

    const totalEvents = await this.prisma.ballEvent.count({ where: { matchId: event.matchId } });
    return { accepted: true, totalEvents };
  }

  async scorecard(matchId: string) {
    const events = await this.prisma.ballEvent.findMany({ where: { matchId }, orderBy: [{ over: 'asc' }, { ball: 'asc' }] });
    const runs = events.reduce((sum, e) => sum + e.runs, 0);
    const wickets = events.filter((e) => e.eventType === 'wicket').length;
    const balls = events.length;

    const lastBatsman = events[events.length - 1]?.batsmanId;
    const boost = lastBatsman ? await this.cricketDataSync.getPlayerBoost(lastBatsman) : null;

    await this.analytics.trackEvent({
      eventType: 'scorecard_viewed',
      entityType: 'match',
      entityId: matchId,
      payload: { runs, wickets, balls }
    });

    return {
      matchId,
      runs,
      wickets,
      overs: `${Math.floor(balls / 6)}.${balls % 6}`,
      commentary: events.slice(-12).map((e) => e.commentary),
      realWorldBoost: boost
    };
  }
}
