# Phase 1 - Backend Architecture + Folder Structure

## Architecture (Textual)

```text
[React Web Client] --HTTPS/JWT--> [API Gateway]
                                    |
                                    +--> [Auth Service]
                                    +--> [Auction Service]
                                    +--> [Match Engine Service]
                                    +--> [Stats Service]
                                    +--> [Tournament Service]
                                    +--> [Notification Service (Socket.IO)]

[All services] <--> [PostgreSQL]
[All realtime/ephemeral workloads] <--> [Redis]
[Async domain events] <--> [RabbitMQ/Kafka]

[Observability]
Services -> OpenTelemetry Collector -> Prometheus/Grafana + Jaeger
```

## Core Design Decisions

- **Microservice boundaries by domain**: auth, auction, match simulation, stats, tournament, notifications.
- **Gateway as stable API facade**: clients call one public surface while services evolve independently.
- **Event-driven side effects**: bid, match-ball, standings updates produce events for eventual consistency.
- **Replayability and auditability**: event stream and ball-by-ball records support replays and anti-cheat checks.
- **Scalability path**: websocket fanout isolated in notification service; stateless APIs scale horizontally.

## Backend Folder Structure

```text
apps/
  api-gateway/
    src/
      common/
      app.module.ts
      gateway.controller.ts
      main.ts
  auth-service/
    src/
      auth/
      app.module.ts
      main.ts
  auction-service/
    src/
      auction/
      app.module.ts
      main.ts
  match-engine-service/
    src/
      ai/
      match/
      app.module.ts
      main.ts
  stats-service/
    src/
      stats/
      app.module.ts
      main.ts
  tournament-service/
    src/
      tournament/
      app.module.ts
      main.ts
  notification-service/
    src/
      notification/
      app.module.ts
      main.ts

packages/
  shared-contracts/
    src/
      domain.ts
      index.ts

infra/
  db/
    migrations/
    seeds/
  docker/
  k8s/
```

## Service Ownership Matrix

- `Auth Service`: identity, password lifecycle, JWT issue/refresh.
- `Auction Service`: lobby state machine, bidding, anti-sniping, team composition constraints.
- `Match Engine Service`: seeded probabilistic engine, pressure/fatigue effects, replay and AI hint APIs.
- `Stats Service`: scorecard projection and commentary feed aggregation.
- `Tournament Service`: fixtures, standings, NRR, playoffs, ranking systems.
- `Notification Service`: websocket room subscriptions and low-latency fanout.

## Contracts and Interfaces

- Shared enums and event types are centralized in `packages/shared-contracts`.
- Gateway-to-service API routes are versioned under `/api/v1`.
- Websocket namespace is `/live` with room-scoped broadcast events.
