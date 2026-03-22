import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MatchBallEvent } from '@crickeon/shared-contracts';
import { StatsService } from './stats.service';
import { AnalyticsService } from '../modules/analytics/analytics.service';
import { CricketDataSyncService } from '../providers/cricket-data/cricket-data-sync.service';
import { TopPlayersQueryDto, TrackAnalyticsEventDto } from './stats.dto';

@Controller()
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly analyticsService: AnalyticsService,
    private readonly cricketDataSyncService: CricketDataSyncService
  ) {}

  @Get('health')
  health() {
    return { service: 'stats-service', status: 'ok', ts: new Date().toISOString() };
  }

  @Post('stats/ingest')
  ingest(@Body() event: MatchBallEvent) {
    return this.statsService.ingest(event);
  }

  @Get('stats/scorecard/:matchId')
  scorecard(@Param('matchId') matchId: string) {
    return this.statsService.scorecard(matchId);
  }

  @Post('stats/analytics/event')
  trackAnalytics(@Body() dto: TrackAnalyticsEventDto) {
    return this.analyticsService.trackEvent(dto);
  }

  @Get('stats/dashboard/top-players')
  topPlayers(@Query() query: TopPlayersQueryDto) {
    return this.analyticsService.dashboardTopPlayers(query.limit ?? 10);
  }

  @Get('stats/dashboard/win-rates')
  winRates() {
    return this.analyticsService.dashboardWinRates();
  }

  @Get('stats/dashboard/roi')
  roi() {
    return this.analyticsService.dashboardRoiPerPlayer();
  }

  @Get('stats/dashboard/retention')
  retention() {
    return this.analyticsService.retentionMetrics(30);
  }

  @Post('stats/real/sync')
  syncRealData() {
    return this.cricketDataSyncService.syncNow();
  }

  @Get('stats/real/matches')
  liveMatches() {
    return this.cricketDataSyncService.getLiveMatchesCached();
  }

  @Get('stats/real/player/:playerId/boost')
  playerBoost(@Param('playerId') playerId: string) {
    return this.cricketDataSyncService.getPlayerBoost(playerId);
  }
}
