export enum RoomState {
  WAITING = 'waiting',
  AUCTION = 'auction',
  MATCH = 'match',
  RESULTS = 'results'
}

export enum PlayerRole {
  BATSMAN = 'batsman',
  BOWLER = 'bowler',
  ALL_ROUNDER = 'all_rounder',
  WICKET_KEEPER = 'wicket_keeper'
}

export enum UserRole {
  ADMIN = 'admin',
  PLAYER = 'player'
}

export interface BidRequest {
  roomId: string;
  auctionId: string;
  cricketPlayerId: string;
  ownerId: string;
  amount: number;
  sentAt: string;
}

export interface AuctionBidPlacedEvent {
  type: 'AuctionBidPlaced';
  roomId: string;
  auctionId: string;
  cricketPlayerId: string;
  ownerId: string;
  amount: number;
  currentPrice: number;
  remainingMs: number;
  occurredAt: string;
}

export interface MatchBallEvent {
  type: 'MatchBallDelivered';
  matchId: string;
  innings: number;
  over: number;
  ball: number;
  batsmanId: string;
  bowlerId: string;
  runs: number;
  wicket: boolean;
  commentary: string;
  seed: number;
  occurredAt: string;
}
