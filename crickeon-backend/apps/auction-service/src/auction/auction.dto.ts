import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const AI_PERSONALITIES = ['conservative', 'aggressive', 'moneyball'] as const;
export type AIPersonalityDto = typeof AI_PERSONALITIES[number];

export class CreateRoomDto {
  @IsString()
  ownerId!: string;
}

export class JoinRoomDto {
  @IsString()
  roomId!: string;

  @IsString()
  ownerId!: string;
}

export class PlaceBidDto {
  @IsString()
  roomId!: string;

  @IsString()
  auctionId!: string;

  @IsString()
  cricketPlayerId!: string;

  @IsString()
  ownerId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class AiDecisionDto {
  @IsString()
  roomId!: string;

  @IsString()
  auctionId!: string;

  @IsString()
  cricketPlayerId!: string;

  @IsString()
  ownerId!: string;

  @IsIn(AI_PERSONALITIES)
  personality!: AIPersonalityDto;
}

export class AiAutoBidDto extends AiDecisionDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class WalletDepositDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  reference!: string;
}

export class LeagueEntryDto {
  @IsString()
  roomId!: string;

  @IsString()
  ownerId!: string;

  @IsNumber()
  @Min(1)
  entryFee!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  platformRakePct?: number;
}

export class PremiumSubscribeDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @Min(30)
  days!: number;
}

export class CosmeticPurchaseDto {
  @IsString()
  userId!: string;

  @IsString()
  cosmeticType!: string;

  @IsString()
  cosmeticKey!: string;

  @IsNumber()
  @Min(1)
  price!: number;
}
