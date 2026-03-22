import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from './common/rate-limit.guard';
import { Roles } from './common/roles.decorator';
import { RolesGuard } from './common/roles.guard';
import { z } from 'zod';
import { Counter, Histogram, Registry } from 'prom-client';

@UseGuards(RateLimitGuard, RolesGuard)
@Controller()
export class GatewayController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL ?? 'http://127.0.0.1:3001/api/v1';
  private readonly auctionServiceUrl = process.env.AUCTION_SERVICE_URL ?? 'http://127.0.0.1:3002/api/v1';
  private readonly matchServiceUrl = process.env.MATCH_SERVICE_URL ?? 'http://127.0.0.1:3003/api/v1';
  private readonly statsServiceUrl = process.env.STATS_SERVICE_URL ?? 'http://127.0.0.1:3004/api/v1';
  private readonly registry = new Registry();
  private readonly requestCounter = new Counter({
    name: 'gateway_http_requests_total',
    help: 'Total gateway forwarded requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry]
  });
  private readonly latencyHistogram = new Histogram({
    name: 'gateway_http_request_duration_ms',
    help: 'Gateway forward latency in ms',
    labelNames: ['method', 'route'],
    buckets: [10, 25, 50, 75, 100, 200, 400, 800, 1600],
    registers: [this.registry]
  });

  @Get('health')
  health() {
    return { service: 'api-gateway', status: 'ok', ts: new Date().toISOString() };
  }

  @Get('metrics')
  async metrics() {
    return this.registry.metrics();
  }

  @Post('auth/login')
  login(@Body() payload: { email: string; password: string }) {
    this.validate(z.object({ email: z.string().email(), password: z.string().min(10) }), payload);
    return this.forward(`${this.authServiceUrl}/auth/login`, 'POST', payload);
  }

  @Post('auth/register')
  register(@Body() payload: { email: string; password: string; displayName: string }) {
    this.validate(z.object({ email: z.string().email(), password: z.string().min(10), displayName: z.string().min(2) }), payload);
    return this.forward(`${this.authServiceUrl}/auth/register`, 'POST', payload);
  }

  @Post('auth/refresh')
  refresh(@Body() payload: { refreshToken: string }) {
    this.validate(z.object({ refreshToken: z.string().min(20) }), payload);
    return this.forward(`${this.authServiceUrl}/auth/refresh`, 'POST', payload);
  }

  @Post('rooms/create')
  createRoom(@Body() payload: { ownerId: string }) {
    return this.forward(`${this.auctionServiceUrl}/rooms/create`, 'POST', payload);
  }

  @Post('rooms/join')
  joinRoom(@Body() payload: { roomId: string; ownerId: string }) {
    return this.forward(`${this.auctionServiceUrl}/rooms/join`, 'POST', payload);
  }

  @Get('players')
  players() {
    return this.forward(`${this.auctionServiceUrl}/players`, 'GET');
  }

  @Post('auction/bid')
  bid(@Body() payload: { roomId: string; auctionId: string; cricketPlayerId: string; ownerId: string; amount: number }) {
    this.validate(z.object({ roomId: z.string().uuid(), auctionId: z.string().uuid(), cricketPlayerId: z.string(), ownerId: z.string().uuid(), amount: z.number().positive() }), payload);
    return this.forward(`${this.auctionServiceUrl}/auction/bid`, 'POST', payload);
  }

  @Post('auction/open')
  openAuction(@Body() payload: { roomId: string; cricketPlayerId: string; role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper' }) {
    this.validate(z.object({ roomId: z.string().uuid(), cricketPlayerId: z.string(), role: z.enum(['batsman', 'bowler', 'all_rounder', 'wicket_keeper']) }), payload);
    return this.forward(`${this.auctionServiceUrl}/auction/open`, 'POST', payload);
  }

  @Get('auction/:auctionId/timer')
  auctionTimer(@Param('auctionId') auctionId: string) {
    return this.forward(`${this.auctionServiceUrl}/auction/${auctionId}/timer`, 'GET');
  }

  @Get('auction/:auctionId/history')
  auctionHistory(@Param('auctionId') auctionId: string) {
    return this.forward(`${this.auctionServiceUrl}/auction/${auctionId}/history`, 'GET');
  }

  @Post('auction/ai/recommend')
  aiRecommend(@Body() payload: { roomId: string; auctionId: string; cricketPlayerId: string; ownerId: string; personality: 'conservative' | 'aggressive' | 'moneyball' }) {
    this.validate(z.object({ roomId: z.string().uuid(), auctionId: z.string().uuid(), cricketPlayerId: z.string(), ownerId: z.string().uuid(), personality: z.enum(['conservative', 'aggressive', 'moneyball']) }), payload);
    return this.forward(`${this.auctionServiceUrl}/auction/ai/recommend`, 'POST', payload);
  }

  @Post('auction/ai/autobid')
  aiAutobid(@Body() payload: { roomId: string; auctionId: string; cricketPlayerId: string; ownerId: string; personality: 'conservative' | 'aggressive' | 'moneyball'; idempotencyKey?: string }) {
    this.validate(z.object({ roomId: z.string().uuid(), auctionId: z.string().uuid(), cricketPlayerId: z.string(), ownerId: z.string().uuid(), personality: z.enum(['conservative', 'aggressive', 'moneyball']), idempotencyKey: z.string().optional() }), payload);
    return this.forward(`${this.auctionServiceUrl}/auction/ai/autobid`, 'POST', payload);
  }

  @Post('league/entry')
  leagueEntry(@Body() payload: { roomId: string; ownerId: string; entryFee: number; platformRakePct?: number }) {
    this.validate(z.object({ roomId: z.string().uuid(), ownerId: z.string().uuid(), entryFee: z.number().positive(), platformRakePct: z.number().min(0).max(30).optional() }), payload);
    return this.forward(`${this.auctionServiceUrl}/league/entry`, 'POST', payload);
  }

  @Get('wallet/:userId')
  wallet(@Param('userId') userId: string) {
    return this.forward(`${this.auctionServiceUrl}/wallet/${userId}`, 'GET');
  }

  @Post('wallet/deposit')
  walletDeposit(@Body() payload: { userId: string; amount: number; reference: string }) {
    this.validate(z.object({ userId: z.string().uuid(), amount: z.number().positive(), reference: z.string().min(3) }), payload);
    return this.forward(`${this.auctionServiceUrl}/wallet/deposit`, 'POST', payload);
  }

  @Post('premium/subscribe')
  premiumSubscribe(@Body() payload: { userId: string; days: number }) {
    this.validate(z.object({ userId: z.string().uuid(), days: z.number().int().min(30).max(365) }), payload);
    return this.forward(`${this.auctionServiceUrl}/premium/subscribe`, 'POST', payload);
  }

  @Get('premium/:userId/entitlements')
  premiumEntitlements(@Param('userId') userId: string) {
    return this.forward(`${this.auctionServiceUrl}/premium/${userId}/entitlements`, 'GET');
  }

  @Post('cosmetics/purchase')
  cosmeticsPurchase(@Body() payload: { userId: string; cosmeticType: string; cosmeticKey: string; price: number }) {
    this.validate(z.object({ userId: z.string().uuid(), cosmeticType: z.string().min(3), cosmeticKey: z.string().min(2), price: z.number().positive() }), payload);
    return this.forward(`${this.auctionServiceUrl}/cosmetics/purchase`, 'POST', payload);
  }

  @Post('growth/daily-reward/:userId')
  growthDailyReward(@Param('userId') userId: string) {
    return this.forward(`${this.auctionServiceUrl}/growth/daily-reward/${userId}`, 'POST');
  }

  @Get('growth/achievements/:userId')
  growthAchievements(@Param('userId') userId: string) {
    return this.forward(`${this.auctionServiceUrl}/growth/achievements/${userId}`, 'GET');
  }

  @Get('growth/leaderboard')
  growthLeaderboard() {
    return this.forward(`${this.auctionServiceUrl}/growth/leaderboard`, 'GET');
  }

  @Post('match/start')
  matchStart(@Body() payload: { matchId: string; teamAId: string; teamBId: string; tossWinner: string; decision: 'bat' | 'bowl'; seed: number; pitch: 'flat' | 'green' | 'dusty' }) {
    this.validate(z.object({
      matchId: z.string(),
      teamAId: z.string().uuid(),
      teamBId: z.string().uuid(),
      tossWinner: z.string().uuid(),
      decision: z.enum(['bat', 'bowl']),
      seed: z.number().int(),
      pitch: z.enum(['flat', 'green', 'dusty'])
    }), payload);
    return this.forward(`${this.matchServiceUrl}/match/start`, 'POST', payload);
  }

  @Post('match/toss')
  toss(@Body() payload: { matchId: string; teamA: string; teamB: string; seed: number }) {
    return this.forward(`${this.matchServiceUrl}/match/toss`, 'POST', payload);
  }

  @Post('match/ball')
  ball(@Body() payload: unknown) {
    return this.forward(`${this.matchServiceUrl}/match/ball`, 'POST', payload);
  }

  @Post('stats/ingest')
  statsIngest(@Body() payload: unknown) {
    return this.forward(`${this.statsServiceUrl}/stats/ingest`, 'POST', payload);
  }

  @Get('stats/scorecard/:matchId')
  scorecard(@Param('matchId') matchId: string) {
    return this.forward(`${this.statsServiceUrl}/stats/scorecard/${matchId}`, 'GET');
  }

  @Post('stats/analytics/event')
  analyticsEvent(@Body() payload: { userId?: string; eventType: string; entityType: string; entityId?: string; payload: Record<string, unknown> }) {
    return this.forward(`${this.statsServiceUrl}/stats/analytics/event`, 'POST', payload);
  }

  @Get('stats/dashboard/top-players')
  dashboardTopPlayers(@Query('limit') limit?: string) {
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : '';
    return this.forward(`${this.statsServiceUrl}/stats/dashboard/top-players${qs}`, 'GET');
  }

  @Get('stats/dashboard/win-rates')
  dashboardWinRates() {
    return this.forward(`${this.statsServiceUrl}/stats/dashboard/win-rates`, 'GET');
  }

  @Get('stats/dashboard/roi')
  dashboardRoi() {
    return this.forward(`${this.statsServiceUrl}/stats/dashboard/roi`, 'GET');
  }

  @Get('stats/dashboard/retention')
  dashboardRetention() {
    return this.forward(`${this.statsServiceUrl}/stats/dashboard/retention`, 'GET');
  }

  @Post('stats/real/sync')
  realSync() {
    return this.forward(`${this.statsServiceUrl}/stats/real/sync`, 'POST');
  }

  @Get('stats/real/matches')
  realMatches() {
    return this.forward(`${this.statsServiceUrl}/stats/real/matches`, 'GET');
  }

  @Get('stats/real/player/:playerId/boost')
  playerBoost(@Param('playerId') playerId: string) {
    return this.forward(`${this.statsServiceUrl}/stats/real/player/${playerId}/boost`, 'GET');
  }

  @Post('match/death-over/decision')
  deathOver(@Body() payload: { matchId: string; aggressiveness: number; yorkerPlan: number }) {
    return this.forward(`${this.matchServiceUrl}/match/death-over/decision`, 'POST', payload);
  }

  @Post('match/super-over/resolve')
  superOver(@Body() payload: { matchId: string; battingSkill: number; bowlingSkill: number; executionScore: number; seed: number }) {
    return this.forward(`${this.matchServiceUrl}/match/super-over/resolve`, 'POST', payload);
  }

  @Get('match/:matchId/replay')
  replay(@Param('matchId') matchId: string, @Query('fromBall') fromBall?: string, @Query('toBall') toBall?: string) {
    const params = new URLSearchParams();
    if (fromBall) params.set('fromBall', fromBall);
    if (toBall) params.set('toBall', toBall);
    const qs = params.toString();
    return this.forward(`${this.matchServiceUrl}/match/${matchId}/replay${qs ? `?${qs}` : ''}`, 'GET');
  }

  @Post('proxy')
  @Roles('admin')
  proxy(@Body() payload: { service: string; path: string; method: string; body?: unknown }) {
    return {
      accepted: true,
      message: 'Gateway proxy contract accepted. Wire service discovery/client in infra layer.',
      payload
    };
  }

  private async forward(url: string, method: string, body?: unknown) {
    const route = new URL(url).pathname;
    const endTimer = this.latencyHistogram.startTimer({ method, route });
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });

    endTimer();
    this.requestCounter.inc({ method, route, status_code: String(response.status) });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      return { error: true, status: response.status, details: parsed };
    }
    return parsed;
  }

  private validate<T>(schema: z.ZodType<T>, payload: unknown): T {
    return schema.parse(payload);
  }
}
