import { ProbabilityEngine } from '../src/match/engine/probability.engine';

describe('Load test 1000 matches', () => {
  it('simulates 1000 matches with deterministic seeded outcomes', () => {
    const engine = new ProbabilityEngine();

    let globalSeed = 11;
    const makeRng = () => {
      let seed = globalSeed;
      globalSeed += 37;
      return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
    };

    const results: number[] = [];
    for (let match = 0; match < 1000; match += 1) {
      const rng = makeRng();
      let score = 0;
      let wickets = 0;
      for (let ball = 0; ball < 120; ball += 1) {
        const p = engine.compute({
          batsmanSkill: 0.65 + (match % 10) * 0.01,
          bowlerSkill: 0.63,
          pressure: Math.min(1, ball / 120),
          fatigue: Math.min(1, ball / 180),
          momentum: ((ball % 12) - 6) / 20,
          matchupAdvantage: 0,
          pitchBattingFactor: 1,
          pitchBowlingFactor: 1
        });
        const outcome = engine.sample(p, rng);
        if (outcome === 'single') score += 1;
        if (outcome === 'double') score += 2;
        if (outcome === 'boundary') score += 4;
        if (outcome === 'six') score += 6;
        if (outcome === 'wicket') wickets += 1;
      }
      results.push(score);
      expect(wickets).toBeLessThanOrEqual(120);
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    expect(avg).toBeGreaterThan(60);
    expect(avg).toBeLessThan(260);
  });
});
