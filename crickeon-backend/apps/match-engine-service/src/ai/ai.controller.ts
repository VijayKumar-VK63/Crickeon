import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggest-bid')
  suggestBid(@Body() dto: { budget: number; currentPrice: number; roleScarcity: number; demandIndex: number }) {
    return this.aiService.suggestBid(dto);
  }

  @Post('suggest-field')
  suggestField(@Body() dto: { batterStyle: 'right' | 'left'; runRate: number; wicketNeed: number }) {
    return this.aiService.suggestField(dto);
  }

  @Post('suggest-bowler')
  suggestBowler(@Body() dto: { over: number; requiredRate: number; bowlers: Array<{ id: string; economy: number; fatigue: number }> }) {
    return this.aiService.suggestBowler(dto);
  }
}
