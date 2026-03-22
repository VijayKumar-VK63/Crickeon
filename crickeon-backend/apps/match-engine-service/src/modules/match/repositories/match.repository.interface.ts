export type CreateMatchInput = {
  matchId: string;
  teamAId: string;
  teamBId: string;
  tossWinnerTeamId?: string;
  tossDecision?: 'bat' | 'bowl';
  pitchType: 'flat' | 'green' | 'dusty';
  seed: number;
};

export type BallEventAppendInput = {
  matchId: string;
  innings: number;
  over: number;
  ball: number;
  runs: number;
  eventType: string;
  batsmanId: string;
  bowlerId: string;
  commentary: string;
  metadata: Record<string, unknown>;
};

export type PlayerMatchupState = {
  batsmanId: string;
  bowlerId: string;
  runsScored: number;
  ballsFaced: number;
  dismissals: number;
};

export interface IMatchRepository {
  createMatch(input: CreateMatchInput): Promise<{ id: string; status: 'scheduled' | 'live' | 'completed'; seed: number }>;
  appendBallEvent(input: BallEventAppendInput): Promise<{ streamVersion: number; occurredAt: string }>;
  getMatchState(matchId: string): Promise<{ matchId: string; runs: number; wickets: number; balls: number; overs: string; events: number }>;
  replayMatch(matchId: string, fromBall: number, toBall?: number): Promise<{ matchId: string; fromBall: number; toBall: number; totalBalls: number; events: Array<{ innings: number; over: number; ball: number; runs: number; eventType: string; commentary: string; metadata: Record<string, unknown>; occurredAt: string }> }>;
  getMatchMeta(matchId: string): Promise<{ matchId: string; pitchType: 'flat' | 'green' | 'dusty'; seed: number } | null>;
  getPlayerMatchup(batsmanId: string, bowlerId: string): Promise<PlayerMatchupState | null>;
  upsertPlayerMatchup(input: { batsmanId: string; bowlerId: string; runs: number; wicket: boolean }): Promise<PlayerMatchupState>;
}
