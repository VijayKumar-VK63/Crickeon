import { Body, Controller, Get, Post } from '@nestjs/common';
import { TournamentService } from './tournament.service';

@Controller()
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get('health')
  health() {
    return { service: 'tournament-service', status: 'ok', ts: new Date().toISOString() };
  }

  @Post('tournaments/schedule')
  schedule(@Body() dto: { teamIds: string[] }) {
    return this.tournamentService.scheduleRoundRobin(dto.teamIds);
  }

  @Post('tournaments/standings')
  standings(@Body() dto: { results: Array<{ teamA: string; teamB: string; scoreA: number; oversA: number; scoreB: number; oversB: number }> }) {
    return this.tournamentService.standings(dto.results);
  }

  @Post('tournaments/playoffs')
  playoffs(@Body() dto: { sortedTeamIds: string[] }) {
    return this.tournamentService.playoffBracket(dto.sortedTeamIds);
  }

  @Post('tournaments/elo')
  elo(@Body() dto: { ratingA: number; ratingB: number; scoreA: 0 | 0.5 | 1; kFactor?: number }) {
    return this.tournamentService.updateElo(dto);
  }

  @Post('tournaments/anti-cheat')
  antiCheat(@Body() dto: { bidsPerMinute: number; invalidActions: number; repeatedLatencySpikes: number }) {
    return this.tournamentService.antiCheatCheck(dto);
  }
}
