import { randomUUID } from 'crypto';
import type Redis from 'ioredis';

export type LockHandle = {
  resource: string;
  token: string;
  expiresAt: number;
};

export class RedisLockService {
  private readonly heldLocks = new Map<string, string>();

  constructor(private readonly redis: Redis) {}

  async acquireLock(resource: string, ttlMs: number, maxRetries = 8, baseDelayMs = 15): Promise<LockHandle> {
    const lockKey = `lock:${resource}`;
    const token = randomUUID();

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        this.heldLocks.set(resource, token);
        return { resource, token, expiresAt: Date.now() + ttlMs };
      }

      if (attempt === maxRetries) break;
      const backoff = baseDelayMs * 2 ** Math.min(attempt, 5) + Math.floor(Math.random() * 9);
      await this.sleep(backoff);
    }

    throw new Error(`Failed to acquire distributed lock for resource=${resource}`);
  }

  async releaseLock(resource: string): Promise<boolean> {
    const token = this.heldLocks.get(resource);
    if (!token) return false;

    const lockKey = `lock:${resource}`;
    const releaseScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    const released = await this.redis.eval(releaseScript, 1, lockKey, token);
    this.heldLocks.delete(resource);
    return Number(released) === 1;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
