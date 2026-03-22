# Phase 2 - Auction Service

## Implemented Capabilities

- Lobby creation/join with room state transitions (`waiting -> auction -> match -> results`).
- Minimum player threshold support (>= 4 owners to enter auction phase).
- Live bidding with timer-based rounds and anti-sniping window extension.
- Dynamic pricing signals:
  - demand index from recent bid velocity
  - role scarcity index from acquired role counts
- Idempotent bid processing via optional `idempotencyKey`.
- Bid history retrieval and timer polling endpoints.
- Team building rules with role constraints and chemistry score.
- Budget tracking per owner and squad validation (11 to 15 players).
- Distributed auction lock (`auction:{auctionId}`) for cross-instance bid serialization.
- Transactional outbox emission for bid updates and auction timer events.
- Asynchronous realtime fanout through outbox workers (durable DB write first, publish second).

## Key Endpoints

- `POST /api/v1/rooms/create`
- `POST /api/v1/rooms/join`
- `GET /api/v1/rooms/:roomId`
- `POST /api/v1/auction/open`
- `POST /api/v1/auction/bid`
- `GET /api/v1/auction/:auctionId/timer`
- `GET /api/v1/auction/:auctionId/history`
- `POST /api/v1/auction/settle/:auctionId`
- `GET /api/v1/teams/:ownerId`
- `GET /api/v1/teams/:ownerId/validate`
- `GET /api/v1/teams/:ownerId/budget`

## Source

- `apps/auction-service/src/auction/auction.service.ts`
- `apps/auction-service/src/auction/auction.controller.ts`
- `apps/auction-service/src/auction/auction.dto.ts`
- `apps/auction-service/src/infra/locks/auction-lock.service.ts`
- `apps/auction-service/src/infra/outbox/auction-outbox.worker.service.ts`
- `infra/locks/redis-lock.service.ts`
- `infra/outbox/outbox.repository.ts`
