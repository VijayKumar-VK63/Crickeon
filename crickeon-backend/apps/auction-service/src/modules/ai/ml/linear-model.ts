import { PlayerPerformanceModel } from './model.interface';

export class LinearModel implements PlayerPerformanceModel {
  constructor(private readonly weights: number[] = [0.22, 0.18, 0.22, 0.14, 0.12, 0.07, 0.05]) {}

  predictPlayerPerformance(features: number[]): number {
    const weightedSum = features.reduce((sum, feature, index) => sum + feature * (this.weights[index] ?? 0), 0);
    const bounded = 1 / (1 + Math.exp(-((weightedSum - 0.5) * 3.2)));
    return Number(Math.max(0, Math.min(1, bounded)).toFixed(4));
  }
}
