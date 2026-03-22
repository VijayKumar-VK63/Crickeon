import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(input: {
    userId?: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    payload: Record<string, unknown>;
  }) {
    const event = await this.prisma.analyticsEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload as Prisma.InputJsonValue
      }
    });

    return { accepted: true, id: Number(event.id), createdAt: event.createdAt.toISOString() };
  }

  async dashboardTopPlayers(limit = 10) {
    const rows = await this.prisma.$queryRaw<Array<{ player_id: string; appearances: bigint; avg_price: string; total_wins: bigint }>>`
      SELECT
        tp.cricket_player_id AS player_id,
        COUNT(*)::bigint AS appearances,
        AVG(tp.acquired_price)::text AS avg_price,
        SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::bigint AS total_wins
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      LEFT JOIN matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
      GROUP BY tp.cricket_player_id
      ORDER BY appearances DESC, total_wins DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      playerId: row.player_id,
      appearances: Number(row.appearances),
      averageAuctionPrice: Number(row.avg_price),
      winsInSquad: Number(row.total_wins)
    }));
  }

  async dashboardWinRates() {
    const rows = await this.prisma.$queryRaw<Array<{ team_id: string; played: bigint; won: bigint }>>`
      SELECT
        t.id AS team_id,
        COUNT(m.id)::bigint AS played,
        SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::bigint AS won
      FROM teams t
      LEFT JOIN matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
      GROUP BY t.id
    `;

    return rows.map((row) => ({
      teamId: row.team_id,
      played: Number(row.played),
      won: Number(row.won),
      winRate: Number((Number(row.won) / Math.max(1, Number(row.played))).toFixed(3))
    }));
  }

  async dashboardRoiPerPlayer() {
    const rows = await this.prisma.$queryRaw<Array<{ player_id: string; avg_price: string; wins: bigint; matches: bigint }>>`
      SELECT
        tp.cricket_player_id AS player_id,
        AVG(tp.acquired_price)::text AS avg_price,
        SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::bigint AS wins,
        COUNT(m.id)::bigint AS matches
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      LEFT JOIN matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
      GROUP BY tp.cricket_player_id
    `;

    return rows.map((row) => {
      const avgPrice = Number(row.avg_price);
      const winRate = Number(row.wins) / Math.max(1, Number(row.matches));
      const roi = Number(((winRate * 100) / Math.max(1, avgPrice / 100000)).toFixed(3));
      return {
        playerId: row.player_id,
        averagePrice: avgPrice,
        winRate: Number(winRate.toFixed(3)),
        roiIndex: roi
      };
    });
  }

  async retentionMetrics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await this.prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since }, userId: { not: null } },
      _count: { _all: true }
    });

    const activeUsers = events.length;
    const highlyActive = events.filter((event) => event._count._all >= 20).length;

    return {
      windowDays: days,
      activeUsers,
      highlyActiveUsers: highlyActive,
      retentionProxy: Number((highlyActive / Math.max(1, activeUsers)).toFixed(3))
    };
  }
}
