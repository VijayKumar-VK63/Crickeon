export type BallOutcome = 'dot' | 'single' | 'double' | 'boundary' | 'six' | 'wicket';

export type ProbabilityInput = {
  batsmanSkill: number;
  bowlerSkill: number;
  pressure: number;
  fatigue: number;
  momentum: number;
  matchupAdvantage: number;
  pitchBattingFactor: number;
  pitchBowlingFactor: number;
};

export class ProbabilityEngine {
  compute(input: ProbabilityInput): Record<BallOutcome, number> {
    const bat = this.clamp01(input.batsmanSkill * input.pitchBattingFactor);
    const bowl = this.clamp01(input.bowlerSkill * input.pitchBowlingFactor);
    const pressure = this.clamp01(input.pressure);
    const fatigue = this.clamp01(input.fatigue);
    const momentum = this.clamp(input.momentum, -1, 1);
    const matchup = this.clamp(input.matchupAdvantage, -1, 1);

    const logits: Record<BallOutcome, number> = {
      dot: 1.2 + bowl * 1.3 + pressure * 0.8 - bat * 1.1 - momentum * 0.5,
      single: 0.8 + bat * 0.7 - pressure * 0.3 - fatigue * 0.1,
      double: 0.1 + bat * 0.3 - pressure * 0.2 - fatigue * 0.05,
      boundary: -0.4 + bat * 1.2 + momentum * 0.7 - bowl * 0.6 - pressure * 0.4,
      six: -1.1 + bat * 1.0 + momentum * 0.8 - bowl * 0.7 - pressure * 0.5,
      wicket: -1.0 + bowl * 1.4 + pressure * 1.0 + fatigue * 0.6 - bat * 1.1 - matchup * 0.6 - momentum * 0.4
    };

    return this.softmax(logits);
  }

  sample(probabilities: Record<BallOutcome, number>, rng: () => number): BallOutcome {
    const roll = rng();
    let cumulative = 0;
    const outcomes: BallOutcome[] = ['dot', 'single', 'double', 'boundary', 'six', 'wicket'];
    for (const outcome of outcomes) {
      cumulative += probabilities[outcome];
      if (roll <= cumulative) return outcome;
    }
    return 'dot';
  }

  private softmax(logits: Record<BallOutcome, number>) {
    const values = Object.values(logits);
    const max = Math.max(...values);
    const exp: Record<BallOutcome, number> = {
      dot: Math.exp(logits.dot - max),
      single: Math.exp(logits.single - max),
      double: Math.exp(logits.double - max),
      boundary: Math.exp(logits.boundary - max),
      six: Math.exp(logits.six - max),
      wicket: Math.exp(logits.wicket - max)
    };
    const total = exp.dot + exp.single + exp.double + exp.boundary + exp.six + exp.wicket;
    return {
      dot: exp.dot / total,
      single: exp.single / total,
      double: exp.double / total,
      boundary: exp.boundary / total,
      six: exp.six / total,
      wicket: exp.wicket / total
    };
  }

  private clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
  }

  private clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }
}
