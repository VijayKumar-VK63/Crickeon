import { OutboxWorker } from '@lamcl/infra-outbox/outbox.worker';

describe('OutboxWorker', () => {
  it('marks events processed after successful publish', async () => {
    const repository = {
      claimPending: jest.fn().mockResolvedValue([
        {
          id: 'e1',
          aggregateType: 'match',
          aggregateId: 'm1',
          eventType: 'MatchBallDelivered',
          payload: { type: 'score_update' },
          status: 'processing',
          createdAt: new Date(),
          attempts: 1
        }
      ]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markPending: jest.fn().mockResolvedValue(undefined)
    } as any;

    const publisher = jest.fn().mockResolvedValue(undefined);
    const worker = new OutboxWorker(repository, publisher, { intervalMs: 5000, batchSize: 10 });

    await worker.tick();

    expect(publisher).toHaveBeenCalledTimes(1);
    expect(repository.markProcessed).toHaveBeenCalledWith('e1');
    expect(repository.markPending).not.toHaveBeenCalled();
  });

  it('returns event to pending on publish failure', async () => {
    const repository = {
      claimPending: jest.fn().mockResolvedValue([
        {
          id: 'e2',
          aggregateType: 'auction',
          aggregateId: 'a1',
          eventType: 'AuctionBidPlaced',
          payload: { type: 'bid_updated' },
          status: 'processing',
          createdAt: new Date(),
          attempts: 1
        }
      ]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markPending: jest.fn().mockResolvedValue(undefined)
    } as any;

    const publisher = jest.fn().mockRejectedValue(new Error('network'));
    const worker = new OutboxWorker(repository, publisher, { intervalMs: 5000, batchSize: 10 });

    await worker.tick();

    expect(repository.markPending).toHaveBeenCalledWith('e2');
    expect(repository.markProcessed).not.toHaveBeenCalled();
  });
});
