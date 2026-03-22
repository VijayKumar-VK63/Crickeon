# LAMCL API Overview

Base URL (gateway): `/api/v1`

## REST Endpoints
- `POST /auth/login`
- `POST /auth/register`
- `POST /rooms/create`
- `POST /rooms/join`
- `GET /players`
- `POST /auction/bid`
- `POST /match/start`
- `GET /tournaments/:id/standings`

## WebSocket Events
- `player_joined`
- `bid_updated`
- `auction_timer`
- `match_update`
- `score_update`
