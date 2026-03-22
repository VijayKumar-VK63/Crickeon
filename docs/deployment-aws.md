# AWS Deployment Blueprint (Phase 8)

## Target Topology

- EKS cluster for microservices (`api-gateway`, `auth`, `auction`, `match-engine`, `stats`, `tournament`, `notification`)
- RDS PostgreSQL Multi-AZ for transactional/stateful data
- ElastiCache Redis for pub/sub, lock coordination, and hot caches
- S3 for static assets and user-uploaded cosmetic bundles
- ALB ingress for `api` and websocket traffic

## Build + Release

1. Build and push images via GitHub Actions to GHCR/ECR.
2. Apply Prisma migrations from a secure migration job:
   - `npm run prisma:migrate`
3. Roll deployments with image tags pinned by commit SHA.

## Runtime Secrets

Store in AWS Secrets Manager and sync to Kubernetes secrets:

- `database_url`
- `redis_url`
- `jwt_secret`
- `jwt_refresh_secret`
- `cricapi_key`
- `sportradar_api_key`
- `email_webhook_url`
- `push_webhook_url`

## Autoscaling and SLOs

- HPA target CPU 65% for API and auction/match services.
- Baseline SLOs:
  - p95 REST latency < 200ms
  - websocket fanout lag < 150ms
  - outbox backlog processing delay < 2s

## Monitoring and Incident Flow

- Prometheus scrapes gateway metrics endpoint.
- Grafana dashboard tracks latency, throughput, and 4xx/5xx error rate.
- OTel collector receives traces for future vendor export.

## Rollback Plan

- Keep last two image tags deployed.
- Rollback command:
  - `kubectl rollout undo deployment/<service> -n lamcl`
- Ensure DB rollback scripts for destructive migrations are version-controlled.
