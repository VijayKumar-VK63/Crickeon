import { PlayerValuationService } from '../src/modules/ai/valuation/player-valuation.service';

describe('PlayerValuationService', () => {
  const service = new PlayerValuationService();

  it('produces higher score for stronger all-round profile', () => {
    const elite = service.score({
      battingAvg: 52,
      strikeRate: 156,
      bowlingAvg: 22,
      economy: 6.5,
      recentForm: 1.45,
      roleScarcity: 0.72,
      matchupStrength: 0.68
    });

    const weak = service.score({
      battingAvg: 21,
      strikeRate: 97,
      bowlingAvg: 43,
      economy: 9.3,
      recentForm: 0.78,
      roleScarcity: 0.3,
      matchupStrength: 0.38
    });

    expect(elite.valueScore).toBeGreaterThan(weak.valueScore);
    expect(elite.valueScore).toBeGreaterThan(60);
    expect(weak.valueScore).toBeLessThan(55);
  });

  it('clamps out-of-bound values and stays within 0-100', () => {
    const result = service.score({
      battingAvg: 400,
      strikeRate: 50,
      bowlingAvg: -5,
      economy: 100,
      recentForm: 10,
      roleScarcity: 3,
      matchupStrength: -4
    });

    expect(result.valueScore).toBeGreaterThanOrEqual(0);
    expect(result.valueScore).toBeLessThanOrEqual(100);
    expect(result.scarcityImpact).toBe(1);
    expect(result.matchupImpact).toBe(0);
  });
});
