import { PlayerRole, RoomState } from '@crickeon/shared-contracts';

export type AuctionLockedState = {
  id: string;
  roomId: string;
  cricketPlayerId: string;
  role: PlayerRole;
  currentPrice: bigint;
  highestBidderUserId: string | null;
  endsAt: Date;
  antiSnipeWindowSeconds: number;
  status: 'pending' | 'running' | 'sold' | 'unsold';
};

export type PlaceBidInput = {
  roomId: string;
  auctionId: string;
  cricketPlayerId: string;
  ownerId: string;
  amount: number;
  idempotencyKey?: string;
};

export type PlaceBidResult = {
  auctionId: string;
  roomId: string;
  cricketPlayerId: string;
  ownerId: string;
  currentPrice: number;
  remainingMs: number;
  demandIndex: number;
  roleScarcityIndex: number;
  occurredAt: string;
  idempotentReplay: boolean;
};

export interface IAuctionRepository {
  getAuctionWithLock(auctionId: string): Promise<AuctionLockedState | null>;
  getAuctionSnapshot(auctionId: string): Promise<AuctionLockedState | null>;
  placeBid(input: PlaceBidInput): Promise<PlaceBidResult>;
  getBidHistory(auctionId: string): Promise<Array<{ ownerId: string; amount: number; occurredAt: string }>>;
  updateAuctionState(auctionId: string, state: 'pending' | 'running' | 'sold' | 'unsold'): Promise<void>;

  createRoom(ownerId: string): Promise<{ id: string; state: RoomState; ownerIds: string[]; createdAt: string }>;
  joinRoom(roomId: string, ownerId: string): Promise<{ id: string; state: RoomState; ownerIds: string[]; createdAt: string }>;
  getRoom(roomId: string): Promise<{ id: string; state: RoomState; ownerIds: string[]; createdAt: string } | null>;
  openAuction(roomId: string, cricketPlayerId: string, role: PlayerRole): Promise<{ id: string; roomId: string; cricketPlayerId: string; role: PlayerRole; currentPrice: number; endsAt: number }>;
  settleAuction(auctionId: string): Promise<{ sold: boolean; auctionId: string; winnerOwnerId?: string; finalPrice?: number; bidCount?: number }>;
  getPlayers(): Promise<Array<{ id: string; name: string; country: string; role: PlayerRole; battingAvg: number; strikeRate: number; economy: number; formIndex: number }>>;
  getSquad(ownerId: string): Promise<{ ownerId: string; players: Array<{ cricketPlayerId: string; role: PlayerRole; purchasePrice: number }>; chemistryScore: number; composition: Record<PlayerRole, number> }>;
  getBudget(ownerId: string): Promise<{ ownerId: string; budgetRemaining: number }>;
  setRoomState(roomId: string, state: RoomState): Promise<{ id: string; state: RoomState; ownerIds: string[]; createdAt: string }>;
}
