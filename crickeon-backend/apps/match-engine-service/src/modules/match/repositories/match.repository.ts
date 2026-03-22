import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, MatchStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BallEventAppendInput, CreateMatchInput, IMatchRepository } from './match.repository.interface';
import { OutboxRepository } from '@crickeon/infra-outbox/outbox.repository';

@Injectable()
export class MatchRepository implements IMatchRepository {
  private readonly outboxRepository: OutboxRepository;

  constructor(private readonly prisma: PrismaService) {
    this.outboxRepository = new OutboxRepository(prisma);
  }

  async createMatch(input: CreateMatchInput) {
    const match = await this.prisma.$transaction(async (tx) => {
      await this.ensureTeam(tx, input.teamAId);
      await this.ensureTeam(tx, input.teamBId);

      return tx.match.upsert({
        where: { id: input.matchId },
        create: {
          id: input.matchId,
          teamAId: input.teamAId,
          teamBId: input.teamBId,
          tossWinnerTeamId: input.tossWinnerTeamId,
          tossDecision: input.tossDecision,
          pitchType: input.pitchType,
          seed: input.seed,
          status: MatchStatus.live,
          startedAt: new Date()
        },
        update: {
          tossWinnerTeamId: input.tossWinnerTeamId,
          tossDecision: input.tossDecision,
          pitchType: input.pitchType,
          seed: input.seed,
          status: MatchStatus.live,
          startedAt: new Date()
        }
      });
    });

    return { id: match.id, status: match.status, seed: match.seed };
  }

  async appendBallEvent(input: BallEventAppendInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM matches WHERE id = $1 FOR UPDATE', input.matchId);
      const latest = await tx.ballEvent.findFirst({
        where: { matchId: input.matchId },
        orderBy: { streamVersion: 'desc' }
      });
      const streamVersion = (latest?.streamVersion ?? 0) + 1;

      const event = await tx.ballEvent.create({
        data: {
          matchId: input.matchId,
          streamVersion,
          innings: input.innings,
          over: input.over,
          ball: input.ball,
          runs: input.runs,
          eventType: input.eventType,
          batsmanId: input.batsmanId,
          bowlerId: input.bowlerId,
          commentary: input.commentary,
          metadata: input.metadata as Prisma.InputJsonValue
        }
      });

      await this.outboxRepository.insertInTransaction(tx, {
        aggregateType: 'match',
        aggregateId: input.matchId,
        eventType: 'MatchBallDelivered',
        payload: {
          type: 'score_update',
          matchId: input.matchId,
          innings: input.innings,
          over: input.over,
          ball: input.ball,
          runs: input.runs,
          eventType: input.eventType,
          commentary: input.commentary,
          metadata: input.metadata,
          occurredAt: event.createdAt.toISOString()
        }
      });

      return { streamVersion, occurredAt: event.createdAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getMatchState(matchId: string) {
    const events = await this.prisma.ballEvent.findMany({ where: { matchId }, orderBy: { streamVersion: 'asc' } });
    const runs = events.reduce((sum, event) => sum + event.runs, 0);
    const wickets = events.filter((event) => event.eventType === 'wicket').length;
    const balls = events.length;
    return {
      matchId,
      runs,
      wickets,
      balls,
      overs: `${Math.floor(balls / 6)}.${balls % 6}`,
      events: events.length
    };
  }

  async replayMatch(matchId: string, fromBall: number, toBall?: number) {
    const events = await this.prisma.ballEvent.findMany({
      where: { matchId },
      orderBy: { streamVersion: 'asc' }
    });

    const chunk = events.slice(fromBall, toBall ?? events.length).map((event) => ({
      innings: event.innings,
      over: event.over,
      ball: event.ball,
      runs: event.runs,
      eventType: event.eventType,
      commentary: event.commentary,
      metadata: event.metadata as Record<string, unknown>,
      occurredAt: event.createdAt.toISOString()
    }));

    return {
      matchId,
      fromBall,
      toBall: toBall ?? events.length,
      totalBalls: events.length,
      events: chunk
    };
  }

  async getMatchMeta(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return null;
    return {
      matchId: match.id,
      pitchType: match.pitchType as 'flat' | 'green' | 'dusty',
      seed: match.seed
    };
  }

  async getPlayerMatchup(batsmanId: string, bowlerId: string) {
    const matchup = await this.prisma.playerMatchup.findUnique({
      where: { batsmanId_bowlerId: { batsmanId, bowlerId } }
    });
    if (!matchup) return null;
    return {
      batsmanId: matchup.batsmanId,
      bowlerId: matchup.bowlerId,
      runsScored: matchup.runsScored,
      ballsFaced: matchup.ballsFaced,
      dismissals: matchup.dismissals
    };
  }

  async upsertPlayerMatchup(input: { batsmanId: string; bowlerId: string; runs: number; wicket: boolean }) {
    await this.ensurePlayer(input.batsmanId);
    await this.ensurePlayer(input.bowlerId);

    const matchup = await this.prisma.playerMatchup.upsert({
      where: { batsmanId_bowlerId: { batsmanId: input.batsmanId, bowlerId: input.bowlerId } },
      create: {
        batsmanId: input.batsmanId,
        bowlerId: input.bowlerId,
        runsScored: input.runs,
        ballsFaced: 1,
        dismissals: input.wicket ? 1 : 0
      },
      update: {
        runsScored: { increment: input.runs },
        ballsFaced: { increment: 1 },
        dismissals: { increment: input.wicket ? 1 : 0 }
      }
    });

    return {
      batsmanId: matchup.batsmanId,
      bowlerId: matchup.bowlerId,
      runsScored: matchup.runsScored,
      ballsFaced: matchup.ballsFaced,
      dismissals: matchup.dismissals
    };
  }

  private async ensureTeam(tx: Prisma.TransactionClient, teamId: string) {
    const existing = await tx.team.findUnique({ where: { id: teamId } });
    if (existing) return existing;

    const ownerId = randomUUID();
    const roomId = randomUUID();

    await tx.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@lamcl.local`,
        passwordHash: 'system-generated',
        displayName: `AutoOwner-${ownerId.slice(0, 6)}`,
        role: 'player'
      }
    });

    await tx.room.create({
      data: {
        id: roomId,
        code: `AUTO${roomId.slice(0, 4).toUpperCase()}`,
        hostUserId: ownerId,
        state: 'match',
        minPlayers: 4,
        maxPlayers: 10
      }
    });

    return tx.team.create({
      data: {
        id: teamId,
        roomId,
        ownerUserId: ownerId,
        name: `AutoTeam-${teamId.slice(0, 6)}`,
        budgetTotal: BigInt(10_000_000),
        budgetRemaining: BigInt(10_000_000),
        chemistryScore: new Prisma.Decimal(0)
      }
    });
  }

  private async ensurePlayer(playerId: string) {
    await this.prisma.player.upsert({
      where: { id: playerId },
      update: {},
      create: {
        id: playerId,
        externalRef: playerId,
        fullName: `AutoPlayer-${playerId.slice(0, 6)}`,
        country: 'NA',
        role: 'batsman',
        battingAvg: new Prisma.Decimal(30),
        strikeRate: new Prisma.Decimal(100),
        bowlingAvg: new Prisma.Decimal(30),
        economy: new Prisma.Decimal(7),
        fieldingRate: new Prisma.Decimal(6),
        formIndex: new Prisma.Decimal(1)
      }
    });
  }
}
