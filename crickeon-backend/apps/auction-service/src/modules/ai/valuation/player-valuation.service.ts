import { Injectable } from '@nestjs/common';

export type PlayerValuationInput = {
  battingAvg: number;
  strikeRate: number;
  bowlingAvg: number;
  economy: number;
  recentForm: number;
  roleScarcity: number;
  matchupStrength: number;
};

export type PlayerValuationBreakdown = {
  battingImpact: number;
  bowlingImpact: number;
  formImpact: number;
  scarcityImpact: number;
  matchupImpact: number;
  valueScore: number;
};

@Injectable()
export class PlayerValuationService {
  private static readonly WEIGHTS = {
    batting: 0.3,
    bowling: 0.3,
    form: 0.2,
    scarcity: 0.1,
    matchup: 0.1
  } as const;

  score(input: PlayerValuationInput): PlayerValuationBreakdown {
    const battingAverageNorm = this.normalizeLinear(input.battingAvg, 10, 70);
    const strikeRateNorm = this.normalizeLinear(input.strikeRate, 80, 220);
    const bowlingAverageNorm = this.normalizeInverse(input.bowlingAvg, 15, 60);
    const economyNorm = this.normalizeInverse(input.economy, 4, 12);
    const formNorm = this.normalizeLinear(input.recentForm, 0.4, 1.8);
    const scarcityNorm = this.clamp01(input.roleScarcity);
    const matchupNorm = this.clamp01(input.matchupStrength);

    const battingImpact = battingAverageNorm * 0.55 + strikeRateNorm * 0.45;
    const bowlingImpact = bowlingAverageNorm * 0.6 + economyNorm * 0.4;

    const combinedScore =
      battingImpact * PlayerValuationService.WEIGHTS.batting +
      bowlingImpact * PlayerValuationService.WEIGHTS.bowling +
      formNorm * PlayerValuationService.WEIGHTS.form +
      scarcityNorm * PlayerValuationService.WEIGHTS.scarcity +
      matchupNorm * PlayerValuationService.WEIGHTS.matchup;

    return {
      battingImpact: this.round2(battingImpact),
      bowlingImpact: this.round2(bowlingImpact),
      formImpact: this.round2(formNorm),
      scarcityImpact: this.round2(scarcityNorm),
      matchupImpact: this.round2(matchupNorm),
      valueScore: this.round2(combinedScore * 100)
    };
  }

  private normalizeLinear(value: number, min: number, max: number) {
    if (max <= min) return 0;
    return this.clamp01((value - min) / (max - min));
  }

  private normalizeInverse(value: number, min: number, max: number) {
    if (max <= min) return 0;
    return this.clamp01((max - value) / (max - min));
  }

  private clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  private round2(value: number) {
    return Number(value.toFixed(2));
  }
}
