import { Injectable } from '@nestjs/common';
import { MatchBallEvent } from '@crickeon/shared-contracts';
import { MatchRealtimeService } from '../infra/redis/match-realtime.service';
import { MatchRepository } from '../modules/match/repositories/match.repository';
import { ProbabilityEngine } from './engine/probability.engine';
import { MatchupModel } from './engine/matchup.model';
import { MomentumSystem } from './engine/momentum.system';
import { PressureSystem } from './engine/pressure.system';
import { FatigueSystem } from './engine/fatigue.system';

type SkillSet = {
  batting: number;
  bowling: number;
  form: number;
  fatigue: number;
};

type Pitch = 'flat' | 'green' | 'dusty';

type LiveModifiers = {
  pressureBoost: number;
  fatigueAdjustment: number;
  momentum: number;
  boundaryStreak: number;
  dotStreak: number;
  wicketsFallen: number;
  score: number;
  balls: number;
  batsmanBalls: Record<string, number>;
  bowlerBalls: Record<string, number>;
};

@Injectable()
export class MatchEngineService {
  private readonly probabilityEngine = new ProbabilityEngine();
  private readonly matchupModel = new MatchupModel();
  private readonly momentumSystem = new MomentumSystem();
  private readonly pressureSystem = new PressureSystem();
  private readonly fatigueSystem = new FatigueSystem();

  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly realtime: MatchRealtimeService
  ) {}

  async startMatch(input: { matchId: string; teamAId: string; teamBId: string; tossWinner: string; decision: 'bat' | 'bowl'; seed: number; pitch: Pitch }) {
    const created = await this.matchRepository.createMatch({
      matchId: input.matchId,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      tossWinnerTeamId: input.tossWinner,
      tossDecision: input.decision,
      pitchType: input.pitch,
      seed: input.seed
    });

    await this.realtime.cacheMatchState(input.matchId, {
      pressureBoost: 0,
      fatigueAdjustment: 0,
      momentum: 0,
      boundaryStreak: 0,
      dotStreak: 0,
      wicketsFallen: 0,
      score: 0,
      balls: 0,
      batsmanBalls: {},
      bowlerBalls: {}
    }, 3600);
    await this.realtime.publishMatchUpdate(input.matchId, { type: 'match_update', status: created.status, seed: created.seed });
    return { accepted: true, ...input, startedAt: new Date().toISOString() };
  }

  toss(input: { matchId: string; teamA: string; teamB: string; seed: number }) {
    const rng = this.seededRng(input.seed);
    const tossWinner = rng() > 0.5 ? input.teamA : input.teamB;
    const decision = rng() > 0.55 ? 'bat' : 'bowl';
    return { matchId: input.matchId, tossWinner, decision };
  }

  async simulateBall(input: {
    matchId: string;
    innings: number;
    over: number;
    ball: number;
    batsmanId: string;
    bowlerId: string;
    batsman: SkillSet;
    bowler: SkillSet;
    pressureIndex: number;
    pitch: Pitch;
    seed: number;
  }): Promise<MatchBallEvent> {
    const meta = await this.matchRepository.getMatchMeta(input.matchId);
    if (!meta) throw new Error('Match not found');

    const live = await this.getLiveModifiers(input.matchId);
    const rng = this.seededRng(input.seed + input.over * 10 + input.ball);

    const batsmanBalls = (live.batsmanBalls[input.batsmanId] ?? 0) + 1;
    const bowlerBalls = (live.bowlerBalls[input.bowlerId] ?? 0) + 1;

    const batFatigue = this.fatigueSystem.batsmanFatigue(batsmanBalls, input.batsman.fatigue + live.fatigueAdjustment * 0.6);
    const bowlFatigue = this.fatigueSystem.bowlerFatigue(bowlerBalls, input.bowler.fatigue + live.fatigueAdjustment * 0.8);

    const batSkill = this.normalizeSkill(input.batsman.batting, input.batsman.form, batFatigue);
    const bowlSkill = this.normalizeSkill(input.bowler.bowling, input.bowler.form, bowlFatigue);
    const pitchModifier = this.pitchModifier(meta.pitchType);

    const currentRunRate = live.balls > 0 ? (live.score * 6) / live.balls : 0;
    const requiredRunRate = 8.5;
    const pressureIndex = this.pressureSystem.compute({
      over: input.over,
      wicketsFallen: live.wicketsFallen,
      requiredRunRate,
      currentRunRate,
      basePressure: Math.min(1, input.pressureIndex + live.pressureBoost)
    });

    const matchup = await this.matchRepository.getPlayerMatchup(input.batsmanId, input.bowlerId);
    const matchupAdvantage = this.matchupModel.advantage(matchup);

    const probabilities = this.probabilityEngine.compute({
      batsmanSkill: batSkill,
      bowlerSkill: bowlSkill,
      pressure: pressureIndex,
      fatigue: (batFatigue + bowlFatigue) / 2,
      momentum: live.momentum,
      matchupAdvantage,
      pitchBattingFactor: pitchModifier.bat,
      pitchBowlingFactor: pitchModifier.bowl
    });

    const sampled = this.probabilityEngine.sample(probabilities, rng);
    const wicket = sampled === 'wicket';
    const runs = sampled === 'dot' || sampled === 'wicket'
      ? 0
      : sampled === 'single'
        ? 1
        : sampled === 'double'
          ? 2
          : sampled === 'boundary'
            ? 4
            : 6;

    const momentumNext = this.momentumSystem.update(
      { value: live.momentum, boundaryStreak: live.boundaryStreak, dotStreak: live.dotStreak },
      sampled
    );

    const event: MatchBallEvent = {
      type: 'MatchBallDelivered',
      matchId: input.matchId,
      innings: input.innings,
      over: input.over,
      ball: input.ball,
      batsmanId: input.batsmanId,
      bowlerId: input.bowlerId,
      runs,
      wicket,
      commentary: this.commentary(runs, wicket, pressureIndex),
      seed: input.seed,
      occurredAt: new Date().toISOString()
    };

    await this.matchRepository.appendBallEvent({
      matchId: input.matchId,
      innings: input.innings,
      over: input.over,
      ball: input.ball,
      runs,
      eventType: wicket ? 'wicket' : 'run',
      batsmanId: input.batsmanId,
      bowlerId: input.bowlerId,
      commentary: event.commentary,
      metadata: {
        seed: input.seed,
        pressureIndex,
        pitch: meta.pitchType,
        wicket,
        probabilities,
        sampled,
        momentum: momentumNext.value,
        fatigue: {
          batsman: batFatigue,
          bowler: bowlFatigue
        },
        matchupAdvantage
      }
    });

    await this.matchRepository.upsertPlayerMatchup({
      batsmanId: input.batsmanId,
      bowlerId: input.bowlerId,
      runs,
      wicket
    });

    const latestState = await this.matchRepository.getMatchState(input.matchId);
    await this.realtime.cacheMatchState(input.matchId, {
      ...live,
      ...latestState,
      momentum: momentumNext.value,
      boundaryStreak: momentumNext.boundaryStreak,
      dotStreak: momentumNext.dotStreak,
      wicketsFallen: live.wicketsFallen + (wicket ? 1 : 0),
      score: live.score + runs,
      balls: live.balls + 1,
      batsmanBalls: {
        ...live.batsmanBalls,
        [input.batsmanId]: batsmanBalls
      },
      bowlerBalls: {
        ...live.bowlerBalls,
        [input.bowlerId]: bowlerBalls
      }
    }, 20);

    return event;
  }

  async applyDeathOverDecision(input: { matchId: string; aggressiveness: number; yorkerPlan: number }) {
    const meta = await this.matchRepository.getMatchMeta(input.matchId);
    if (!meta) return { accepted: false, reason: 'Match not started' };

    const pressureBoost = this.clamp(input.aggressiveness * 0.2, 0, 0.2);
    const fatigueAdjustment = this.clamp(input.yorkerPlan * 0.1, 0, 0.12);

    const current = await this.getLiveModifiers(input.matchId);

    await this.realtime.cacheMatchState(input.matchId, {
      ...current,
      pressureBoost,
      fatigueAdjustment
    }, 600);
    await this.realtime.publishMatchUpdate(input.matchId, {
      type: 'match_update',
      pressureBoost,
      fatigueAdjustment
    });

    return {
      accepted: true,
      matchId: input.matchId,
      pressureBoost,
      fatigueAdjustment
    };
  }

  resolveSuperOver(input: { matchId: string; battingSkill: number; bowlingSkill: number; executionScore: number; seed: number }) {
    const rng = this.seededRng(input.seed + 777);
    const bat = input.battingSkill * 0.45 + input.executionScore * 0.55;
    const bowl = input.bowlingSkill;
    const margin = bat - bowl + rng() * 12;
    const predictedRuns = Math.max(2, Math.min(25, Math.round(10 + margin / 6)));
    return {
      matchId: input.matchId,
      superOverRuns: predictedRuns,
      miniGameApplied: true,
      resolvedAt: new Date().toISOString()
    };
  }

  replay(matchId: string, fromBall = 0, toBall?: number) {
    return this.matchRepository.replayMatch(matchId, fromBall, toBall);
  }

  async snapshot(matchId: string, over: number) {
    const replay = await this.matchRepository.replayMatch(matchId, 0);
    const upto = replay.events.filter((event) => event.over <= over);
    const runs = upto.reduce((sum, event) => sum + event.runs, 0);
    const wickets = upto.filter((event) => event.eventType === 'wicket').length;
    return { matchId, over, runs, wickets, capturedAt: new Date().toISOString() };
  }

  private async getLiveModifiers(matchId: string): Promise<LiveModifiers> {
    const cached = await this.realtime.getCachedMatchState(matchId);
    const pressureBoost = Number(cached?.pressureBoost ?? 0);
    const fatigueAdjustment = Number(cached?.fatigueAdjustment ?? 0);
    return {
      pressureBoost: Number.isFinite(pressureBoost) ? pressureBoost : 0,
      fatigueAdjustment: Number.isFinite(fatigueAdjustment) ? fatigueAdjustment : 0,
      momentum: Number.isFinite(Number(cached?.momentum)) ? Number(cached?.momentum) : 0,
      boundaryStreak: Number.isFinite(Number(cached?.boundaryStreak)) ? Number(cached?.boundaryStreak) : 0,
      dotStreak: Number.isFinite(Number(cached?.dotStreak)) ? Number(cached?.dotStreak) : 0,
      wicketsFallen: Number.isFinite(Number(cached?.wicketsFallen)) ? Number(cached?.wicketsFallen) : 0,
      score: Number.isFinite(Number(cached?.score)) ? Number(cached?.score) : 0,
      balls: Number.isFinite(Number(cached?.balls)) ? Number(cached?.balls) : 0,
      batsmanBalls: (cached?.batsmanBalls as Record<string, number> | undefined) ?? {},
      bowlerBalls: (cached?.bowlerBalls as Record<string, number> | undefined) ?? {}
    };
  }

  private pitchModifier(pitch: Pitch) {
    switch (pitch) {
      case 'green':
        return { bat: 0.92, bowl: 1.08 };
      case 'dusty':
        return { bat: 0.95, bowl: 1.05 };
      default:
        return { bat: 1.04, bowl: 0.96 };
    }
  }

  private normalizeSkill(skill: number, form: number, fatigue: number) {
    const scaled = (skill / 100) * form * (1 - fatigue * 0.45);
    return this.clamp(scaled, 0, 1);
  }

  private commentary(runs: number, wicket: boolean, pressure: number) {
    if (wicket) return pressure > 0.8 ? 'Huge wicket under extreme pressure!' : 'Bowled! Timber disturbed.';
    if (runs === 6) return 'Launched over long-on for a maximum!';
    if (runs === 4) return 'Pierced the infield, races away to the fence.';
    if (runs === 0) return 'Dot ball, good discipline from the bowler.';
    return `${runs} run${runs > 1 ? 's' : ''} taken.`;
  }

  private seededRng(seed: number) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}
