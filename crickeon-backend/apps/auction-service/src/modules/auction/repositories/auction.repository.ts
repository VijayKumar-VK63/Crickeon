import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlayerRole, RoomState } from '@crickeon/shared-contracts';
import { Prisma, Room } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { OutboxRepository } from '@crickeon/infra-outbox/outbox.repository';
import { AuctionLockedState, IAuctionRepository, PlaceBidInput, PlaceBidResult } from './auction.repository.interface';

@Injectable()
export class AuctionRepository implements IAuctionRepository {
  private static readonly DEFAULT_BUDGET = 10_000_000;
  private readonly outboxRepository: OutboxRepository;

  constructor(private readonly prisma: PrismaService) {
    this.outboxRepository = new OutboxRepository(prisma);
  }

  async getAuctionWithLock(auctionId: string): Promise<AuctionLockedState | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM auctions WHERE id = $1 FOR UPDATE', auctionId);
      const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { cricketPlayer: true } });
      if (!auction) return null;
      return {
        id: auction.id,
        roomId: auction.roomId,
        cricketPlayerId: auction.cricketPlayerId,
        role: auction.cricketPlayer.role as PlayerRole,
        currentPrice: auction.currentPrice,
        highestBidderUserId: auction.highestBidderUserId,
        endsAt: auction.endsAt,
        antiSnipeWindowSeconds: auction.antiSnipeWindowSeconds,
        status: auction.status
      };
    });
  }

  async getAuctionSnapshot(auctionId: string): Promise<AuctionLockedState | null> {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId }, include: { cricketPlayer: true } });
    if (!auction) return null;
    return {
      id: auction.id,
      roomId: auction.roomId,
      cricketPlayerId: auction.cricketPlayerId,
      role: auction.cricketPlayer.role as PlayerRole,
      currentPrice: auction.currentPrice,
      highestBidderUserId: auction.highestBidderUserId,
      endsAt: auction.endsAt,
      antiSnipeWindowSeconds: auction.antiSnipeWindowSeconds,
      status: auction.status
    };
  }

  async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM auctions WHERE id = $1 FOR UPDATE', input.auctionId);
      const auction = await tx.auction.findUnique({
        where: { id: input.auctionId },
        include: { cricketPlayer: true }
      });

      if (!auction || auction.roomId !== input.roomId) {
        throw new NotFoundException('Auction not found');
      }
      if (auction.status !== 'running') {
        throw new BadRequestException('Auction not running');
      }

      const now = new Date();
      if (now > auction.endsAt) throw new BadRequestException('Auction already closed');

      if (input.idempotencyKey) {
        const existing = await tx.bid.findFirst({
          where: { auctionId: input.auctionId, idempotencyKey: input.idempotencyKey }
        });
        if (existing) {
          const remainingMs = Math.max(0, auction.endsAt.getTime() - Date.now());
          return {
            auctionId: input.auctionId,
            roomId: input.roomId,
            cricketPlayerId: input.cricketPlayerId,
            ownerId: input.ownerId,
            currentPrice: Number(auction.currentPrice),
            remainingMs,
            demandIndex: Number(existing.demandIndex),
            roleScarcityIndex: Number(existing.roleScarcityIndex),
            occurredAt: existing.createdAt.toISOString(),
            idempotentReplay: true
          };
        }
      }

      const team = await this.ensureTeam(tx, input.roomId, input.ownerId);
      const budgetRemaining = Number(team.budgetRemaining);
      if (budgetRemaining < input.amount) throw new BadRequestException('Insufficient budget');

      const minIncrement = this.getMinIncrement(Number(auction.currentPrice));
      if (input.amount < Number(auction.currentPrice) + minIncrement) {
        throw new BadRequestException(`Bid too low. Minimum: ${Number(auction.currentPrice) + minIncrement}`);
      }

      const demandIndex = await this.computeDemandIndex(tx, input.auctionId);
      const roleScarcityIndex = await this.computeRoleScarcityIndex(tx, auction.cricketPlayer.role as PlayerRole);

      await tx.bid.updateMany({ where: { auctionId: input.auctionId, isWinning: true }, data: { isWinning: false } });

      const bid = await tx.bid.create({
        data: {
          auctionId: input.auctionId,
          roomId: input.roomId,
          userId: input.ownerId,
          amount: BigInt(input.amount),
          demandIndex: new Prisma.Decimal(demandIndex),
          roleScarcityIndex: new Prisma.Decimal(roleScarcityIndex),
          isWinning: true,
          idempotencyKey: input.idempotencyKey
        }
      });

      const remainingMs = auction.endsAt.getTime() - Date.now();
      const extendByMs = remainingMs < auction.antiSnipeWindowSeconds * 1000 ? auction.antiSnipeWindowSeconds * 1000 : 0;
      const nextEnd = new Date(auction.endsAt.getTime() + extendByMs);

      await tx.auction.update({
        where: { id: input.auctionId },
        data: {
          currentPrice: BigInt(input.amount),
          highestBidderUserId: input.ownerId,
          endsAt: nextEnd
        }
      });

      await this.outboxRepository.insertInTransaction(tx, {
        aggregateType: 'auction',
        aggregateId: input.auctionId,
        eventType: 'AuctionBidPlaced',
        payload: {
          roomId: input.roomId,
          auctionId: input.auctionId,
          cricketPlayerId: input.cricketPlayerId,
          ownerId: input.ownerId,
          amount: input.amount,
          currentPrice: input.amount,
          remainingMs: Math.max(0, nextEnd.getTime() - Date.now()),
          demandIndex,
          roleScarcityIndex,
          occurredAt: bid.createdAt.toISOString()
        }
      });

      return {
        auctionId: input.auctionId,
        roomId: input.roomId,
        cricketPlayerId: input.cricketPlayerId,
        ownerId: input.ownerId,
        currentPrice: input.amount,
        remainingMs: Math.max(0, nextEnd.getTime() - Date.now()),
        demandIndex,
        roleScarcityIndex,
        occurredAt: bid.createdAt.toISOString(),
        idempotentReplay: false
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getBidHistory(auctionId: string) {
    const bids = await this.prisma.bid.findMany({
      where: { auctionId },
      orderBy: { createdAt: 'desc' }
    });

    return bids.map((bid) => ({ ownerId: bid.userId, amount: Number(bid.amount), occurredAt: bid.createdAt.toISOString() }));
  }

  async updateAuctionState(auctionId: string, state: 'pending' | 'running' | 'sold' | 'unsold'): Promise<void> {
    await this.prisma.auction.update({ where: { id: auctionId }, data: { status: state } });
  }

  async createRoom(ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureUser(tx, ownerId);
      const room = await tx.room.create({
        data: {
          code: `LAM${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          hostUserId: ownerId,
          state: 'waiting',
          members: { create: { userId: ownerId } }
        }
      });
      await this.ensureTeam(tx, room.id, ownerId);
      return this.toRoomView(room, [ownerId]);
    });
  }

  async joinRoom(roomId: string, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.state !== 'waiting') throw new BadRequestException('Cannot join room after auction starts');

      await this.ensureUser(tx, ownerId);
      await tx.roomMember.upsert({ where: { roomId_userId: { roomId, userId: ownerId } }, update: {}, create: { roomId, userId: ownerId } });
      await this.ensureTeam(tx, roomId, ownerId);

      const members = await tx.roomMember.findMany({ where: { roomId } });
      const shouldStartAuction = members.length >= 4;
      const updated = shouldStartAuction ? await tx.room.update({ where: { id: roomId }, data: { state: 'auction' } }) : room;
      return this.toRoomView(updated, members.map((member) => member.userId));
    });
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true }
    });
    if (!room) return null;
    return this.toRoomView(room, room.members.map((member) => member.userId));
  }

  async openAuction(roomId: string, cricketPlayerId: string, role: PlayerRole) {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId }, include: { members: true } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.state !== 'auction') throw new BadRequestException('Room is not in auction state');

      const demandMultiplier = this.getDemandMultiplier(room.members.length);
      const scarcityMultiplier = this.getRoleScarcityMultiplier(role);
      const basePrice = Math.round(200_000 * demandMultiplier * scarcityMultiplier);

      const player = await tx.player.findFirst({ where: { OR: [{ externalRef: cricketPlayerId }, { id: cricketPlayerId }] } });
      if (!player) throw new NotFoundException('Player not found');

      const now = new Date();
      const endsAt = new Date(now.getTime() + 20_000);
      const auction = await tx.auction.create({
        data: {
          roomId,
          cricketPlayerId: player.id,
          openingPrice: BigInt(basePrice),
          currentPrice: BigInt(basePrice),
          status: 'running',
          startsAt: now,
          endsAt,
          antiSnipeWindowSeconds: 5
        }
      });

      return {
        id: auction.id,
        roomId: auction.roomId,
        cricketPlayerId,
        role,
        currentPrice: Number(auction.currentPrice),
        endsAt: auction.endsAt.getTime()
      };
    });
  }

  async settleAuction(auctionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM auctions WHERE id = $1 FOR UPDATE', auctionId);
      const auction = await tx.auction.findUnique({ where: { id: auctionId } });
      if (!auction) throw new NotFoundException('Auction not found');
      if (new Date() < auction.endsAt) throw new BadRequestException('Auction still running');
      if (!auction.highestBidderUserId) {
        await tx.auction.update({ where: { id: auctionId }, data: { status: 'unsold' } });
        return { sold: false, auctionId };
      }

      const team = await this.ensureTeam(tx, auction.roomId, auction.highestBidderUserId);
      if (Number(team.budgetRemaining) < Number(auction.currentPrice)) {
        throw new BadRequestException('Winner has insufficient budget at settlement');
      }

      await tx.team.update({
        where: { id: team.id },
        data: { budgetRemaining: BigInt(Number(team.budgetRemaining) - Number(auction.currentPrice)) }
      });

      await tx.teamPlayer.create({
        data: {
          teamId: team.id,
          cricketPlayerId: auction.cricketPlayerId,
          acquiredPrice: auction.currentPrice
        }
      });

      await tx.auction.update({ where: { id: auctionId }, data: { status: 'sold' } });
      const bidCount = await tx.bid.count({ where: { auctionId } });
      return {
        sold: true,
        auctionId,
        winnerOwnerId: auction.highestBidderUserId,
        finalPrice: Number(auction.currentPrice),
        bidCount
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getPlayers() {
    const players = await this.prisma.player.findMany({ orderBy: { fullName: 'asc' } });
    return players.map((player) => ({
      id: player.externalRef ?? player.id,
      name: player.fullName,
      country: player.country,
      role: player.role as PlayerRole,
      battingAvg: Number(player.battingAvg),
      strikeRate: Number(player.strikeRate),
      economy: Number(player.economy),
      formIndex: Number(player.formIndex)
    }));
  }

  async getSquad(ownerId: string) {
    const team = await this.prisma.team.findFirst({
      where: { ownerUserId: ownerId },
      include: { teamPlayers: { include: { cricketPlayer: true } } }
    });

    if (!team) {
      return {
        ownerId,
        players: [],
        chemistryScore: 0,
        composition: {
          [PlayerRole.BATSMAN]: 0,
          [PlayerRole.BOWLER]: 0,
          [PlayerRole.ALL_ROUNDER]: 0,
          [PlayerRole.WICKET_KEEPER]: 0
        }
      };
    }

    const players = team.teamPlayers.map((player) => ({
      cricketPlayerId: player.cricketPlayer.externalRef ?? player.cricketPlayerId,
      role: player.cricketPlayer.role as PlayerRole,
      purchasePrice: Number(player.acquiredPrice)
    }));

    return {
      ownerId,
      players,
      chemistryScore: this.calculateChemistry(players),
      composition: this.roleComposition(players)
    };
  }

  async getBudget(ownerId: string) {
    const team = await this.prisma.team.findFirst({ where: { ownerUserId: ownerId } });
    return {
      ownerId,
      budgetRemaining: Number(team?.budgetRemaining ?? AuctionRepository.DEFAULT_BUDGET)
    };
  }

  async setRoomState(roomId: string, state: RoomState) {
    const room = await this.prisma.room.update({
      where: { id: roomId },
      data: { state },
      include: { members: true }
    });
    return this.toRoomView(room, room.members.map((member) => member.userId));
  }

  private async ensureUser(tx: Prisma.TransactionClient, userId: string) {
    await tx.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@lamcl.local`,
        passwordHash: 'migrated-no-password',
        displayName: `Owner-${userId.slice(0, 6)}`,
        role: 'player'
      }
    });
  }

  private async ensureTeam(tx: Prisma.TransactionClient, roomId: string, ownerId: string) {
    return tx.team.upsert({
      where: { roomId_ownerUserId: { roomId, ownerUserId: ownerId } },
      update: {},
      create: {
        roomId,
        ownerUserId: ownerId,
        name: `Team-${ownerId.slice(0, 6)}`,
        budgetTotal: BigInt(AuctionRepository.DEFAULT_BUDGET),
        budgetRemaining: BigInt(AuctionRepository.DEFAULT_BUDGET),
        chemistryScore: new Prisma.Decimal(0)
      }
    });
  }

  private async computeDemandIndex(tx: Prisma.TransactionClient, auctionId: string) {
    const since = new Date(Date.now() - 15_000);
    const recentBids = await tx.bid.count({ where: { auctionId, createdAt: { gte: since } } });
    return Number(Math.min(1, recentBids / 8).toFixed(2));
  }

  private async computeRoleScarcityIndex(tx: Prisma.TransactionClient, role: PlayerRole) {
    const count = await tx.teamPlayer.count({ where: { cricketPlayer: { role } } });
    return Number((1 - Math.min(1, count / 16)).toFixed(2));
  }

  private getDemandMultiplier(ownerCount: number) {
    if (ownerCount >= 8) return 1.35;
    if (ownerCount >= 6) return 1.2;
    return 1.0;
  }

  private getRoleScarcityMultiplier(role: PlayerRole) {
    switch (role) {
      case PlayerRole.WICKET_KEEPER:
        return 1.2;
      case PlayerRole.ALL_ROUNDER:
        return 1.25;
      case PlayerRole.BOWLER:
        return 1.1;
      default:
        return 1.0;
    }
  }

  private getMinIncrement(currentPrice: number) {
    if (currentPrice < 500_000) return 25_000;
    if (currentPrice < 2_000_000) return 50_000;
    return 100_000;
  }

  private toRoomView(room: Room, ownerIds: string[]) {
    return {
      id: room.id,
      state: room.state as RoomState,
      ownerIds,
      createdAt: room.createdAt.toISOString()
    };
  }

  private roleComposition(players: Array<{ role: PlayerRole }>) {
    return {
      [PlayerRole.BATSMAN]: players.filter((p) => p.role === PlayerRole.BATSMAN).length,
      [PlayerRole.BOWLER]: players.filter((p) => p.role === PlayerRole.BOWLER).length,
      [PlayerRole.ALL_ROUNDER]: players.filter((p) => p.role === PlayerRole.ALL_ROUNDER).length,
      [PlayerRole.WICKET_KEEPER]: players.filter((p) => p.role === PlayerRole.WICKET_KEEPER).length
    };
  }

  private calculateChemistry(players: Array<{ role: PlayerRole; purchasePrice: number }>) {
    if (players.length === 0) return 0;
    const composition = this.roleComposition(players);
    const roleBalance = Math.min(
      composition[PlayerRole.BATSMAN] / 4,
      composition[PlayerRole.BOWLER] / 4,
      composition[PlayerRole.ALL_ROUNDER] / 2,
      composition[PlayerRole.WICKET_KEEPER] / 1,
      1
    );
    const avgPrice = players.reduce((sum, player) => sum + player.purchasePrice, 0) / players.length;
    const fiscalBalance = avgPrice < 2_000_000 ? 1 : 0.85;
    return Number((roleBalance * 70 + fiscalBalance * 30).toFixed(2));
  }
}
