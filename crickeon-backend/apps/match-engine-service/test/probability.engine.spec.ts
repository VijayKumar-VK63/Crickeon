import { ProbabilityEngine } from '../src/match/engine/probability.engine';

describe('ProbabilityEngine', () => {
  it('increases wicket probability for stronger bowler under pressure', () => {
    const engine = new ProbabilityEngine();

    const weakBowler = engine.compute({
      batsmanSkill: 0.75,
      bowlerSkill: 0.45,
      pressure: 0.3,
      fatigue: 0.2,
      momentum: 0,
      matchupAdvantage: 0,
      pitchBattingFactor: 1,
      pitchBowlingFactor: 1
    });

    const strongBowler = engine.compute({
      batsmanSkill: 0.75,
      bowlerSkill: 0.82,
      pressure: 0.8,
      fatigue: 0.2,
      momentum: -0.2,
      matchupAdvantage: 0,
      pitchBattingFactor: 1,
      pitchBowlingFactor: 1
    });

    expect(strongBowler.wicket).toBeGreaterThan(weakBowler.wicket);
  });

  it('normalizes probabilities to 1', () => {
    const engine = new ProbabilityEngine();
    const p = engine.compute({
      batsmanSkill: 0.7,
      bowlerSkill: 0.7,
      pressure: 0.5,
      fatigue: 0.5,
      momentum: 0,
      matchupAdvantage: 0,
      pitchBattingFactor: 1,
      pitchBowlingFactor: 1
    });
    const sum = p.dot + p.single + p.double + p.boundary + p.six + p.wicket;
    expect(sum).toBeCloseTo(1, 8);
  });
}
);
