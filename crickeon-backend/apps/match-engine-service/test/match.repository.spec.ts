import { MatchRepository } from '../src/modules/match/repositories/match.repository';

describe('MatchRepository', () => {
  it('replays match events with pagination', async () => {
    const prismaMock = {
      ballEvent: {
        findMany: jest.fn().mockResolvedValue([
          { innings: 1, over: 1, ball: 1, runs: 0, eventType: 'dot', commentary: 'dot', metadata: { p: 0.1 }, createdAt: new Date('2026-03-22T10:00:00.000Z') },
          { innings: 1, over: 1, ball: 2, runs: 4, eventType: 'run', commentary: 'four', metadata: { p: 0.2 }, createdAt: new Date('2026-03-22T10:00:10.000Z') }
        ])
      }
    } as any;

    const repository = new MatchRepository(prismaMock);
    const replay = await repository.replayMatch('match-1', 1);

    expect(replay.matchId).toBe('match-1');
    expect(replay.events).toHaveLength(1);
    expect(replay.events[0].runs).toBe(4);
  });

  it('builds aggregate match state from event stream', async () => {
    const prismaMock = {
      ballEvent: {
        findMany: jest.fn().mockResolvedValue([
          { runs: 1, eventType: 'run' },
          { runs: 6, eventType: 'run' },
          { runs: 0, eventType: 'wicket' }
        ])
      }
    } as any;

    const repository = new MatchRepository(prismaMock);
    const state = await repository.getMatchState('match-1');

    expect(state.runs).toBe(7);
    expect(state.wickets).toBe(1);
    expect(state.balls).toBe(3);
  });
});
