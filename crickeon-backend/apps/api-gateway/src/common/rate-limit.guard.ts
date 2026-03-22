import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisClientFactory } from '@crickeon/infra-redis/redis.client';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly redis = RedisClientFactory.createClient();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 120;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ ip?: string; headers?: Record<string, string | undefined> }>();
    const forwarded = req.headers?.['x-forwarded-for'];
    const key = (forwarded?.split(',')[0]?.trim() || req.ip || 'unknown').replace(/[^a-zA-Z0-9.:_-]/g, '_');
    const now = Date.now();
    const windowId = Math.floor(now / this.windowMs);
    const redisKey = `rate:${key}:${windowId}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, this.windowMs);
    }

    if (count > this.maxRequests) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
