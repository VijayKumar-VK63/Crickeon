# Free MVP Deployment Guide (Render + Vercel + Supabase + Upstash)

This setup deploys a **single public backend service** (Render) that internally starts auth/auction/match/stats + API gateway process bundle, and a frontend on Vercel.

## 1) Create Supabase PostgreSQL (free)

1. Create a Supabase project.
2. Open `Project Settings -> Database`.
3. Copy the connection string and force SSL:
   - `postgresql://...?...&sslmode=require`
4. Save as `DATABASE_URL`.

## 2) Create Upstash Redis (free)

1. Create Redis database in Upstash.
2. Copy `rediss://...` endpoint.
3. Save as `REDIS_URL`.

## 3) Deploy backend on Render

1. Push repository to GitHub.
2. In Render, create a **Blueprint** from repo root (uses `render.yaml`).
3. Set environment variables in Render service:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CRICAPI_KEY` (or `SPORTRADAR_API_KEY`)
4. Keep internal URLs unchanged:
   - `AUTH_SERVICE_URL=http://127.0.0.1:3001/api/v1`
   - `AUCTION_SERVICE_URL=http://127.0.0.1:3002/api/v1`
   - `MATCH_SERVICE_URL=http://127.0.0.1:3003/api/v1`
   - `STATS_SERVICE_URL=http://127.0.0.1:3004/api/v1`
5. Deploy and note backend public URL, for example:
   - `https://lamcl-mvp-backend.onrender.com`

## 4) Deploy frontend on Vercel

1. Import repository in Vercel.
2. Root project can stay repository root (uses `vercel.json`).
3. Add environment variables:
   - `VITE_API_BASE_URL=https://<render-url>/api/v1`
   - `VITE_SOCKET_URL=https://<render-url>/live`
4. Deploy and note frontend URL.

## 5) Final backend environment update

Set `FRONTEND_ORIGIN` on Render to your Vercel domain:
- `https://<your-app>.vercel.app`

Redeploy backend once after setting `FRONTEND_ORIGIN`.

## 6) Validate production behavior

### API checks
- `GET https://<render-url>/api/v1/health`
- `POST https://<render-url>/api/v1/auth/register`

### Prisma checks
- Render startup runs `prisma migrate deploy` via `scripts/start-mvp-backend.cjs`.
- Confirm migration logs during startup.

### Frontend checks
- Open Vercel URL and run login.
- Create room, open auction, place bid.

### WebSocket checks
- Browser console should connect to `https://<render-url>/live`.
- Confirm realtime events (`bid_updated`, `auction_timer`, `match_update`) arrive.

## 7) Troubleshooting

- **CORS blocked**: verify `FRONTEND_ORIGIN` matches exact Vercel URL.
- **DB connection failed**: ensure Supabase URL includes `sslmode=require`.
- **Redis issues**: ensure `REDIS_URL` uses `rediss://` for Upstash.
- **Socket not connecting**: confirm `VITE_SOCKET_URL` points to backend `/live`.
