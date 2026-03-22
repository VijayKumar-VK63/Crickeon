import { AuctionService } from '../src/auction/auction.service';
import { PlaceBidDto } from '../src/auction/auction.dto';

class LockedFakeAuctionRepository {
  private currentPrice = 200000;
  private queue = Promise.resolve<void>(undefined);

  async placeBid(input: PlaceBidDto) {
    return this.withLock(async () => {
      if (input.amount <= this.currentPrice) {
        throw new Error('stale bid');
      }
      this.currentPrice = input.amount;
      return {
        auctionId: input.auctionId,
        roomId: input.roomId,
        cricketPlayerId: input.cricketPlayerId,
        ownerId: input.ownerId,
        currentPrice: input.amount,
        remainingMs: 15000,
        demandIndex: 0.65,
        roleScarcityIndex: 0.75,
        occurredAt: new Date().toISOString(),
        idempotentReplay: false
      };
    });
  }

  private async withLock<T>(fn: () => Promise<T>) {
    const previous = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  getPlayers = jest.fn();
  getRoom = jest.fn();
  setRoomState = jest.fn();
  createRoom = jest.fn();
  joinRoom = jest.fn();
  openAuction = jest.fn();
  settleAuction = jest.fn();
  getSquad = jest.fn();
  getBudget = jest.fn();
  getBidHistory = jest.fn();
  getAuctionSnapshot = jest.fn().mockResolvedValue({
    id: 'auction-1',
    roomId: 'room-1',
    cricketPlayerId: 'cric-001',
    role: 'batsman',
    currentPrice: BigInt(200000),
    highestBidderUserId: null,
    endsAt: new Date(Date.now() + 20_000),
    antiSnipeWindowSeconds: 5,
    status: 'running'
  });
  getAuctionWithLock = jest.fn();
  updateAuctionState = jest.fn();
}

describe('Auction bidding integration', () => {
  it('handles concurrent bids and keeps highest accepted bid', async () => {
    const repository = new LockedFakeAuctionRepository();
    const realtime = {
      cacheAuctionTimer: jest.fn().mockResolvedValue(undefined),
      publishBidUpdated: jest.fn().mockResolvedValue(undefined),
      publishAuctionTimer: jest.fn().mockResolvedValue(undefined),
      getAuctionTimer: jest.fn().mockResolvedValue(null)
    } as any;

    const lock = {
      runWithAuctionLock: jest.fn(async (_auctionId: string, work: () => Promise<unknown>) => work())
    } as any;

    const aiStrategy = {
      decideBid: jest.fn()
    } as any;

    const datasetBuilder = {
      buildTrainingDataset: jest.fn()
    } as any;

    const monetizationService = {
      getWallet: jest.fn(),
      deposit: jest.fn(),
      joinPaidLeague: jest.fn(),
      subscribePremium: jest.fn(),
      premiumEntitlements: jest.fn(),
      purchaseCosmetic: jest.fn()
    } as any;

    const growthService = {
      claimDailyReward: jest.fn(),
      getUserAchievements: jest.fn(),
      leaderboard: jest.fn()
    } as any;

    const service = new AuctionService(repository as any, realtime, lock, aiStrategy, datasetBuilder, monetizationService, growthService);
    repository.getBidHistory.mockResolvedValue([]);

    const shared = {
      roomId: 'room-1',
      auctionId: 'auction-1',
      cricketPlayerId: 'cric-001'
    };

    const bids = [450000, 700000, 550000].map((amount, index) =>
      service.placeBid({ ...shared, ownerId: `owner-${index}`, amount } as PlaceBidDto).catch((error) => ({ error: String(error.message) }))
    );

    const results = await Promise.all(bids);
    const successes = results.filter((entry: any) => !entry.error);

    expect(successes.length).toBe(2);
    const prices = successes.map((entry: any) => entry.auction.currentPrice).sort((a: number, b: number) => b - a);
    expect(prices[0]).toBe(550000);
    expect(lock.runWithAuctionLock).toHaveBeenCalledTimes(2);
    expect(realtime.cacheAuctionTimer).toHaveBeenCalledTimes(2);
  });
});
