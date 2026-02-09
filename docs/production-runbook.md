# Production Runbook

## Deployment topology
- Frontend: static hosting (Netlify/Vercel/CDN)
- Backend API: stateless Node.js service
- Worker: dedicated `npm run worker` process
- Database: managed PostgreSQL
- Storage: S3-compatible object storage
- Shared cache: Redis (webhook replay protection + distributed rate limiting)

## Environment promotion flow
1. `dev` -> `staging` using PostgreSQL staging instance
2. Run automated staging smoke checks:
   - `npm run ops:staging-smoke -- --base-url=https://<staging-host>`
   - or trigger `.github/workflows/staging-smoke.yml` with `STAGING_BASE_URL` secret
3. Run regression tests in staging
4. Promote same artifact to production

## Backup and restore drill
1. Enable automated daily PostgreSQL snapshots
2. Keep PITR enabled (if provider supports it)
3. Weekly restore test:
4. Restore latest snapshot into temporary DB
5. Run app readiness checks against restored DB
6. Run database integrity checks against restored DB:
   - `DATABASE_URL=<restored-db-url> npm run ops:db:validate-integrity`
7. Record RTO and data integrity notes

## SQLite rollback fallback (cutover window)
1. Stop writes to old environment
2. Snapshot source SQLite file (`backend/prisma/dev.db`)
3. Run `npm run migrate:sqlite-to-postgres` in backend
4. Validate counts/domain checks from migration output
5. If validation fails:
6. Keep production on previous release and restore old environment from SQLite snapshot

## Alerts and on-call thresholds
- `5xx_rate > 2% for 5m`: page on-call
- `health_ready != ready for 3m`: page on-call
- `db_connectivity_failures > 3 in 5m`: page on-call
- `webhook_invalid_signature_rate spike`: high-priority ticket
- `worker job failures for 2 consecutive runs`: page on-call
- `workerLagMs > 15m`: page on-call

## Branch Protection Setup
1. Create a fine-grained token with `Administration` write scope.
2. Configure protections for `main`:
   - `GITHUB_TOKEN=<token> GITHUB_REPOSITORY=<owner>/<repo> npm run ops:configure-branch-protection`

## Incident response quick steps
1. Confirm `/health/live` and `/health/ready`
2. Check latest deploy and rollback if needed
3. Inspect structured logs using `X-Request-Id`
4. Verify database status and connection pool saturation
5. Verify object storage availability
