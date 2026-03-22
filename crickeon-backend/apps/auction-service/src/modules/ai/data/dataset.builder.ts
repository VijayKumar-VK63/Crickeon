import { Injectable } from '@nestjs/common';
import { PlayerRole } from '@crickeon/shared-contracts';
import { PrismaService } from '../../../infra/prisma/prisma.service';

export type DatasetRow = {
  playerId: string;
  role: PlayerRole;
  features: {
    battingAvg: number;
    strikeRate: number;
    bowlingAvg: number;
    economy: number;
    recentForm: number;
    roleScarcity: number;
    matchupStrength: number;
    teamWinRate: number;
    recentEventImpact: number;
  };
  label: number;
};

export type BuiltDataset = {
  generatedAt: string;
  size: number;
  featureOrder: string[];
  rows: DatasetRow[];
};

@Injectable()
export class DatasetBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async buildTrainingDataset(limit = 500): Promise<BuiltDataset> {
    const players = await this.prisma.player.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        battingAvg: true,
        strikeRate: true,
        bowlingAvg: true,
        economy: true,
        formIndex: true
      }
    });

    if (!players.length) {
      return {
        generatedAt: new Date().toISOString(),
        size: 0,
        featureOrder: [
          'battingAvg',
          'strikeRate',
          'bowlingAvg',
          'economy',
          'recentForm',
          'roleScarcity',
          'matchupStrength',
          'teamWinRate',
          'recentEventImpact'
        ],
        rows: []
      };
    }

    const playerIds = players.map((player) => player.id);
    const [batsmanEvents, bowlerEvents, matchups, teamPlayers] = await Promise.all([
      this.prisma.ballEvent.findMany({
        where: { batsmanId: { in: playerIds } },
        select: { batsmanId: true, runs: true, eventType: true }
      }),
      this.prisma.ballEvent.findMany({
        where: { bowlerId: { in: playerIds } },
        select: { bowlerId: true, runs: true, eventType: true }
      }),
      this.prisma.playerMatchup.findMany({
        where: { OR: [{ batsmanId: { in: playerIds } }, { bowlerId: { in: playerIds } }] },
        select: { batsmanId: true, bowlerId: true, runsScored: true, ballsFaced: true, dismissals: true }
      }),
      this.prisma.teamPlayer.findMany({
        where: { cricketPlayerId: { in: playerIds } },
        select: {
          cricketPlayerId: true,
          team: {
            select: {
              id: true,
              matchesTeamA: { where: { status: 'completed' }, select: { winnerTeamId: true, teamAId: true } },
              matchesTeamB: { where: { status: 'completed' }, select: { winnerTeamId: true, teamBId: true } }
            }
          }
        }
      })
    ]);

    const roleCounts = players.reduce<Record<PlayerRole, number>>(
      (acc, player) => {
        const role = player.role as PlayerRole;
        acc[role] = (acc[role] ?? 0) + 1;
        return acc;
      },
      {
        [PlayerRole.BATSMAN]: 0,
        [PlayerRole.BOWLER]: 0,
        [PlayerRole.ALL_ROUNDER]: 0,
        [PlayerRole.WICKET_KEEPER]: 0
      }
    );

    const eventMap = new Map<string, { battingRuns: number; battingBalls: number; wicketsTaken: number; bowlingRunsConceded: number; bowlingBalls: number }>();

    for (const event of batsmanEvents) {
      if (!event.batsmanId) continue;
      const current = eventMap.get(event.batsmanId) ?? { battingRuns: 0, battingBalls: 0, wicketsTaken: 0, bowlingRunsConceded: 0, bowlingBalls: 0 };
      current.battingRuns += event.runs;
      current.battingBalls += 1;
      eventMap.set(event.batsmanId, current);
    }

    for (const event of bowlerEvents) {
      if (!event.bowlerId) continue;
      const current = eventMap.get(event.bowlerId) ?? { battingRuns: 0, battingBalls: 0, wicketsTaken: 0, bowlingRunsConceded: 0, bowlingBalls: 0 };
      current.bowlingRunsConceded += event.runs;
      current.bowlingBalls += 1;
      if (event.eventType.toLowerCase().includes('wicket')) current.wicketsTaken += 1;
      eventMap.set(event.bowlerId, current);
    }

    const matchupMap = new Map<string, number[]>();
    for (const row of matchups) {
      const batsmanScore = this.clamp01(0.45 + row.runsScored / Math.max(1, row.ballsFaced) * 0.4 - row.dismissals / Math.max(1, row.ballsFaced) * 0.8);
      const bowlerScore = this.clamp01(0.5 + row.dismissals / Math.max(1, row.ballsFaced) * 0.7 - row.runsScored / Math.max(1, row.ballsFaced) * 0.35);

      matchupMap.set(row.batsmanId, [...(matchupMap.get(row.batsmanId) ?? []), batsmanScore]);
      matchupMap.set(row.bowlerId, [...(matchupMap.get(row.bowlerId) ?? []), bowlerScore]);
    }

    const winRateMap = new Map<string, number>();
    for (const teamPlayer of teamPlayers) {
      const matches = [...teamPlayer.team.matchesTeamA, ...teamPlayer.team.matchesTeamB];
      if (!matches.length) {
        winRateMap.set(teamPlayer.cricketPlayerId, 0.5);
        continue;
      }

      const wins = matches.filter((match) => match.winnerTeamId === teamPlayer.team.id).length;
      winRateMap.set(teamPlayer.cricketPlayerId, wins / matches.length);
    }

    const rows: DatasetRow[] = players.map((player) => {
      const role = player.role as PlayerRole;
      const events = eventMap.get(player.id) ?? { battingRuns: 0, battingBalls: 0, wicketsTaken: 0, bowlingRunsConceded: 0, bowlingBalls: 0 };
      const matchupScores = matchupMap.get(player.id) ?? [0.5];
      const matchupStrength = matchupScores.reduce((sum, value) => sum + value, 0) / matchupScores.length;
      const teamWinRate = winRateMap.get(player.id) ?? 0.5;

      const battingImpact = this.clamp01((events.battingRuns / Math.max(1, events.battingBalls)) / 2.2);
      const bowlingImpact = this.clamp01(events.wicketsTaken / Math.max(1, events.bowlingBalls / 6));
      const economyImpact = this.clamp01(1 - (events.bowlingRunsConceded / Math.max(1, events.bowlingBalls / 6)) / 12);
      const recentEventImpact = this.clamp01(battingImpact * 0.45 + bowlingImpact * 0.35 + economyImpact * 0.2);

      const rolePool = roleCounts[role] || 1;
      const roleScarcity = this.clamp01(1 - rolePool / players.length + 0.15);

      const label = this.clamp01(
        this.normalizeLinear(Number(player.battingAvg), 10, 70) * 0.2 +
          this.normalizeLinear(Number(player.strikeRate), 80, 220) * 0.15 +
          this.normalizeInverse(Number(player.bowlingAvg), 15, 60) * 0.15 +
          this.normalizeInverse(Number(player.economy), 4, 12) * 0.1 +
          this.normalizeLinear(Number(player.formIndex), 0.4, 1.8) * 0.15 +
          roleScarcity * 0.05 +
          matchupStrength * 0.1 +
          teamWinRate * 0.05 +
          recentEventImpact * 0.05
      );

      return {
        playerId: player.id,
        role,
        features: {
          battingAvg: Number(player.battingAvg),
          strikeRate: Number(player.strikeRate),
          bowlingAvg: Number(player.bowlingAvg),
          economy: Number(player.economy),
          recentForm: Number(player.formIndex),
          roleScarcity: Number(roleScarcity.toFixed(3)),
          matchupStrength: Number(matchupStrength.toFixed(3)),
          teamWinRate: Number(teamWinRate.toFixed(3)),
          recentEventImpact: Number(recentEventImpact.toFixed(3))
        },
        label: Number(label.toFixed(4))
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      size: rows.length,
      featureOrder: [
        'battingAvg',
        'strikeRate',
        'bowlingAvg',
        'economy',
        'recentForm',
        'roleScarcity',
        'matchupStrength',
        'teamWinRate',
        'recentEventImpact'
      ],
      rows
    };
  }

  private normalizeLinear(value: number, min: number, max: number) {
    if (max <= min) return 0;
    return this.clamp01((value - min) / (max - min));
  }

  private normalizeInverse(value: number, min: number, max: number) {
    if (max <= min) return 0;
    return this.clamp01((max - value) / (max - min));
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }
}
