import { RedisLockService } from '@lamcl/infra-locks/redis-lock.service';

describe('RedisLockService', () => {
  it('acquires and releases lock with token ownership', async () => {
    const state = new Map<string, string>();
    const redisMock = {
      set: jest.fn(async (key: string, value: string, _px: string, _ttl: number, nx: string) => {
        if (nx !== 'NX') return null;
        if (state.has(key)) return null;
        state.set(key, value);
        return 'OK';
      }),
      eval: jest.fn(async (_script: string, _keys: number, key: string, token: string) => {
        if (state.get(key) === token) {
          state.delete(key);
          return 1;
        }
        return 0;
      })
    } as any;

    const lockService = new RedisLockService(redisMock);
    const lock = await lockService.acquireLock('auction:1', 500, 1, 1);

    expect(lock.resource).toBe('auction:1');
    const released = await lockService.releaseLock('auction:1');
    expect(released).toBe(true);
  });
});
