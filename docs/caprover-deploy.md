# CapRover Deployment (SeaweedFS instead of MinIO)

This repo is best deployed on CapRover as 3 apps:

1. `mlo-web` (frontend static site)
2. `mlo-api` (Express API)
3. `mlo-worker` (background worker, not exposed)

Storage choice:

- Use SeaweedFS S3 gateway as the open-source S3-compatible object store.

## Files Added

- Frontend image: `frontend/Dockerfile`
- Frontend nginx config: `frontend/nginx.conf`
- API image: `backend/Dockerfile.api`
- Worker image: `backend/Dockerfile.worker`
- Captain definitions:
  - `captain-definition.web`
  - `captain-definition.api`
  - `captain-definition.worker`
  - `captain-definition` (defaults to frontend/web)

## Prerequisites in CapRover

1. Create apps:
   - `mlo-web`
   - `mlo-api`
   - `mlo-worker`
2. For `mlo-worker`, toggle "Do not expose as web app".
3. Provision Redis (one-click app) and note its internal service URL.
4. Provision SeaweedFS and expose S3 gateway port for internal network access.
5. Add persistent storage mapping to both API and worker:
   - Host path: `/captain/data/mlo-sqlite`
   - Container path: `/app/data`

## SeaweedFS Recommended Runtime

Container image:

- `chrislusf/seaweedfs:latest`

Container command:

- `weed server -dir=/data -s3 -s3.port=8333`

Persistent mapping:

- Host path: `/captain/data/seaweedfs`
- Container path: `/data`

Internal endpoint for backend apps:

- `http://srv-captain--<seaweed-app-name>:8333`

SeaweedFS credentials env (set on `seaweedfs` app):

- `AWS_ACCESS_KEY_ID=<seaweed-access-key>`
- `AWS_SECRET_ACCESS_KEY=<seaweed-secret-key>`

## Environment Variables

Set on `mlo-api`:

- `NODE_ENV=production`
- `PORT=3002`
- `FRONTEND_URL=https://app.yourdomain.com`
- `API_URL=https://api.yourdomain.com`
- `DATABASE_URL=file:/app/data/features.db`
- `JWT_SECRET=<strong-random-secret>`
- `ENCRYPTION_KEY=<32+ chars>`
- `REDIS_URL=redis://srv-captain--<redis-app>:6379`
- `S3_ENDPOINT=http://srv-captain--<seaweed-app>:8333`
- `S3_BUCKET=mlo-documents`
- `S3_ACCESS_KEY=<seaweed-access-key>`
- `S3_SECRET_KEY=<seaweed-secret-key>`
- Optional: Sentry and SMTP variables

Set on `mlo-worker`:

- Same as API except no `PORT` required.

Set build args on `mlo-web`:

- `VITE_API_URL=https://api.yourdomain.com`
- `VITE_SESSION_TIMEOUT_MINUTES=15`
- Optional Sentry vars:
  - `VITE_SENTRY_DSN`
  - `VITE_SENTRY_ENVIRONMENT=production`
  - `VITE_SENTRY_RELEASE`

## Deploy Order

1. Deploy API first:
   - use `captain-definition.api`
2. Deploy worker second:
   - use `captain-definition.worker`
3. Deploy web last:
   - use `captain-definition.web` (or root `captain-definition`)

## Local Deploy Command Pattern (PowerShell)

Install CapRover CLI:

```powershell
npm i -g caprover
```

Login once:

```powershell
npx caprover login
```

From repo root, pick definition and deploy:

```powershell
# API
.\scripts\select-captain-definition.ps1 -Target api
npx caprover deploy -a mlo-api

# Worker
.\scripts\select-captain-definition.ps1 -Target worker
npx caprover deploy -a mlo-worker

# Web
.\scripts\select-captain-definition.ps1 -Target web
npx caprover deploy -a mlo-web
```

Optional SeaweedFS app from this repo:

```powershell
.\scripts\select-captain-definition.ps1 -Target seaweedfs
npx caprover deploy -a seaweedfs
```

## Post-Deploy Checks

1. API liveness:
   - `https://api.yourdomain.com/health/live` should return `200`.
2. API readiness:
   - `https://api.yourdomain.com/health/ready` should return `200`.
3. App UI load:
   - `https://app.yourdomain.com/login`
4. Auth flow:
   - login and refresh browser once.
5. File upload flow:
   - upload one document to confirm SeaweedFS S3 path.
6. Worker activity:
   - check worker logs for scheduled trigger run lines.

## Notes

1. Current Prisma datasource provider is SQLite in `backend/prisma/schema.prisma`.
2. Keep API + worker single replica while sharing SQLite file.
3. If you need horizontal scaling, migrate Prisma datasource to PostgreSQL first.
