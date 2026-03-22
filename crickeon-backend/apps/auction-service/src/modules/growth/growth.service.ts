import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GrowthService {
  constructor(private readonly prisma: PrismaService) {}

  async claimDailyReward(userId: string) {
    const today = new Date(new Date().toISOString().slice(0, 10));

    const existing = await this.prisma.dailyRewardClaim.findUnique({
      where: {
        userId_claimDate: {
          userId,
          claimDate: today
        }
      }
    });

    if (existing) {
      throw new BadRequestException('Daily reward already claimed');
    }

    const lastClaim = await this.prisma.dailyRewardClaim.findFirst({ where: { userId }, orderBy: { claimDate: 'desc' } });
    const previousDay = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const streakContinues = lastClaim && lastClaim.claimDate.getTime() === previousDay.getTime();
    const streak = streakContinues ? lastClaim.streak + 1 : 1;
    const rewardCoins = Math.min(500, 50 + streak * 10);

    const claim = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, currency: 'INR', balance: new Prisma.Decimal(0) }
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(Number(wallet.balance) + rewardCoins) }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'reward_credit',
          status: 'committed',
          amount: new Prisma.Decimal(rewardCoins),
          reference: `daily-reward:${today.toISOString().slice(0, 10)}`,
          metadata: { streak }
        }
      });

      await tx.analyticsEvent.create({
        data: {
          userId,
          eventType: 'daily_reward_claimed',
          entityType: 'user',
          entityId: userId,
          payload: { streak, rewardCoins }
        }
      });

      return tx.dailyRewardClaim.create({
        data: {
          userId,
          claimDate: today,
          rewardCoins,
          streak
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.updateAchievementProgress(userId, 'daily_grinder', 1);

    return {
      claimed: true,
      userId,
      streak: claim.streak,
      rewardCoins: claim.rewardCoins,
      claimDate: claim.claimDate.toISOString()
    };
  }

  async getUserAchievements(userId: string) {
    await this.seedAchievementDefinitions();

    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { achievementKey: 'asc' }
    });

    return achievements.map((entry) => ({
      key: entry.achievementKey,
      title: entry.achievement.title,
      description: entry.achievement.description,
      category: entry.achievement.category,
      threshold: entry.achievement.threshold,
      progress: entry.progress,
      unlocked: Boolean(entry.unlockedAt),
      unlockedAt: entry.unlockedAt?.toISOString() ?? null
    }));
  }

  async leaderboard(limit = 25) {
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string; display_name: string; elo_rating: number; matches: bigint; wins: bigint }>>`
      SELECT
        u.id AS user_id,
        u.display_name,
        u.elo_rating,
        COUNT(m.id)::bigint AS matches,
        SUM(CASE WHEN m.winner_team_id = t.id THEN 1 ELSE 0 END)::bigint AS wins
      FROM users u
      LEFT JOIN teams t ON t.owner_user_id = u.id
      LEFT JOIN matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
      GROUP BY u.id, u.display_name, u.elo_rating
      ORDER BY u.elo_rating DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      eloRating: Number(row.elo_rating),
      matches: Number(row.matches),
      wins: Number(row.wins)
    }));
  }

  private async updateAchievementProgress(userId: string, key: string, increment: number) {
    await this.seedAchievementDefinitions();

    const definition = await this.prisma.achievementDefinition.findUnique({ where: { key } });
    if (!definition) return;

    const existing = await this.prisma.userAchievement.findUnique({ where: { userId_achievementKey: { userId, achievementKey: key } } });
    const progress = (existing?.progress ?? 0) + increment;

    await this.prisma.userAchievement.upsert({
      where: { userId_achievementKey: { userId, achievementKey: key } },
      update: {
        progress,
        unlockedAt: progress >= definition.threshold ? existing?.unlockedAt ?? new Date() : null
      },
      create: {
        userId,
        achievementKey: key,
        progress,
        unlockedAt: progress >= definition.threshold ? new Date() : null
      }
    });
  }

  private async seedAchievementDefinitions() {
    const definitions = [
      {
        key: 'daily_grinder',
        title: 'Daily Grinder',
        description: 'Claim daily rewards 7 times',
        category: 'retention',
        threshold: 7
      },
      {
        key: 'market_sniper',
        title: 'Market Sniper',
        description: 'Win 10 auctions',
        category: 'auction',
        threshold: 10
      },
      {
        key: 'season_climber',
        title: 'Season Climber',
        description: 'Reach Elo 1500',
        category: 'ranking',
        threshold: 1500
      }
    ] as const;

    await this.prisma.$transaction(
      definitions.map((definition) =>
        this.prisma.achievementDefinition.upsert({
          where: { key: definition.key },
          update: {
            title: definition.title,
            description: definition.description,
            category: definition.category,
            threshold: definition.threshold
          },
          create: definition
        })
      )
    );
  }
}
