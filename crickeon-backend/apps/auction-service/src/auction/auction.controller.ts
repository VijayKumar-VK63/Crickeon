import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlayerRole } from '@crickeon/shared-contracts';
import { AuctionService } from './auction.service';
import { AiAutoBidDto, AiDecisionDto, CosmeticPurchaseDto, CreateRoomDto, JoinRoomDto, LeagueEntryDto, PlaceBidDto, PremiumSubscribeDto, WalletDepositDto } from './auction.dto';

@Controller()
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get('health')
  health() {
    return { service: 'auction-service', status: 'ok', ts: new Date().toISOString() };
  }

  @Post('rooms/create')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.auctionService.createRoom(dto);
  }

  @Get('players')
  players() {
    return this.auctionService.getPlayers();
  }

  @Post('rooms/join')
  joinRoom(@Body() dto: JoinRoomDto) {
    return this.auctionService.joinRoom(dto);
  }

  @Get('rooms/:roomId')
  room(@Param('roomId') roomId: string) {
    return this.auctionService.getRoom(roomId);
  }

  @Post('rooms/:roomId/start-match')
  startMatch(@Param('roomId') roomId: string) {
    return this.auctionService.startMatchPhase(roomId);
  }

  @Post('rooms/:roomId/results')
  results(@Param('roomId') roomId: string) {
    return this.auctionService.markResultsPhase(roomId);
  }

  @Post('auction/open')
  openAuction(@Body() dto: { roomId: string; cricketPlayerId: string; role: PlayerRole }) {
    return this.auctionService.openAuction(dto.roomId, dto.cricketPlayerId, dto.role);
  }

  @Post('auction/bid')
  bid(@Body() dto: PlaceBidDto) {
    return this.auctionService.placeBid(dto);
  }

  @Post('auction/ai/recommend')
  aiRecommend(@Body() dto: AiDecisionDto) {
    return this.auctionService.getAiRecommendation(dto);
  }

  @Post('auction/ai/autobid')
  aiAutoBid(@Body() dto: AiAutoBidDto) {
    return this.auctionService.requestAiAutoBid(dto);
  }

  @Get('auction/ai/dataset')
  aiDataset() {
    return this.auctionService.getAiTrainingDataset();
  }

  @Post('auction/settle/:auctionId')
  settle(@Param('auctionId') auctionId: string) {
    return this.auctionService.settleAuction(auctionId);
  }

  @Get('auction/:auctionId/history')
  history(@Param('auctionId') auctionId: string) {
    return this.auctionService.getBidHistory(auctionId);
  }

  @Get('auction/:auctionId/timer')
  timer(@Param('auctionId') auctionId: string) {
    return this.auctionService.getAuctionTimer(auctionId);
  }

  @Get('teams/:ownerId')
  team(@Param('ownerId') ownerId: string) {
    return this.auctionService.getSquad(ownerId);
  }

  @Get('teams/:ownerId/validate')
  validateTeam(@Param('ownerId') ownerId: string) {
    return this.auctionService.validateSquad(ownerId);
  }

  @Get('teams/:ownerId/budget')
  budget(@Param('ownerId') ownerId: string) {
    return this.auctionService.getBudget(ownerId);
  }

  @Get('wallet/:userId')
  wallet(@Param('userId') userId: string) {
    return this.auctionService.getWallet(userId);
  }

  @Post('wallet/deposit')
  walletDeposit(@Body() dto: WalletDepositDto) {
    return this.auctionService.depositWallet(dto);
  }

  @Post('league/entry')
  joinPaidLeague(@Body() dto: LeagueEntryDto) {
    return this.auctionService.joinPaidLeague(dto);
  }

  @Post('premium/subscribe')
  subscribePremium(@Body() dto: PremiumSubscribeDto) {
    return this.auctionService.subscribePremium(dto);
  }

  @Get('premium/:userId/entitlements')
  premiumEntitlements(@Param('userId') userId: string) {
    return this.auctionService.premiumEntitlements(userId);
  }

  @Post('cosmetics/purchase')
  purchaseCosmetic(@Body() dto: CosmeticPurchaseDto) {
    return this.auctionService.purchaseCosmetic(dto);
  }

  @Post('growth/daily-reward/:userId')
  claimDailyReward(@Param('userId') userId: string) {
    return this.auctionService.claimDailyReward(userId);
  }

  @Get('growth/achievements/:userId')
  achievements(@Param('userId') userId: string) {
    return this.auctionService.getUserAchievements(userId);
  }

  @Get('growth/leaderboard')
  leaderboard() {
    return this.auctionService.getLeaderboard();
  }
}
