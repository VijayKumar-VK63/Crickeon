# Phase 4 - Frontend

## Implemented Capabilities

- React + TypeScript app with route-based modules:
  - auth
  - lobby/auction
  - live match
- Socket.IO integration for real-time events in `/live` namespace.
- Lobby page workflow:
  - create room
  - open auction
  - place idempotent bid
  - fetch timer and bid history
- Match page workflow:
  - toss
  - start match
  - simulate ball
  - death-over decision
  - super-over resolve

## Source

- `apps/web-client/src/App.tsx`
- `apps/web-client/src/pages/AuthPage.tsx`
- `apps/web-client/src/pages/LobbyPage.tsx`
- `apps/web-client/src/pages/MatchPage.tsx`
- `apps/web-client/src/lib/api.ts`
- `apps/web-client/src/lib/socket.ts`
