import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class MonetizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.ensureWallet(userId);
    return {
      userId,
      walletId: wallet.id,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt.toISOString()
    };
  }

  async deposit(input: { userId: string; amount: number; reference: string }) {
    if (input.amount <= 0) throw new BadRequestException('Amount must be positive');

    const wallet = await this.prisma.$transaction(async (tx) => {
      const ensured = await this.ensureWallet(input.userId, tx);
      const nextBalance = Number(ensured.balance) + input.amount;

      const updated = await tx.wallet.update({
        where: { id: ensured.id },
        data: { balance: new Prisma.Decimal(nextBalance) }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: ensured.id,
          userId: input.userId,
          type: 'deposit',
          status: 'committed',
          amount: new Prisma.Decimal(input.amount),
          reference: input.reference,
          metadata: { source: 'manual_deposit' }
        }
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      accepted: true,
      userId: input.userId,
      balance: Number(wallet.balance),
      currency: wallet.currency
    };
  }

  async joinPaidLeague(input: { roomId: string; ownerId: string; entryFee: number; platformRakePct?: number }) {
    if (input.entryFee <= 0) throw new BadRequestException('Entry fee must be positive');

    const wallet = await this.ensureWallet(input.ownerId);
    if (Number(wallet.balance) < input.entryFee) throw new BadRequestException('Insufficient wallet balance');

    const rakePct = Math.max(0, Math.min(30, input.platformRakePct ?? 10));
    const prizeContribution = input.entryFee * (1 - rakePct / 100);

    const leagueEntry = await this.prisma.$transaction(async (tx) => {
      const ensured = await this.ensureWallet(input.ownerId, tx);
      const existing = await tx.leagueEntry.findUnique({ where: { roomId_ownerId: { roomId: input.roomId, ownerId: input.ownerId } } });
      if (existing) throw new BadRequestException('Already joined paid league');

      const nextBalance = Number(ensured.balance) - input.entryFee;
      if (nextBalance < 0) throw new BadRequestException('Insufficient wallet balance');

      await tx.wallet.update({
        where: { id: ensured.id },
        data: { balance: new Prisma.Decimal(nextBalance) }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: ensured.id,
          userId: input.ownerId,
          type: 'entry_fee',
          status: 'committed',
          amount: new Prisma.Decimal(input.entryFee),
          reference: `entry:${input.roomId}`,
          metadata: {
            roomId: input.roomId,
            platformRakePct: rakePct,
            prizeContribution
          }
        }
      });

      const entry = await tx.leagueEntry.create({
        data: {
          roomId: input.roomId,
          ownerId: input.ownerId,
          entryFee: new Prisma.Decimal(input.entryFee),
          prizePool: new Prisma.Decimal(prizeContribution),
          status: 'active'
        }
      });

      await tx.analyticsEvent.create({
        data: {
          userId: input.ownerId,
          eventType: 'league_entry_paid',
          entityType: 'room',
          entityId: input.roomId,
          payload: { entryFee: input.entryFee, prizeContribution, rakePct }
        }
      });

      return entry;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      accepted: true,
      roomId: input.roomId,
      ownerId: input.ownerId,
      entryFee: Number(leagueEntry.entryFee),
      prizePoolContribution: Number(leagueEntry.prizePool)
    };
  }

  async subscribePremium(input: { userId: string; days: number }) {
    const days = Math.max(30, Math.min(365, input.days));
    const now = new Date();
    const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.premiumSubscription.create({
      data: {
        userId: input.userId,
        tier: 'premium',
        status: 'active',
        startsAt: now,
        endsAt
      }
    });

    return {
      active: true,
      userId: input.userId,
      tier: subscription.tier,
      startsAt: subscription.startsAt.toISOString(),
      endsAt: subscription.endsAt?.toISOString() ?? null
    };
  }

  async purchaseCosmetic(input: { userId: string; cosmeticType: string; cosmeticKey: string; price: number }) {
    if (input.price <= 0) throw new BadRequestException('Cosmetic price must be positive');

    const wallet = await this.ensureWallet(input.userId);
    if (Number(wallet.balance) < input.price) throw new BadRequestException('Insufficient wallet balance');

    const result = await this.prisma.$transaction(async (tx) => {
      const ensured = await this.ensureWallet(input.userId, tx);
      const existing = await tx.cosmeticInventory.findUnique({
        where: {
          userId_cosmeticType_cosmeticKey: {
            userId: input.userId,
            cosmeticType: input.cosmeticType,
            cosmeticKey: input.cosmeticKey
          }
        }
      });
      if (existing) throw new BadRequestException('Cosmetic already owned');

      const nextBalance = Number(ensured.balance) - input.price;
      if (nextBalance < 0) throw new BadRequestException('Insufficient wallet balance');

      await tx.wallet.update({
        where: { id: ensured.id },
        data: { balance: new Prisma.Decimal(nextBalance) }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: ensured.id,
          userId: input.userId,
          type: 'cosmetic_purchase',
          status: 'committed',
          amount: new Prisma.Decimal(input.price),
          reference: `cosmetic:${input.cosmeticType}:${input.cosmeticKey}`,
          metadata: { cosmeticType: input.cosmeticType, cosmeticKey: input.cosmeticKey }
        }
      });

      return tx.cosmeticInventory.create({
        data: {
          userId: input.userId,
          cosmeticType: input.cosmeticType,
          cosmeticKey: input.cosmeticKey,
          isActive: false
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      purchased: true,
      userId: input.userId,
      cosmeticType: result.cosmeticType,
      cosmeticKey: result.cosmeticKey,
      unlockedAt: result.unlockedAt.toISOString()
    };
  }

  async premiumEntitlements(userId: string) {
    const active = await this.prisma.premiumSubscription.findFirst({
      where: { userId, status: 'active', tier: 'premium', OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      orderBy: { startsAt: 'desc' }
    });

    return {
      userId,
      premium: Boolean(active),
      features: {
        aiCoachPremium: Boolean(active),
        advancedAnalytics: Boolean(active),
        strategyInsights: Boolean(active)
      }
    };
  }

  private async ensureWallet(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found for wallet');
    }

    return client.wallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency: 'INR',
        balance: new Prisma.Decimal(0)
      }
    });
  }
}
