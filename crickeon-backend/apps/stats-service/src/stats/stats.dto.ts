import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TrackAnalyticsEventDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  eventType!: string;

  @IsString()
  entityType!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class TopPlayersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
