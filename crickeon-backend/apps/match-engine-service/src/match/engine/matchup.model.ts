export type MatchupFeatures = {
  runsScored: number;
  ballsFaced: number;
  dismissals: number;
};

export class MatchupModel {
  advantage(input: MatchupFeatures | null) {
    if (!input || input.ballsFaced === 0) return 0;
    const strikeRate = (input.runsScored / input.ballsFaced) * 100;
    const dismissalRate = input.dismissals / input.ballsFaced;
    const score = (strikeRate - 110) / 120 - dismissalRate * 1.1;
    return Math.max(-1, Math.min(1, score));
  }
}
