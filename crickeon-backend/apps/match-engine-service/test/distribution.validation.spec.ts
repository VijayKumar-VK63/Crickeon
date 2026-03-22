import { ProbabilityEngine } from '../src/match/engine/probability.engine';

describe('Statistical distribution validation', () => {
  it('sampled outcomes roughly follow predicted probabilities', () => {
    const engine = new ProbabilityEngine();
    const probabilities = engine.compute({
      batsmanSkill: 0.72,
      bowlerSkill: 0.68,
      pressure: 0.44,
      fatigue: 0.27,
      momentum: 0.13,
      matchupAdvantage: 0.09,
      pitchBattingFactor: 1.03,
      pitchBowlingFactor: 0.97
    });

    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const counts = { dot: 0, single: 0, double: 0, boundary: 0, six: 0, wicket: 0 };
    const N = 20000;
    for (let i = 0; i < N; i += 1) {
      counts[engine.sample(probabilities, rng)] += 1;
    }

    const observedWicket = counts.wicket / N;
    expect(Math.abs(observedWicket - probabilities.wicket)).toBeLessThan(0.035);
  });
});
