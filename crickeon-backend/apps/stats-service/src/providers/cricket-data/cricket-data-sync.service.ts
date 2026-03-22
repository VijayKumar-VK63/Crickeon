import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CricketDataProvider, NormalizedLiveMatch, NormalizedPlayerStat } from './cricket.provider.interface';
import { CricApiProvider } from './cricapi.provider';
import { SportRadarProvider } from './sportradar.provider';

@Injectable()
export class CricketDataSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CricketDataSyncService.name);
  private readonly redis = RedisClientFactory.createClient();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cricApiProvider: CricApiProvider,
    private readonly sportRadarProvider: SportRadarProvider
  ) {}

  async onModuleInit() {
    await this.syncNow().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Initial cricket sync failed: ${message}`);
    });

    this.syncInterval = setInterval(() => {
      void this.syncNow().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Periodic cricket sync failed: ${message}`);
      });
    }, Number(process.env.CRICKET_SYNC_MS ?? 15 * 60_000));
  }

  async onModuleDestroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    await this.redis.quit();
  }

  async syncNow() {
    const provider = this.activeProvider();
    const [players, liveMatches] = await Promise.all([provider.fetchPlayers(), provider.fetchLiveMatches()]);

    if (players.length) {
      await this.prisma.$transaction(
        players.map((player) =>
          this.prisma.player.upsert({
            where: { externalRef: player.externalRef },
            update: {
              fullName: player.fullName,
              country: player.country,
              role: player.role,
              battingAvg: new Prisma.Decimal(player.battingAvg),
              strikeRate: new Prisma.Decimal(player.strikeRate),
              bowlingAvg: new Prisma.Decimal(player.bowlingAvg),
              economy: new Prisma.Decimal(player.economy),
              formIndex: new Prisma.Decimal(player.recentForm)
            },
            create: {
              externalRef: player.externalRef,
              fullName: player.fullName,
              country: player.country,
              role: player.role,
              battingAvg: new Prisma.Decimal(player.battingAvg),
              strikeRate: new Prisma.Decimal(player.strikeRate),
              bowlingAvg: new Prisma.Decimal(player.bowlingAvg),
              economy: new Prisma.Decimal(player.economy),
              formIndex: new Prisma.Decimal(player.recentForm)
            }
          })
        )
      );
    }

    const playerRefs = players.map((player) => player.externalRef).filter(Boolean);
    const stats = playerRefs.length ? await provider.fetchPlayerStats(playerRefs) : [];
    await this.persistSnapshots(provider.name(), stats);
    await this.cacheLiveMatches(provider.name(), liveMatches);

    return {
      provider: provider.name(),
      playerCount: players.length,
      liveMatchCount: liveMatches.length,
      snapshotCount: stats.length,
      syncedAt: new Date().toISOString()
    };
  }

  async getPlayerBoost(playerIdOrExternalRef: string) {
    const player = await this.prisma.player.findFirst({
      where: { OR: [{ id: playerIdOrExternalRef }, { externalRef: playerIdOrExternalRef }] },
      select: { id: true, externalRef: true }
    });

    if (!player) {
      return { found: false, performanceIndex: 50, battingBoost: 1, bowlingBoost: 1 };
    }

    const snapshot = await this.prisma.realWorldPlayerSnapshot.findFirst({
      where: { cricketPlayerId: player.id },
      orderBy: { snapshotDate: 'desc' }
    });

    const performanceIndex = Number(snapshot?.performanceIndex ?? 50);
    const normalized = Math.max(0, Math.min(1, performanceIndex / 100));

    const battingBoost = Number((0.9 + normalized * 0.25).toFixed(3));
    const bowlingBoost = Number((1.1 - normalized * 0.2).toFixed(3));

    return {
      found: true,
      playerId: player.id,
      externalRef: player.externalRef,
      performanceIndex,
      battingBoost,
      bowlingBoost,
      provider: snapshot?.provider ?? 'none',
      snapshotDate: snapshot?.snapshotDate.toISOString() ?? null
    };
  }

  async getLiveMatchesCached() {
    const key = 'cricket:live:matches';
    const raw = await this.redis.get(key);
    if (!raw) return [] as NormalizedLiveMatch[];
    return JSON.parse(raw) as NormalizedLiveMatch[];
  }

  private activeProvider(): CricketDataProvider {
    const configured = (process.env.CRICKET_DATA_PROVIDER ?? 'cricapi').toLowerCase();
    if (configured === 'sportradar') return this.sportRadarProvider;
    return this.cricApiProvider;
  }

  private async persistSnapshots(provider: string, stats: NormalizedPlayerStat[]) {
    if (!stats.length) return;

    const playerRefs = stats.map((entry) => entry.externalRef);
    const players = await this.prisma.player.findMany({
      where: { externalRef: { in: playerRefs } },
      select: { id: true, externalRef: true }
    });
    const map = new Map(players.map((player) => [player.externalRef ?? '', player.id]));
    const today = new Date(new Date().toISOString().slice(0, 10));

    const writes: Array<ReturnType<PrismaService['realWorldPlayerSnapshot']['upsert']>> = [];
    for (const entry of stats) {
        const playerId = map.get(entry.externalRef);
        if (!playerId) continue;
        writes.push(this.prisma.realWorldPlayerSnapshot.upsert({
          where: {
            cricketPlayerId_provider_snapshotDate: {
              cricketPlayerId: playerId,
              provider,
              snapshotDate: today
            }
          },
          update: {
            runs: entry.runs,
            wickets: entry.wickets,
            strikeRate: new Prisma.Decimal(entry.strikeRate),
            economy: new Prisma.Decimal(entry.economy),
            performanceIndex: new Prisma.Decimal(entry.performanceIndex)
          },
          create: {
            cricketPlayerId: playerId,
            provider,
            snapshotDate: today,
            runs: entry.runs,
            wickets: entry.wickets,
            strikeRate: new Prisma.Decimal(entry.strikeRate),
            economy: new Prisma.Decimal(entry.economy),
            performanceIndex: new Prisma.Decimal(entry.performanceIndex)
          }
        }));
    }

    if (writes.length) await this.prisma.$transaction(writes);
  }

  private async cacheLiveMatches(provider: string, matches: NormalizedLiveMatch[]) {
    const key = 'cricket:live:matches';
    await this.redis.set(key, JSON.stringify(matches), 'EX', 120);
    await this.redis.publish('cricket:live:updates', JSON.stringify({ provider, count: matches.length, matches }));
  }
}
