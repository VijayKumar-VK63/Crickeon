import { Injectable } from '@nestjs/common';

type TeamStanding = {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  runsFor: number;
  oversFaced: number;
  runsAgainst: number;
  oversBowled: number;
};

@Injectable()
export class TournamentService {
  scheduleRoundRobin(teamIds: string[]) {
    const fixtures: Array<{ home: string; away: string; round: number }> = [];
    for (let i = 0; i < teamIds.length; i += 1) {
      for (let j = i + 1; j < teamIds.length; j += 1) {
        fixtures.push({ home: teamIds[i], away: teamIds[j], round: fixtures.length + 1 });
      }
    }
    return fixtures;
  }

  standings(results: Array<{ teamA: string; teamB: string; scoreA: number; oversA: number; scoreB: number; oversB: number }>) {
    const table = new Map<string, TeamStanding>();

    const ensure = (teamId: string) => {
      const existing = table.get(teamId);
      if (existing) return existing;
      const created: TeamStanding = {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        runsFor: 0,
        oversFaced: 0,
        runsAgainst: 0,
        oversBowled: 0
      };
      table.set(teamId, created);
      return created;
    };

    for (const result of results) {
      const a = ensure(result.teamA);
      const b = ensure(result.teamB);

      a.played += 1;
      b.played += 1;
      a.runsFor += result.scoreA;
      a.oversFaced += result.oversA;
      a.runsAgainst += result.scoreB;
      a.oversBowled += result.oversB;
      b.runsFor += result.scoreB;
      b.oversFaced += result.oversB;
      b.runsAgainst += result.scoreA;
      b.oversBowled += result.oversA;

      if (result.scoreA > result.scoreB) {
        a.won += 1;
        b.lost += 1;
        a.points += 2;
      } else {
        b.won += 1;
        a.lost += 1;
        b.points += 2;
      }
    }

    return Array.from(table.values())
      .map((s) => ({
        ...s,
        nrr: Number((s.runsFor / Math.max(1, s.oversFaced) - s.runsAgainst / Math.max(1, s.oversBowled)).toFixed(3))
      }))
      .sort((x, y) => y.points - x.points || y.nrr - x.nrr);
  }

  playoffBracket(sortedTeamIds: string[]) {
    return {
      qualifier1: { teamA: sortedTeamIds[0], teamB: sortedTeamIds[1] },
      eliminator: { teamA: sortedTeamIds[2], teamB: sortedTeamIds[3] }
    };
  }

  updateElo(input: { ratingA: number; ratingB: number; scoreA: 0 | 0.5 | 1; kFactor?: number }) {
    const k = input.kFactor ?? 24;
    const expectedA = 1 / (1 + 10 ** ((input.ratingB - input.ratingA) / 400));
    const expectedB = 1 - expectedA;
    const scoreB = (1 - input.scoreA) as 0 | 0.5 | 1;
    const newA = Math.round(input.ratingA + k * (input.scoreA - expectedA));
    const newB = Math.round(input.ratingB + k * (scoreB - expectedB));
    return { ratingA: newA, ratingB: newB };
  }

  antiCheatCheck(input: { bidsPerMinute: number; invalidActions: number; repeatedLatencySpikes: number }) {
    const score = input.bidsPerMinute * 0.35 + input.invalidActions * 0.45 + input.repeatedLatencySpikes * 0.2;
    if (score >= 8) return { flagged: true, severity: 'high', score };
    if (score >= 5) return { flagged: true, severity: 'medium', score };
    return { flagged: false, severity: 'low', score };
  }
}
