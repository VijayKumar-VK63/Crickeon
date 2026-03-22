import { AuctionRepository } from '../src/modules/auction/repositories/auction.repository';

describe('AuctionRepository', () => {
  it('returns bid history ordered desc', async () => {
    const prismaMock = {
      bid: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'u2', amount: BigInt(300000), createdAt: new Date('2026-03-22T10:10:00.000Z') },
          { userId: 'u1', amount: BigInt(250000), createdAt: new Date('2026-03-22T10:09:00.000Z') }
        ])
      }
    } as any;

    const repository = new AuctionRepository(prismaMock);
    const history = await repository.getBidHistory('auction-1');

    expect(prismaMock.bid.findMany).toHaveBeenCalledWith({
      where: { auctionId: 'auction-1' },
      orderBy: { createdAt: 'desc' }
    });
    expect(history[0]).toEqual({ ownerId: 'u2', amount: 300000, occurredAt: '2026-03-22T10:10:00.000Z' });
  });

  it('updates auction state', async () => {
    const prismaMock = {
      auction: {
        update: jest.fn().mockResolvedValue({})
      }
    } as any;

    const repository = new AuctionRepository(prismaMock);
    await repository.updateAuctionState('auction-2', 'sold');

    expect(prismaMock.auction.update).toHaveBeenCalledWith({
      where: { id: 'auction-2' },
      data: { status: 'sold' }
    });
  });
});
