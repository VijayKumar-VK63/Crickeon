import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MatchEngineService } from './match.service';

@Controller()
export class MatchController {
  constructor(private readonly matchEngineService: MatchEngineService) {}

  @Get('health')
  health() {
    return { service: 'match-engine-service', status: 'ok', ts: new Date().toISOString() };
  }

  @Post('match/start')
  startMatch(@Body() dto: { matchId: string; teamAId: string; teamBId: string; tossWinner: string; decision: 'bat' | 'bowl'; seed: number; pitch: 'flat' | 'green' | 'dusty' }) {
    return this.matchEngineService.startMatch(dto);
  }

  @Post('match/toss')
  toss(@Body() dto: { matchId: string; teamA: string; teamB: string; seed: number }) {
    return this.matchEngineService.toss(dto);
  }

  @Post('match/ball')
  ball(@Body() dto: Parameters<MatchEngineService['simulateBall']>[0]) {
    return this.matchEngineService.simulateBall(dto);
  }

  @Post('match/death-over/decision')
  deathOverDecision(@Body() dto: { matchId: string; aggressiveness: number; yorkerPlan: number }) {
    return this.matchEngineService.applyDeathOverDecision(dto);
  }

  @Post('match/super-over/resolve')
  superOver(@Body() dto: { matchId: string; battingSkill: number; bowlingSkill: number; executionScore: number; seed: number }) {
    return this.matchEngineService.resolveSuperOver(dto);
  }

  @Get('match/:matchId/replay')
  replay(@Param('matchId') matchId: string, @Query('fromBall') fromBall?: string, @Query('toBall') toBall?: string) {
    return this.matchEngineService.replay(matchId, Number(fromBall ?? 0), toBall ? Number(toBall) : undefined);
  }

  @Get('match/:matchId/snapshot/:over')
  snapshot(@Param('matchId') matchId: string, @Param('over') over: string) {
    return this.matchEngineService.snapshot(matchId, Number(over));
  }
}
