# Phase 3 - Match Engine

## Implemented Capabilities

- Deterministic seeded probabilistic ball simulation with softmax outcome normalization.
- Player-vs-player duel model with persisted historical matchup impact.
- Pitch condition effects (`flat`, `green`, `dusty`).
- Pressure-aware outcome model with wicket probability modulation.
- Momentum tracking from boundary/wicket/dot streaks.
- Batter and bowler fatigue accumulation from workload.
- Match lifecycle:
  - toss simulation
  - match start metadata
  - ball-by-ball simulation
- Interactive modules:
  - death-over decision endpoint influencing pressure/fatigue
  - super-over resolution with mini-game execution score hook
- Persistent event stream storage (`ball_events`) and replay/snapshot APIs.
- Transactional outbox writes for score update fanout.

## Key Endpoints

- `POST /api/v1/match/toss`
- `POST /api/v1/match/start`
- `POST /api/v1/match/ball`
- `POST /api/v1/match/death-over/decision`
- `POST /api/v1/match/super-over/resolve`
- `GET /api/v1/match/:matchId/replay`
- `GET /api/v1/match/:matchId/snapshot/:over`

## Source

- `apps/match-engine-service/src/match/match.service.ts`
- `apps/match-engine-service/src/match/match.controller.ts`
- `apps/match-engine-service/src/ai/ai.service.ts`
- `apps/match-engine-service/src/ai/ai.controller.ts`
- `apps/match-engine-service/src/match/engine/probability.engine.ts`
- `apps/match-engine-service/src/match/engine/matchup.model.ts`
- `apps/match-engine-service/src/match/engine/momentum.system.ts`
- `apps/match-engine-service/src/match/engine/pressure.system.ts`
- `apps/match-engine-service/src/match/engine/fatigue.system.ts`
- `apps/match-engine-service/src/infra/outbox/match-outbox.worker.service.ts`
