# LAMCL System Architecture (Textual Diagram)

## 1) Logical Topology

```text
[Web Client (React + TS)]
        |
        | HTTPS + JWT
        v
[API Gateway]  <--------------------------> [Notification Service (Socket.IO)]
   |   |   |   \                                   |
   |   |   |    \                                  | Publishes room/match events
   |   |   |     \                                 v
   |   |   |      -----> [Redis] <---- session/presence/cache ----
   |   |   |
   |   |   +-----> [Auth Service] -----> [PostgreSQL: users, refresh tokens, roles]
   |   +---------> [Auction Service] --> [PostgreSQL: rooms, auctions, bids, teams]
   +-------------> [Match Engine Service] --> [PostgreSQL: matches, events]
   +-------------> [Stats Service] --> [PostgreSQL: scorecards, analytics views]
   +-------------> [Tournament Service] --> [PostgreSQL: tournaments, standings]

Services emit domain events -> [RabbitMQ/Kafka] -> subscribers update read models + notify clients

Observability sidecar:
All services -> OpenTelemetry -> Collector -> Prometheus/Grafana + Jaeger
Structured logs -> Fluent Bit -> CloudWatch/ELK
```

## 2) Core Request/Event Flows

### Lobby + Auction Flow
1. Player authenticates (`Auth Service`) and receives JWT.
2. Player creates/joins room through `API Gateway` (`Auction Service`).
3. `Auction Service` enforces minimum 4 owners before state transition to `auction`.
4. Bid updates are persisted atomically and published as `AuctionBidPlaced` events.
5. `Notification Service` broadcasts `bid_updated` and `auction_timer` websocket events.
6. Anti-sniping extends timer if bid arrives in configured final seconds.

### Match Flow
1. Tournament scheduler picks fixtures (`Tournament Service`).
2. `Match Engine Service` initializes match seed, pitch, form, and lineup.
3. Ball outcomes are generated probabilistically from matchup matrices.
4. Ball events are event-sourced and appended to match event stream.
5. `Stats Service` consumes events and updates scorecards/leaderboards.
6. `Notification Service` emits `match_update` and `score_update`.

## 3) Deployment (AWS)
- **Compute:** EKS (or ECS fallback) with horizontal pod autoscaling.
- **Database:** Amazon RDS PostgreSQL (Multi-AZ).
- **Cache:** ElastiCache Redis.
- **Queue:** Amazon MQ (RabbitMQ) or MSK (Kafka).
- **Objects:** S3 for assets/replays.
- **Ingress:** ALB + WAF + TLS.

## 4) SLO Targets
- P95 websocket fan-out latency < 100ms in-region.
- Match event durability: at-least-once event persistence.
- Service availability target: 99.9%.
- Recoverability: RPO < 5 min, RTO < 30 min.
