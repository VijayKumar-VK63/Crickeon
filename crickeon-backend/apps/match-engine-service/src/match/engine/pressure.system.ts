export type PressureInput = {
  over: number;
  wicketsFallen: number;
  requiredRunRate: number;
  currentRunRate: number;
  basePressure: number;
};

export class PressureSystem {
  compute(input: PressureInput) {
    const deathOvers = input.over >= 16 ? 0.18 : 0;
    const wicketFactor = Math.min(0.25, input.wicketsFallen * 0.03);
    const rrrGap = Math.max(0, input.requiredRunRate - input.currentRunRate) * 0.04;
    const pressure = input.basePressure * 0.45 + deathOvers + wicketFactor + rrrGap;
    return Math.max(0, Math.min(1, pressure));
  }
}
