import { BallOutcome } from './probability.engine';

export type MomentumState = {
  value: number;
  boundaryStreak: number;
  dotStreak: number;
};

export class MomentumSystem {
  update(previous: MomentumState, outcome: BallOutcome): MomentumState {
    let { value, boundaryStreak, dotStreak } = previous;

    if (outcome === 'boundary' || outcome === 'six') {
      boundaryStreak += 1;
      dotStreak = 0;
      value += 0.08 + boundaryStreak * 0.03;
    } else if (outcome === 'wicket') {
      boundaryStreak = 0;
      dotStreak = 0;
      value -= 0.22;
    } else if (outcome === 'dot') {
      dotStreak += 1;
      boundaryStreak = 0;
      value -= 0.04 + dotStreak * 0.02;
    } else {
      boundaryStreak = 0;
      dotStreak = 0;
      value += 0.01;
    }

    value *= 0.96;
    value = Math.max(-1, Math.min(1, value));

    return { value, boundaryStreak, dotStreak };
  }
}
