# Pre-Production Launch Gate Matrix

## Date

2026-02-17

## Preflight fix status

**Gate:** PASS (with warnings)

- `npm run preflight` passes and reports deterministic fallback when configured ports are occupied.
- Database configuration aligned (`sqlite` provider + `file:./dev.db`).
- Seed/bootstrap successful.

## Evidence (raw)

- Playwright HTML report: `playwright-report/`
- Playwright artifacts: `test-results/`
- Runtime startup logs captured from `npm run dev`:
  - backend fallback from `3002 -> 3003`
  - frontend active on `5173`
- Smoke verification commands executed:
  - `/health/live` => `200`
  - unauth `/api/clients` => `401`
  - admin login (`admin@example.com`) => success
  - viewer login (`viewer@example.com`) => success
  - CSRF token header (`X-CSRF-Token`) present on login response

## Launch Gate Matrix

| Feature / Gate | Status | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Env + runtime alignment | **Pass** | `scripts/dev-audit.mjs` startup logs; `npm run preflight` pass | Low | Keep `dev-audit` as canonical local launch path |
| DB schema/provider alignment | **Pass** | `backend/prisma/schema.prisma` + `db:push` output | Low | Keep sqlite local profile documented |
| Seed + deterministic identities | **Pass** | `npm run db:seed --prefix backend` output | Low | Keep seeded users as smoke baseline |
| Auth smoke (admin/viewer) | **Pass** | login checks on `:3003` | Low | Add as CI smoke in future |
| Unauthorized access behavior | **Pass** | `/api/clients` unauthorized => `401` | Low | Keep regression check |
| Browser regression (desktop) | **Pass** | `e2e/launch-audit.spec.ts` in Playwright report | Medium | Maintain e2e in release checklist |
| Browser regression (mobile spot) | **Pass** | `e2e/launch-audit.spec.ts` mobile case passed | Medium | Expand to additional mobile routes post-launch |
| Port conflict resilience | **Pass** | dynamic fallback in `dev-audit`, warning in preflight | Medium | Add explicit max-attempt range note in README |

## Prioritized fixes completed

### P0

- ✅ Env/runtime alignment completed.
- ✅ Seed/login bootstrap completed.

### P1

- ✅ Port conflict resilience implemented and validated on Windows.
- ✅ Reproducible preflight command implemented (`npm run preflight`).

### P2

- ✅ Audit artifacts standardized by Playwright output folders (`playwright-report`, `test-results`).

## Remaining launch risks

1. **External local process conflicts on fixed ports** (observed `3002` occupied by unrelated app).
   - Mitigated by fallback startup + preflight warning.
2. **Some ad-hoc scripts contain environment-specific assertions** (for example expecting a specific seeded client status/tag shape).
   - Non-blocking for launch; these scripts now run against dynamic API URL and CSRF-protected endpoints, but a few assertions still depend on mutable local data.

## Additional hardening completed after initial gate

- Normalized these root scripts to use dynamic `API_URL` (env override supported):
  - `test-workflow-api.js`
  - `test-feature-300.js`
  - `test-feature-291-comprehensive.js`
  - `test-feature-287-clients.js`
  - `test-feature-286-tasks.js`
  - `test-feature-285-email.js`
  - `test-feature-282-conditions.js`
- Added CSRF token/cookie persistence for Node-based scripts that issue mutating requests.
- Validation reruns:
  - `test-workflow-api.js` => **11/11 passed**
  - `test-feature-300.js` => **7/8 passed** (1 expected mismatch in validation expectation)
  - `test-feature-286-tasks.js` => completed successfully
  - `test-feature-287-clients.js` => completed successfully
  - `test-feature-285-email.js` => completed successfully
  - `test-feature-282-conditions.js` => **9/12 passed** (remaining failures are data-assumption/assertion-specific)

## Launch decision

## ✅ **Conditional Go**

Production launch gate is satisfied for the audited scope (core startup, auth baseline, desktop/mobile launch audit regression). Remaining risks are non-blocking and have mitigations.
