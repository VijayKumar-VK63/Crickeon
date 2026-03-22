import { MatchupModel } from '../src/match/engine/matchup.model';
import { MomentumSystem } from '../src/match/engine/momentum.system';
import { PressureSystem } from '../src/match/engine/pressure.system';
import { FatigueSystem } from '../src/match/engine/fatigue.system';

describe('Engine sub-systems', () => {
  it('produces positive matchup advantage for dominant batsman history', () => {
    const model = new MatchupModel();
    const score = model.advantage({ runsScored: 64, ballsFaced: 32, dismissals: 0 });
    expect(score).toBeGreaterThan(0);
  });

  it('increases momentum on consecutive boundaries', () => {
    const momentum = new MomentumSystem();
    const s1 = momentum.update({ value: 0, boundaryStreak: 0, dotStreak: 0 }, 'boundary');
    const s2 = momentum.update(s1, 'six');
    expect(s2.value).toBeGreaterThan(s1.value);
  });

  it('raises pressure in death overs with wickets and required run rate gap', () => {
    const pressure = new PressureSystem();
    const low = pressure.compute({ over: 8, wicketsFallen: 1, requiredRunRate: 7, currentRunRate: 7.2, basePressure: 0.2 });
    const high = pressure.compute({ over: 18, wicketsFallen: 6, requiredRunRate: 11, currentRunRate: 7.2, basePressure: 0.5 });
    expect(high).toBeGreaterThan(low);
  });

  it('accumulates fatigue over workload', () => {
    const fatigue = new FatigueSystem();
    expect(fatigue.batsmanFatigue(40, 0.1)).toBeGreaterThan(fatigue.batsmanFatigue(5, 0.1));
    expect(fatigue.bowlerFatigue(24, 0.05)).toBeGreaterThan(fatigue.bowlerFatigue(6, 0.05));
  });
});
