export class FatigueSystem {
  batsmanFatigue(ballsFaced: number, baseFatigue: number) {
    const fatigue = baseFatigue + ballsFaced * 0.0035;
    return Math.max(0, Math.min(1, fatigue));
  }

  bowlerFatigue(ballsBowled: number, baseFatigue: number) {
    const fatigue = baseFatigue + ballsBowled * 0.0042;
    return Math.max(0, Math.min(1, fatigue));
  }
}
