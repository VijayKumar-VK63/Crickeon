import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlayerRole, RoomState } from '@crickeon/shared-contracts';
import { AiAutoBidDto, AiDecisionDto, CosmeticPurchaseDto, CreateRoomDto, JoinRoomDto, LeagueEntryDto, PlaceBidDto, PremiumSubscribeDto, WalletDepositDto } from './auction.dto';
import { AuctionRealtimeService } from '../infra/redis/auction-realtime.service';
import { AuctionRepository } from '../modules/auction/repositories/auction.repository';
import { AuctionLockService } from '../infra/locks/auction-lock.service';
import { BiddingStrategyService, BidDecision, TeamState } from '../modules/ai/strategy/bidding-strategy.service';
import { DatasetBuilder } from '../modules/ai/data/dataset.builder';
import { MonetizationService } from '../modules/monetization/monetization.service';
import { GrowthService } from '../modules/growth/growth.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly aiBidInflight = new Set<string>();

  constructor(
    private readonly auctionRepository: AuctionRepository,
    private readonly realtime: AuctionRealtimeService,
    private readonly lockService: AuctionLockService,
    private readonly aiStrategy: BiddingStrategyService,
    private readonly datasetBuilder: DatasetBuilder,
    private readonly monetizationService: MonetizationService,
    private readonly growthService: GrowthService
  ) {}

  getPlayers() {
    return this.auctionRepository.getPlayers();
  }

  async getRoom(roomId: string) {
    const room = await this.auctionRepository.getRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async startMatchPhase(roomId: string) {
    const room = await this.auctionRepository.getRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.state !== RoomState.AUCTION) throw new BadRequestException('Room must be in auction phase');
    return this.auctionRepository.setRoomState(roomId, RoomState.MATCH);
  }

  async markResultsPhase(roomId: string) {
    const room = await this.auctionRepository.getRoom(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.state !== RoomState.MATCH) throw new BadRequestException('Room must be in match phase');
    return this.auctionRepository.setRoomState(roomId, RoomState.RESULTS);
  }

  createRoom(dto: CreateRoomDto) {
    return this.auctionRepository.createRoom(dto.ownerId);
  }

  joinRoom(dto: JoinRoomDto) {
    return this.auctionRepository.joinRoom(dto.roomId, dto.ownerId);
  }

  openAuction(roomId: string, cricketPlayerId: string, role: PlayerRole) {
    return this.auctionRepository.openAuction(roomId, cricketPlayerId, role);
  }

  async placeBid(dto: PlaceBidDto) {
    await this.validateBidAntiCheat(dto);
    const bid = await this.lockService.runWithAuctionLock(dto.auctionId, () => this.auctionRepository.placeBid(dto));
    await this.realtime.cacheAuctionTimer(dto.auctionId, bid.remainingMs);

    return {
      auction: {
        id: bid.auctionId,
        roomId: bid.roomId,
        cricketPlayerId: bid.cricketPlayerId,
        currentPrice: bid.currentPrice,
        endsAt: Date.now() + bid.remainingMs
      },
      event: {
        type: 'AuctionBidPlaced',
        roomId: bid.roomId,
        auctionId: bid.auctionId,
        cricketPlayerId: bid.cricketPlayerId,
        ownerId: bid.ownerId,
        amount: bid.currentPrice,
        currentPrice: bid.currentPrice,
        remainingMs: bid.remainingMs,
        occurredAt: bid.occurredAt
      },
      idempotentReplay: bid.idempotentReplay,
      demandIndex: bid.demandIndex,
      roleScarcityIndex: bid.roleScarcityIndex
    };
  }

  async getAiRecommendation(dto: AiDecisionDto) {
    const [teamState, auctionState] = await Promise.all([
      this.buildTeamState(dto.ownerId),
      this.buildAuctionState(dto.auctionId, dto.roomId, dto.cricketPlayerId)
    ]);

    const fallback = this.deterministicFallback(teamState, auctionState.currentPrice, auctionState.minIncrement, dto.personality);
    const decision = await this.safeTimedDecision(dto, teamState, auctionState, fallback);

    return {
      mode: 'coach',
      ownerId: dto.ownerId,
      auctionId: dto.auctionId,
      playerId: dto.cricketPlayerId,
      decision,
      decisionLatencyMs: decision.personality === 'fallback' ? 45 : undefined
    };
  }

  async requestAiAutoBid(dto: AiAutoBidDto) {
    const lockKey = `${dto.auctionId}:${dto.ownerId}`;
    if (this.aiBidInflight.has(lockKey)) {
      return { queued: false, reason: 'AI bid already in progress for owner/auction', auctionId: dto.auctionId, ownerId: dto.ownerId };
    }

    this.aiBidInflight.add(lockKey);
    setImmediate(() => {
      void this.executeAiAutoBid(dto)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`AI autobid failed for ${lockKey}: ${message}`);
        })
        .finally(() => {
          this.aiBidInflight.delete(lockKey);
        });
    });

    return {
      queued: true,
      mode: 'virtual-bidder',
      ownerId: dto.ownerId,
      auctionId: dto.auctionId,
      personality: dto.personality
    };
  }

  async getAiTrainingDataset() {
    const dataset = await this.datasetBuilder.buildTrainingDataset(500);
    return {
      generatedAt: dataset.generatedAt,
      size: dataset.size,
      featureOrder: dataset.featureOrder,
      preview: dataset.rows.slice(0, 100)
    };
  }

  getWallet(userId: string) {
    return this.monetizationService.getWallet(userId);
  }

  depositWallet(dto: WalletDepositDto) {
    return this.monetizationService.deposit(dto);
  }

  joinPaidLeague(dto: LeagueEntryDto) {
    return this.monetizationService.joinPaidLeague(dto);
  }

  subscribePremium(dto: PremiumSubscribeDto) {
    return this.monetizationService.subscribePremium(dto);
  }

  premiumEntitlements(userId: string) {
    return this.monetizationService.premiumEntitlements(userId);
  }

  purchaseCosmetic(dto: CosmeticPurchaseDto) {
    return this.monetizationService.purchaseCosmetic(dto);
  }

  claimDailyReward(userId: string) {
    return this.growthService.claimDailyReward(userId);
  }

  getUserAchievements(userId: string) {
    return this.growthService.getUserAchievements(userId);
  }

  getLeaderboard() {
    return this.growthService.leaderboard();
  }

  settleAuction(auctionId: string) {
    return this.auctionRepository.settleAuction(auctionId);
  }

  getSquad(ownerId: string) {
    return this.auctionRepository.getSquad(ownerId);
  }

  getBudget(ownerId: string) {
    return this.auctionRepository.getBudget(ownerId);
  }

  async getBidHistory(auctionId: string) {
    const bids = await this.auctionRepository.getBidHistory(auctionId);
    return {
      auctionId,
      bidCount: bids.length,
      bids
    };
  }

  async getAuctionTimer(auctionId: string) {
    const cached = await this.realtime.getAuctionTimer(auctionId);
    const auction = await this.auctionRepository.getAuctionSnapshot(auctionId);
    if (!auction) throw new NotFoundException('Auction not found');

    const computedRemaining = Math.max(0, auction.endsAt.getTime() - Date.now());
    const remainingMs = cached ?? computedRemaining;

    return {
      auctionId,
      remainingMs,
      currentPrice: Number(auction.currentPrice),
      highestBidderId: auction.highestBidderUserId ?? undefined
    };
  }

  async validateSquad(ownerId: string) {
    const squad = await this.auctionRepository.getSquad(ownerId);
    const composition = squad.composition;
    const errors: string[] = [];

    if (squad.players.length < 11) errors.push('Squad has fewer than 11 players.');
    if (squad.players.length > 15) errors.push('Squad exceeds 15 players (11 + 4 substitutes max).');
    if (composition[PlayerRole.WICKET_KEEPER] < 1) errors.push('At least 1 wicketkeeper required.');
    if (composition[PlayerRole.BOWLER] < 3) errors.push('At least 3 bowlers required.');
    if (composition[PlayerRole.BATSMAN] < 3) errors.push('At least 3 batsmen required.');
    if (composition[PlayerRole.ALL_ROUNDER] < 1) errors.push('At least 1 all-rounder required.');

    return {
      ownerId,
      valid: errors.length === 0,
      errors,
      chemistryScore: squad.chemistryScore,
      composition,
      squadSize: squad.players.length
    };
  }

  private async executeAiAutoBid(dto: AiAutoBidDto) {
    const recommendation = await this.getAiRecommendation(dto);
    const decision = recommendation.decision as BidDecision;
    if (!decision.shouldBid) {
      return { placed: false, reason: decision.reason };
    }

    return this.placeBid({
      roomId: dto.roomId,
      auctionId: dto.auctionId,
      cricketPlayerId: dto.cricketPlayerId,
      ownerId: dto.ownerId,
      amount: decision.bidAmount,
      idempotencyKey: dto.idempotencyKey ?? `ai-${dto.ownerId}-${dto.auctionId}-${decision.bidAmount}`
    });
  }

  private async buildTeamState(ownerId: string): Promise<TeamState> {
    const [budget, squad] = await Promise.all([this.auctionRepository.getBudget(ownerId), this.auctionRepository.getSquad(ownerId)]);
    return {
      ownerId,
      budgetRemaining: budget.budgetRemaining,
      composition: squad.composition,
      squadSize: squad.players.length
    };
  }

  private async buildAuctionState(auctionId: string, roomId: string, cricketPlayerId: string) {
    const [snapshot, history] = await Promise.all([
      this.auctionRepository.getAuctionSnapshot(auctionId),
      this.auctionRepository.getBidHistory(auctionId)
    ]);
    if (!snapshot) throw new NotFoundException('Auction not found');

    const since = Date.now() - 15_000;
    const recentCount = history.filter((entry) => new Date(entry.occurredAt).getTime() >= since).length;

    return {
      roomId,
      auctionId,
      cricketPlayerId,
      currentPrice: Number(snapshot.currentPrice),
      demandIndex: Math.min(1, recentCount / 8),
      minIncrement: this.getMinIncrement(Number(snapshot.currentPrice))
    };
  }

  private async safeTimedDecision(dto: AiDecisionDto, teamState: TeamState, auctionState: { roomId: string; auctionId: string; cricketPlayerId: string; currentPrice: number; demandIndex: number; minIncrement: number }, fallback: BidDecision) {
    const strategyPromise = this.aiStrategy
      .decideBid(dto.cricketPlayerId, teamState, auctionState, dto.personality)
      .catch(() => fallback);
    const timeoutPromise = new Promise<BidDecision>((resolve) => {
      setTimeout(() => resolve(fallback), 45);
    });

    return Promise.race([strategyPromise, timeoutPromise]);
  }

  private deterministicFallback(teamState: TeamState, currentPrice: number, minIncrement: number, personality: 'conservative' | 'aggressive' | 'moneyball'): BidDecision {
    const profileCap = personality === 'aggressive' ? 0.18 : personality === 'moneyball' ? 0.14 : 0.11;
    const maxAffordable = Math.max(currentPrice + minIncrement, Math.min(teamState.budgetRemaining, Math.round(teamState.budgetRemaining * profileCap)));
    const proposed = currentPrice + minIncrement;
    const shouldBid = proposed <= maxAffordable && proposed <= teamState.budgetRemaining;

    return {
      shouldBid,
      bidAmount: shouldBid ? proposed : currentPrice,
      confidence: shouldBid ? 0.5 : 0.35,
      valueScore: 50,
      maxAffordable,
      reason: 'deterministic fallback strategy',
      personality: 'fallback',
      modelScore: 0.5
    };
  }

  private getMinIncrement(currentPrice: number) {
    if (currentPrice < 500_000) return 25_000;
    if (currentPrice < 2_000_000) return 50_000;
    return 100_000;
  }

  private async validateBidAntiCheat(dto: PlaceBidDto) {
    const [history, snapshot] = await Promise.all([
      this.auctionRepository.getBidHistory(dto.auctionId),
      this.auctionRepository.getAuctionSnapshot(dto.auctionId)
    ]);
    if (!snapshot) throw new NotFoundException('Auction not found');

    const recentWindow = Date.now() - 8_000;
    const rapidBids = history.filter((entry) => entry.ownerId === dto.ownerId && new Date(entry.occurredAt).getTime() >= recentWindow).length;
    if (rapidBids >= 6) {
      throw new BadRequestException('Bid throttled by anti-cheat controls');
    }

    const currentPrice = Number(snapshot.currentPrice);
    if (dto.amount > currentPrice * 3) {
      throw new BadRequestException('Bid amount violates anti-cheat jump rules');
    }
  }
}
