import { Injectable } from '@nestjs/common';
import { CricketDataProvider, NormalizedLiveMatch, NormalizedPlayerRecord, NormalizedPlayerStat } from './cricket.provider.interface';

@Injectable()
export class CricApiProvider implements CricketDataProvider {
  private readonly apiKey = process.env.CRICAPI_KEY;
  private readonly baseUrl = process.env.CRICAPI_BASE_URL ?? 'https://api.cricapi.com/v1';

  name() {
    return 'cricapi';
  }

  async fetchPlayers(): Promise<NormalizedPlayerRecord[]> {
    const url = `${this.baseUrl}/players?apikey=${this.apiKey ?? ''}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const data = payload.data ?? [];

    return data.slice(0, 300).map((row) => ({
      externalRef: String(row.id ?? row.playerId ?? ''),
      fullName: String(row.name ?? 'Unknown Player'),
      country: String(row.country ?? 'Unknown'),
      role: this.normalizeRole(String(row.role ?? 'all_rounder')),
      battingAvg: this.toNumber(row.battingAverage, 30),
      strikeRate: this.toNumber(row.strikeRate, 120),
      bowlingAvg: this.toNumber(row.bowlingAverage, 30),
      economy: this.toNumber(row.economy, 7),
      recentForm: this.toNumber(row.formIndex, 1)
    })).filter((player) => player.externalRef.length > 0);
  }

  async fetchLiveMatches(): Promise<NormalizedLiveMatch[]> {
    const url = `${this.baseUrl}/currentMatches?apikey=${this.apiKey ?? ''}&offset=0`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };

    return (payload.data ?? []).slice(0, 100).map((row) => ({
      providerMatchId: String(row.id ?? row.matchId ?? ''),
      teamA: String(row.t1 ?? row.teamA ?? 'Team A'),
      teamB: String(row.t2 ?? row.teamB ?? 'Team B'),
      scoreA: this.extractScore(String(row.t1s ?? '0/0')),
      scoreB: this.extractScore(String(row.t2s ?? '0/0')),
      oversA: this.extractOvers(String(row.t1s ?? '0/0')),
      oversB: this.extractOvers(String(row.t2s ?? '0/0')),
      status: this.normalizeStatus(String(row.status ?? 'scheduled')),
      startedAt: row.dateTimeGMT ? String(row.dateTimeGMT) : undefined
    })).filter((match) => match.providerMatchId.length > 0);
  }

  async fetchPlayerStats(externalRefs: string[]): Promise<NormalizedPlayerStat[]> {
    const uniqueRefs = [...new Set(externalRefs)].filter(Boolean).slice(0, 200);
    const stats = await Promise.all(uniqueRefs.map(async (externalRef) => {
      const url = `${this.baseUrl}/players_info?apikey=${this.apiKey ?? ''}&id=${encodeURIComponent(externalRef)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const payload = (await response.json()) as { data?: Record<string, unknown> };
      const row = payload.data ?? {};
      const runs = this.toNumber(row.runs, 0);
      const wickets = this.toNumber(row.wickets, 0);
      const strikeRate = this.toNumber(row.strikeRate, 110);
      const economy = this.toNumber(row.economy, 7.5);
      const performanceIndex = this.clamp((runs / 80) * 0.45 + (wickets / 4) * 0.35 + (strikeRate / 180) * 0.2, 0, 1) * 100;

      return {
        externalRef,
        runs,
        wickets,
        strikeRate,
        economy,
        performanceIndex: Number(performanceIndex.toFixed(2))
      } satisfies NormalizedPlayerStat;
    }));

    return stats.filter((entry): entry is NormalizedPlayerStat => Boolean(entry));
  }

  private normalizeRole(role: string): NormalizedPlayerRecord['role'] {
    const normalized = role.toLowerCase();
    if (normalized.includes('wk')) return 'wicket_keeper';
    if (normalized.includes('bowl')) return 'bowler';
    if (normalized.includes('bat')) return 'batsman';
    return 'all_rounder';
  }

  private normalizeStatus(status: string): NormalizedLiveMatch['status'] {
    const normalized = status.toLowerCase();
    if (normalized.includes('live')) return 'live';
    if (normalized.includes('complete') || normalized.includes('result')) return 'completed';
    return 'scheduled';
  }

  private extractScore(summary: string) {
    const [runs] = summary.split('/');
    const parsed = Number(runs);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private extractOvers(summary: string) {
    const match = summary.match(/\((\d+(\.\d+)?)\)/);
    return match ? Number(match[1]) : 0;
  }

  private toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
