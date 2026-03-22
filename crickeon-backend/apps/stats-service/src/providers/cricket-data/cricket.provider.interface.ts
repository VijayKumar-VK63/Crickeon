export type NormalizedPlayerRecord = {
  externalRef: string;
  fullName: string;
  country: string;
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
  battingAvg: number;
  strikeRate: number;
  bowlingAvg: number;
  economy: number;
  recentForm: number;
};

export type NormalizedLiveMatch = {
  providerMatchId: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  oversA: number;
  oversB: number;
  status: 'scheduled' | 'live' | 'completed';
  startedAt?: string;
};

export type NormalizedPlayerStat = {
  externalRef: string;
  runs: number;
  wickets: number;
  strikeRate: number;
  economy: number;
  performanceIndex: number;
};

export interface CricketDataProvider {
  name(): string;
  fetchPlayers(): Promise<NormalizedPlayerRecord[]>;
  fetchLiveMatches(): Promise<NormalizedLiveMatch[]>;
  fetchPlayerStats(externalRefs: string[]): Promise<NormalizedPlayerStat[]>;
}
