import { PlayerRole } from '@lamcl/shared-contracts';
import { BiddingStrategyService } from '../src/modules/ai/strategy/bidding-strategy.service';
import { PlayerValuationService } from '../src/modules/ai/valuation/player-valuation.service';

describe('BiddingStrategyService personalities', () => {
  const basePlayer = {
    id: 'player-1',
    role: PlayerRole.ALL_ROUNDER,
    battingAvg: 47,
    strikeRate: 151,
    bowlingAvg: 26,
    economy: 7,
    formIndex: 1.3
  };

  const makeService = () => {
    const prisma = {
      player: {
        findFirst: jest.fn().mockResolvedValue(basePlayer)
      },
      playerMatchup: {
        findMany: jest.fn().mockResolvedValue([
          { batsmanId: 'player-1', bowlerId: 'x', runsScored: 44, ballsFaced: 28, dismissals: 1 }
        ])
      }
    } as any;

    return new BiddingStrategyService(prisma, new PlayerValuationService());
  };

  const teamState = {
    ownerId: 'owner-1',
    budgetRemaining: 5_000_000,
    composition: {
      [PlayerRole.BATSMAN]: 2,
      [PlayerRole.BOWLER]: 2,
      [PlayerRole.ALL_ROUNDER]: 0,
      [PlayerRole.WICKET_KEEPER]: 1
    },
    squadSize: 7
  };

  const auctionState = {
    roomId: 'room-1',
    auctionId: 'auction-1',
    cricketPlayerId: 'player-1',
    currentPrice: 600_000,
    demandIndex: 0.45,
    minIncrement: 50_000
  };

  it('aggressive profile bids at least as much as conservative under same state', async () => {
    const service = makeService();
    const conservative = await service.decideBid('player-1', teamState, auctionState, 'conservative');
    const aggressive = await service.decideBid('player-1', teamState, auctionState, 'aggressive');

    expect(aggressive.maxAffordable).toBeGreaterThanOrEqual(conservative.maxAffordable);
    expect(aggressive.confidence).toBeGreaterThanOrEqual(conservative.confidence);
  });

  it('moneyball avoids bidding when value-per-cost is poor', async () => {
    const service = makeService();
    const expensiveAuction = { ...auctionState, currentPrice: 2_200_000, minIncrement: 100_000, demandIndex: 0.7 };

    const moneyball = await service.decideBid('player-1', teamState, expensiveAuction, 'moneyball');
    expect(moneyball.shouldBid).toBe(false);
  });
});
