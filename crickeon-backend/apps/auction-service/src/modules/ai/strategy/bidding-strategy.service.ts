import { Injectable, NotFoundException } from '@nestjs/common';
import { PlayerRole } from '@crickeon/shared-contracts';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { PlayerValuationService } from '../valuation/player-valuation.service';
import { LinearModel } from '../ml/linear-model';
import { PlayerPerformanceModel } from '../ml/model.interface';

export type AIPersonality = 'conservative' | 'aggressive' | 'moneyball';
export type BidDecisionPersonality = AIPersonality | 'fallback';

export type TeamState = {
  ownerId: string;
  budgetRemaining: number;
  composition: Record<PlayerRole, number>;
  squadSize: number;
};

export type AuctionState = {
  roomId: string;
  auctionId: string;
  cricketPlayerId: string;
  currentPrice: number;
  demandIndex: number;
  minIncrement: number;
};

export type BidDecision = {
  shouldBid: boolean;
  bidAmount: number;
  confidence: number;
  valueScore: number;
  maxAffordable: number;
  reason: string;
  personality: BidDecisionPersonality;
  modelScore: number;
};

type PersonalityConfig = {
  budgetCap: number;
  confidenceThreshold: number;
  incrementFactor: number;
  demandSensitivity: number;
  stopLossMultiplier: number;
  targetRoleWeight: number;
};

@Injectable()
export class BiddingStrategyService {
  private readonly model: PlayerPerformanceModel;

  private readonly personalityConfigs: Record<AIPersonality, PersonalityConfig> = {
    conservative: {
      budgetCap: 0.12,
      confidenceThreshold: 0.58,
      incrementFactor: 1,
      demandSensitivity: 0.75,
      stopLossMultiplier: 0.95,
      targetRoleWeight: 0.6
    },
    aggressive: {
      budgetCap: 0.24,
      confidenceThreshold: 0.46,
      incrementFactor: 1.6,
      demandSensitivity: 0.35,
      stopLossMultiplier: 1.15,
      targetRoleWeight: 0.85
    },
    moneyball: {
      budgetCap: 0.16,
      confidenceThreshold: 0.52,
      incrementFactor: 1.2,
      demandSensitivity: 0.55,
      stopLossMultiplier: 1.02,
      targetRoleWeight: 0.7
    }
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly valuation: PlayerValuationService
  ) {
    this.model = new LinearModel();
  }

  async decideBid(
    playerId: string,
    teamState: TeamState,
    auctionState: AuctionState,
    personality: AIPersonality
  ): Promise<BidDecision> {
    const player = await this.prisma.player.findFirst({
      where: { OR: [{ id: playerId }, { externalRef: playerId }] },
      select: {
        id: true,
        role: true,
        battingAvg: true,
        strikeRate: true,
        bowlingAvg: true,
        economy: true,
        formIndex: true
      }
    });

    if (!player) throw new NotFoundException('Player not found for AI strategy');

    const roleScarcity = this.calculateRoleScarcity(player.role as PlayerRole, teamState.composition, teamState.squadSize);
    const matchupStrength = await this.estimateMatchupStrength(player.id, player.role as PlayerRole);

    const valuation = this.valuation.score({
      battingAvg: Number(player.battingAvg),
      strikeRate: Number(player.strikeRate),
      bowlingAvg: Number(player.bowlingAvg),
      economy: Number(player.economy),
      recentForm: Number(player.formIndex),
      roleScarcity,
      matchupStrength
    });

    const featureVector = [
      valuation.battingImpact,
      valuation.bowlingImpact,
      valuation.formImpact,
      valuation.scarcityImpact,
      valuation.matchupImpact,
      this.clamp01(1 - auctionState.demandIndex),
      this.clamp01(teamState.budgetRemaining / 10_000_000)
    ];
    const modelScore = this.model.predictPlayerPerformance(featureVector);

    const profile = this.personalityConfigs[personality];
    const roleNeed = this.roleNeedFactor(player.role as PlayerRole, teamState.composition);
    const valueScalar = valuation.valueScore / 100;

    const baseCeiling =
      teamState.budgetRemaining *
      profile.budgetCap *
      (0.75 + valueScalar * 0.7 + roleNeed * profile.targetRoleWeight + modelScore * 0.35);

    const demandPenalty = 1 - auctionState.demandIndex * profile.demandSensitivity;
    const targetCeilingRaw = baseCeiling * demandPenalty * profile.stopLossMultiplier;
    const maxAffordable = Math.max(
      auctionState.currentPrice + auctionState.minIncrement,
      Math.min(teamState.budgetRemaining, Math.round(targetCeilingRaw))
    );

    const valuePerCost = valuation.valueScore / Math.max(1, auctionState.currentPrice / 100_000);
    const increment = Math.max(auctionState.minIncrement, Math.round(auctionState.minIncrement * profile.incrementFactor));
    const proposedBid = auctionState.currentPrice + increment;

    const confidence = this.computeConfidence({
      valueScalar,
      roleNeed,
      demand: auctionState.demandIndex,
      modelScore,
      valuePerCost,
      personality
    });

    const shouldBid =
      proposedBid <= maxAffordable &&
      proposedBid <= teamState.budgetRemaining &&
      confidence >= profile.confidenceThreshold &&
      (personality !== 'moneyball' || valuePerCost >= 16.5);

    return {
      shouldBid,
      bidAmount: shouldBid ? proposedBid : auctionState.currentPrice,
      confidence: Number(confidence.toFixed(3)),
      valueScore: valuation.valueScore,
      maxAffordable,
      reason: shouldBid ? this.reasonForBid(personality, valuePerCost, roleNeed) : this.reasonForPass(personality, confidence, maxAffordable, proposedBid),
      personality,
      modelScore
    };
  }

  private async estimateMatchupStrength(playerId: string, role: PlayerRole) {
    if (role === PlayerRole.BATSMAN || role === PlayerRole.ALL_ROUNDER || role === PlayerRole.WICKET_KEEPER) {
      const rows = await this.prisma.playerMatchup.findMany({ where: { batsmanId: playerId }, take: 30 });
      if (!rows.length) return 0.5;
      const score = rows.reduce((sum, row) => {
        const balls = Math.max(1, row.ballsFaced);
        const rpb = row.runsScored / balls;
        const dismissalRate = row.dismissals / balls;
        return sum + this.clamp01(0.45 + rpb * 0.4 - dismissalRate * 0.75);
      }, 0);
      return Number((score / rows.length).toFixed(3));
    }

    const rows = await this.prisma.playerMatchup.findMany({ where: { bowlerId: playerId }, take: 30 });
    if (!rows.length) return 0.5;
    const score = rows.reduce((sum, row) => {
      const balls = Math.max(1, row.ballsFaced);
      const rpb = row.runsScored / balls;
      const dismissalRate = row.dismissals / balls;
      return sum + this.clamp01(0.5 + dismissalRate * 0.7 - rpb * 0.35);
    }, 0);
    return Number((score / rows.length).toFixed(3));
  }

  private calculateRoleScarcity(role: PlayerRole, composition: Record<PlayerRole, number>, squadSize: number) {
    const targets: Record<PlayerRole, number> = {
      [PlayerRole.BATSMAN]: 4,
      [PlayerRole.BOWLER]: 4,
      [PlayerRole.ALL_ROUNDER]: 2,
      [PlayerRole.WICKET_KEEPER]: 1
    };

    const current = composition[role] ?? 0;
    const missing = Math.max(0, targets[role] - current);
    const remainingSlots = Math.max(1, 15 - squadSize);
    return this.clamp01(0.2 + (missing / Math.max(1, targets[role])) * 0.65 + 0.15 * (remainingSlots <= 3 ? 1 : 0));
  }

  private roleNeedFactor(role: PlayerRole, composition: Record<PlayerRole, number>) {
    const targets: Record<PlayerRole, number> = {
      [PlayerRole.BATSMAN]: 4,
      [PlayerRole.BOWLER]: 4,
      [PlayerRole.ALL_ROUNDER]: 2,
      [PlayerRole.WICKET_KEEPER]: 1
    };
    const current = composition[role] ?? 0;
    return this.clamp01((targets[role] - current) / Math.max(1, targets[role]));
  }

  private computeConfidence(input: {
    valueScalar: number;
    roleNeed: number;
    demand: number;
    modelScore: number;
    valuePerCost: number;
    personality: AIPersonality;
  }) {
    const personalityBias = input.personality === 'aggressive' ? 0.08 : input.personality === 'conservative' ? -0.04 : 0;
    const moneyballBoost = input.personality === 'moneyball' ? this.clamp01((input.valuePerCost - 12) / 16) * 0.12 : 0;
    const confidence =
      input.valueScalar * 0.4 +
      input.roleNeed * 0.2 +
      (1 - input.demand) * 0.15 +
      input.modelScore * 0.25 +
      personalityBias +
      moneyballBoost;

    return this.clamp01(confidence);
  }

  private reasonForBid(personality: AIPersonality, valuePerCost: number, roleNeed: number) {
    if (personality === 'moneyball') return `undervalued target detected (value/cost=${valuePerCost.toFixed(1)})`;
    if (personality === 'aggressive') return `high upside profile with role need ${roleNeed.toFixed(2)}`;
    return `balanced value fit with controlled risk`; 
  }

  private reasonForPass(personality: AIPersonality, confidence: number, maxAffordable: number, proposedBid: number) {
    return `${personality} profile passed (confidence=${confidence.toFixed(2)}, proposed=${proposedBid}, max=${maxAffordable})`;
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }
}
