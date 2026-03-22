import { Injectable } from '@nestjs/common';
import { CricketDataProvider, NormalizedLiveMatch, NormalizedPlayerRecord, NormalizedPlayerStat } from './cricket.provider.interface';

@Injectable()
export class SportRadarProvider implements CricketDataProvider {
  private readonly apiKey = process.env.SPORTRADAR_API_KEY;
  private readonly baseUrl = process.env.SPORTRADAR_BASE_URL ?? 'https://api.sportradar.com/cricket-t2/en';

  name() {
    return 'sportradar';
  }

  async fetchPlayers(): Promise<NormalizedPlayerRecord[]> {
    if (!this.apiKey) return [];
    const response = await fetch(`${this.baseUrl}/players/profiles.json?api_key=${this.apiKey}`);
    if (!response.ok) return [];

    const payload = (await response.json()) as { players?: Array<Record<string, unknown>> };
    return (payload.players ?? []).slice(0, 300).map((player) => ({
      externalRef: String(player.id ?? ''),
      fullName: String(player.name ?? 'Unknown Player'),
      country: String(player.nationality ?? 'Unknown'),
      role: this.normalizeRole(String(player.type ?? 'all_rounder')),
      battingAvg: this.toNumber(player.batting_average, 30),
      strikeRate: this.toNumber(player.strike_rate, 115),
      bowlingAvg: this.toNumber(player.bowling_average, 32),
      economy: this.toNumber(player.economy, 7.5),
      recentForm: this.toNumber(player.form, 1)
    })).filter((player) => player.externalRef.length > 0);
  }

  async fetchLiveMatches(): Promise<NormalizedLiveMatch[]> {
    if (!this.apiKey) return [];
    const response = await fetch(`${this.baseUrl}/matches/live.json?api_key=${this.apiKey}`);
    if (!response.ok) return [];

    const payload = (await response.json()) as { matches?: Array<Record<string, unknown>> };
    return (payload.matches ?? [])
      .slice(0, 100)
      .map((match) => {
        const home = (match.home ?? {}) as { name?: string };
        const away = (match.away ?? {}) as { name?: string };

        return {
          providerMatchId: String(match.id ?? ''),
          teamA: String(home.name ?? 'Team A'),
          teamB: String(away.name ?? 'Team B'),
          scoreA: this.toNumber(match.home_runs, 0),
          scoreB: this.toNumber(match.away_runs, 0),
          oversA: this.toNumber(match.home_overs, 0),
          oversB: this.toNumber(match.away_overs, 0),
          status: this.normalizeStatus(String(match.status ?? 'scheduled')),
          startedAt: match.start_time ? String(match.start_time) : undefined
        } satisfies NormalizedLiveMatch;
      })
      .filter((entry) => entry.providerMatchId.length > 0);
  }

  async fetchPlayerStats(externalRefs: string[]): Promise<NormalizedPlayerStat[]> {
    if (!this.apiKey) return [];

    const stats = await Promise.all(
      externalRefs.slice(0, 200).map(async (externalRef) => {
        const response = await fetch(`${this.baseUrl}/players/${encodeURIComponent(externalRef)}/profile.json?api_key=${this.apiKey}`);
        if (!response.ok) return null;
        const payload = (await response.json()) as Record<string, unknown>;

        const runs = this.toNumber(payload.runs, 0);
        const wickets = this.toNumber(payload.wickets, 0);
        const strikeRate = this.toNumber(payload.strike_rate, 110);
        const economy = this.toNumber(payload.economy, 7.5);
        const performanceIndex = Math.max(0, Math.min(100, runs * 0.04 + wickets * 3.5 + strikeRate * 0.2 - economy * 1.4));

        return {
          externalRef,
          runs,
          wickets,
          strikeRate,
          economy,
          performanceIndex: Number(performanceIndex.toFixed(2))
        } satisfies NormalizedPlayerStat;
      })
    );

    return stats.filter((entry): entry is NormalizedPlayerStat => Boolean(entry));
  }

  private normalizeRole(role: string): NormalizedPlayerRecord['role'] {
    const normalized = role.toLowerCase();
    if (normalized.includes('keeper')) return 'wicket_keeper';
    if (normalized.includes('bowler')) return 'bowler';
    if (normalized.includes('batsman')) return 'batsman';
    return 'all_rounder';
  }

  private normalizeStatus(status: string): NormalizedLiveMatch['status'] {
    const normalized = status.toLowerCase();
    if (normalized.includes('live')) return 'live';
    if (normalized.includes('complete') || normalized.includes('closed')) return 'completed';
    return 'scheduled';
  }

  private toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
