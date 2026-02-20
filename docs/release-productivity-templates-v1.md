# Release Notes: Productivity Templates V1

## Summary

Productivity Templates V1 delivers personal + system template support across notes, tasks, reminders, and activities, including:

- Unified template management hub at `/templates`
- Inline template apply/save in core create flows
- QuickCapture support for `/task`, `/note`, `/reminder`, `/activity`
- Activity template auto follow-up creation (task/reminder)
- Backward-compatible note template alias at `GET /api/notes/templates/list`

## Scope

- Backend: template CRUD and ownership/system immutability rules
- Frontend: template hub and inline integrations
- E2E: acceptance flow for template creation and usage in core forms + quick capture

## Database Migration

### Local validation

Run in `backend/`:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

### Known local caveat

If local schema provider differs from migration history (for example local `sqlite` schema with `postgresql` migration lock), Prisma returns `P3019`. In that case:

- use the production/staging PostgreSQL `DATABASE_URL` for migration execution,
- keep local checks focused on type generation and app tests.

### Windows Prisma engine lock workaround

If `npx prisma generate` fails with `EPERM` on `query_engine-windows.dll.node`:

1. Stop backend dev server and any process locking Prisma binaries.
2. Re-run:

```bash
npx prisma generate
```

As a temporary local fallback for type checks only:

```bash
npx prisma generate --no-engine
```

### Staging rollout

Pre-step:

- confirm DB snapshot/backup completed.

Execute:

```bash
DATABASE_URL=<staging-postgres-url> npx prisma migrate deploy
DATABASE_URL=<staging-postgres-url> npx prisma generate
```

Post-migration verification SQL:

```sql
SELECT is_system FROM task_templates LIMIT 5;
SELECT description, is_system, created_by_id, deleted_at FROM note_templates LIMIT 5;
SELECT to_regclass('public.reminder_templates') AS reminder_templates_exists;
SELECT to_regclass('public.activity_templates') AS activity_templates_exists;
```

### Production rollout

Pre-step:

- confirm DB snapshot/backup completed.
- confirm staging migration + smoke checks passed.

Execute:

```bash
DATABASE_URL=<production-postgres-url> npx prisma migrate deploy
DATABASE_URL=<production-postgres-url> npx prisma generate
```

Run the same post-migration verification SQL queries as staging.

## Rollback

1. Restore DB snapshot taken before migration.
2. Redeploy the prior stable backend/frontend release artifact.
3. Run smoke checks:
   - auth login
   - `/api/notes/templates/list`
   - task creation without template
   - activity logging without template

## Public API Notes

No new external API contracts beyond Templates V1 implementation already merged.

Maintained compatibility:

- `GET /api/notes/templates/list` remains supported.

## Verification Checklist

Run and record:

```bash
npm run typecheck
npm test
npm run test:e2e -- e2e/productivity-templates.spec.ts
```

Staging smoke:

```bash
npm run ops:staging-smoke -- --base-url=https://<staging-host>
```

## Verification Evidence (2026-02-19)

- `npm run typecheck`: pass
- `npm test`: pass
  - Frontend: 13 files, 28 tests passed
  - Backend: 14 files, 59 tests passed
- `npm run test:e2e -- e2e/productivity-templates.spec.ts`: pass
  - Chromium: 1/1 passed

Notes:

- Local Prisma migration deploy can report `P3019` when local provider is SQLite and migration lock is PostgreSQL.
- Activity template follow-up path required increasing interactive transaction timeout in `POST /api/activities` to avoid Prisma `P2028` timeout under local dev load.
- Staging smoke command is included above and must be run with the target staging base URL during deployment.

## QA Focus

- System templates visible and read-only.
- Personal templates editable/deletable by owner only.
- QuickCapture `/reminder` and `/activity` template flows.
- Activity auto follow-up creates expected task/reminder.
- Existing non-template flows remain unchanged.
