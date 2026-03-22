import { PlayerRole } from '@lamcl/shared-contracts';
import { BiddingStrategyService } from '../src/modules/ai/strategy/bidding-strategy.service';
import { PlayerValuationService } from '../src/modules/ai/valuation/player-valuation.service';

describe('AI vs AI auction simulation', () => {
  it('drives bidding rounds with distinct personality behavior', async () => {
    const prisma = {
      player: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-1',
          role: PlayerRole.BATSMAN,
          battingAvg: 49,
          strikeRate: 162,
          bowlingAvg: 44,
          economy: 8.6,
          formIndex: 1.22
        })
      },
      playerMatchup: {
        findMany: jest.fn().mockResolvedValue([
          { batsmanId: 'p-1', bowlerId: 'b-1', runsScored: 63, ballsFaced: 41, dismissals: 2 }
        ])
      }
    } as any;

    const strategy = new BiddingStrategyService(prisma, new PlayerValuationService());

    const conservativeTeam = {
      ownerId: 'ai-conservative',
      budgetRemaining: 4_500_000,
      composition: {
        [PlayerRole.BATSMAN]: 1,
        [PlayerRole.BOWLER]: 3,
        [PlayerRole.ALL_ROUNDER]: 1,
        [PlayerRole.WICKET_KEEPER]: 1
      },
      squadSize: 8
    };

    const aggressiveTeam = {
      ownerId: 'ai-aggressive',
      budgetRemaining: 4_500_000,
      composition: {
        [PlayerRole.BATSMAN]: 2,
        [PlayerRole.BOWLER]: 2,
        [PlayerRole.ALL_ROUNDER]: 0,
        [PlayerRole.WICKET_KEEPER]: 1
      },
      squadSize: 7
    };

    let currentPrice = 450_000;
    let conservativeBids = 0;
    let aggressiveBids = 0;

    for (let round = 0; round < 25; round++) {
      const auctionState = {
        roomId: 'room-sim',
        auctionId: 'auction-sim',
        cricketPlayerId: 'p-1',
        currentPrice,
        demandIndex: Math.min(1, round / 20),
        minIncrement: currentPrice < 500_000 ? 25_000 : 50_000
      };

      const conservative = await strategy.decideBid('p-1', conservativeTeam, auctionState, 'conservative');
      if (conservative.shouldBid && conservative.bidAmount > currentPrice) {
        currentPrice = conservative.bidAmount;
        conservativeBids += 1;
      }

      const aggressive = await strategy.decideBid(
        'p-1',
        aggressiveTeam,
        { ...auctionState, currentPrice },
        'aggressive'
      );
      if (aggressive.shouldBid && aggressive.bidAmount > currentPrice) {
        currentPrice = aggressive.bidAmount;
        aggressiveBids += 1;
      }

      if (!conservative.shouldBid && !aggressive.shouldBid) break;
    }

    expect(currentPrice).toBeGreaterThan(450_000);
    expect(aggressiveBids).toBeGreaterThanOrEqual(conservativeBids);
    expect(conservativeBids + aggressiveBids).toBeGreaterThan(0);
  });
});
