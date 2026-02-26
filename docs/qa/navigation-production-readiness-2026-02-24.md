# Navigation Component Production Readiness Audit - 2026-02-24

## Environment
- App: `http://localhost:5173`
- API: `http://localhost:3002`
- Browser: Chromium (headless via automation)
- Role: `mlo@example.com`
- Evidence root: `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence`

## Component-by-component status
| Navigation Component | Features tested | Status | Production needs |
|---|---|---|---|
| Dashboard | Landing widgets, Today tab | Pass | Minor performance tuning only |
| Calendar | Open calendar, New Event, Share modal | **Fail** | Fix `New Event` crash (`clients.map is not a function`) |
| Clients | Create/search/open client, detail tabs | Partial fail | Fix detail tab counts/data sync drift |
| Pipeline | Board/table view toggle | Partial fail | Fix table toggle behavior and test coverage |
| Documents | Hub load/empty state | Pass | Keep empty-state UX copy crisp |
| Calculator | Loan calculation flow | Pass | No blocker found |
| Loan Scenarios | Open/create modal | Pass | Add stronger validation feedback |
| Loan Programs | Open add program modal | Pass | Add validation tests |
| Tasks | Create task, quick actions | Pass with friction | Reduce post-create interruption for fast entry |
| Reminders | Create reminder | Pass | No blocker found |
| Notes | Search/filter and create note | Pass | Monitor large-data render perf |
| Templates | Tab switching + template modal | Pass | No blocker found |
| Communications | Compose draft, search/filter, templates tab | Pass | Add send-path regression and failure handling checks |
| Workflows | Workflows tab, executions tab, filters, import modal, builder validation | Partial fail | Fix executions pagination mismatch when filtered to 0 rows |
| Analytics | Date range filter + metrics cards/tables | Pass | Add baseline perf budgets |
| Settings | Profile/security/notification/appearance/integrations flows | **Fail** | Fix persistence/no-op controls and error feedback |
| Quick Capture (`Ctrl+K`) | `/task`, `/note`, `/activity`, `/reminder` | Pass with gaps | Add discoverability and keyboard/accessibility hardening |

## Priority issues to fix before production

### 1) Calendar New Event crashes app
- Severity: **P0**
- Category: Reliability
- Repro:
  1. Go to `/calendar`
  2. Click `New Event`
- Expected: Event modal opens
- Actual: Error boundary renders; app flow interrupted
- Evidence:
  - `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence/calendar-new-event-crash-20260224-125031.png`
  - Console: `clients.map is not a function` in `EventFormModal`
- Suggested fix: normalize/guard `clients` prop (`Array.isArray`) and add unit/e2e test for empty and object payloads.

### 2) Settings saves are misleading (not persisted)
- Severity: **P1**
- Category: UX friction / Reliability
- Repro A (Profile): update phone, click `Save Changes`
- Actual A: `PUT /api/auth/profile` payload excludes phone; phone resets after re-open.
- Repro B (Notifications): toggle `Weekly Digest`, click `Save Preferences`
- Actual B: success toast shown but no save API request; setting resets.
- Repro C (Appearance): set theme to Dark, click `Save Settings`
- Actual C: theme not applied (`data-mantine-color-scheme` remains `light`), no save API request.
- Evidence:
  - `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence/settings-integrations-20260224-142900.png`
  - HTTP logs during test run (no persistence calls for notification/appearance; profile call missing phone)
- Suggested fix: wire tabs to real persistence endpoints and only show success toast after confirmed save.

### 3) Workflow executions pagination shows pages when list is empty
- Severity: **P1**
- Category: UX friction
- Repro:
  1. `/workflows?tab=executions`
  2. Search a non-existent term
- Expected: empty table + no misleading pagination
- Actual: `No executions found` but paginator still shows `1..59`
- Evidence:
  - `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence/workflows-executions-empty-with-pagination-20260224-130945.png`
- Suggested fix: bind pagination controls to filtered total rows, not unfiltered count.

### 4) Client details tabs show inconsistent counts/data
- Severity: **P1**
- Category: Reliability / UX
- Repro:
  1. Create client
  2. Add note and task
  3. Switch tabs in client detail
- Expected: stable, accurate counters and list content
- Actual: badge counts intermittently reset (`Notes (1)` -> `Notes (0)`, `Tasks (1)` -> `Tasks (0)`)
- Evidence: run logs from prior pass + created records present via API
- Suggested fix: unify tab count source with same query cache as tab list data; invalidate consistently after create mutations.

### 5) Pipeline board/table toggle unclear or broken
- Severity: **P1**
- Category: UX friction / Reliability
- Repro: attempt switch from Board to Table in Pipeline
- Expected: deterministic switch and visible table state
- Actual: control appears non-functional/inconsistent in automation and visual checks
- Evidence:
  - `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence/pipeline-after-toggle-20260224-130004.png`
- Suggested fix: audit toggle state binding and add explicit active-state test (`board` <-> `table`).

### 6) Calendar OAuth start can fail silently from Settings Integrations
- Severity: **P1**
- Category: Reliability / UX
- Repro: Settings -> Integrations -> `Connect with Google`
- Expected: clear OAuth redirect or actionable error
- Actual: API `500` (`/api/calendar-sync/oauth/google/start`) with no visible in-page error guidance
- Evidence: HTTP log sequence with 500 response
- Suggested fix: catch and surface actionable error toast/banner with config diagnostics (redirect URI/env missing, etc.).

### 7) Quick Capture discoverability is weak (hotkey-only)
- Severity: **P2**
- Category: UX friction
- Repro: navigate app without knowing hotkey
- Expected: visible launcher or discoverable affordance
- Actual: Quick Capture only appears via `Ctrl+K`
- Evidence:
  - `output/playwright/nav-prod-audit-2026-02-24T12-48-23/evidence/quickcapture-task-command-20260224-142938.png`
- Suggested fix: add optional floating launcher and hint in primary nav/tooltips.

### 8) Integrations token connect button has no validation feedback when empty
- Severity: **P2**
- Category: UX friction
- Repro: Settings -> Integrations -> click `Connect` with empty access token
- Expected: inline validation error
- Actual: no visible feedback
- Evidence: no new API request + no validation UI emitted
- Suggested fix: disable `Connect` until token provided and show inline helper error.

### 9) Settings switches are hard to automate and likely accessibility-fragile
- Severity: **P2**
- Category: Accessibility
- Repro: interact with switches via role-based locator/keyboard-only patterns
- Actual: hidden role-switch input receives semantics while visible control is not directly targetable
- Suggested fix: ensure accessible visible switch control, focus ring, and keyboard interaction tests.

### 10) Notification polling is chatty under normal navigation
- Severity: **P3**
- Category: Performance
- Observed: repeated `/api/notifications/unread-count` polling every ~30s across screens
- Suggested fix: backoff/pause on inactive tab and coalesce polling with websocket/events if available.

## Quick Capture workflow verification (MLO-typical)
Validated successfully from `Ctrl+K`:
- `/task call NAV QA Client tomorrow about docs` -> created task with detected client/date
- `/note NAV QA Client requested updated bank statements` -> created note under detected client
- `/activity Called NAV QA Client and reviewed required docs` -> logged activity under detected client
- `/reminder Follow up NAV QA Client next week` -> created dated reminder under detected client

## Release gate recommendation
- **Fail release** while open P0/P1 issues remain.
- Minimum ship bar for this cycle: fix issues 1-6 above, rerun nav audit, and verify no regressions in quick capture and settings persistence.
