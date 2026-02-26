# MLO Complete UX Review (Local Mission)

- Date: 2026-02-24
- Mission run: `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z`
- Review evidence snapshots: `output/playwright/mlo-review-2026-02-24T13-49-00/`
- Environment: Windows 11 (`win32 10.0.29531`), Chromium, local frontend `http://localhost:5173`, local API `http://127.0.0.1:3002/api`, role `MLO`
- Workflows covered: Pass A/B/C all passed (15 flows), including create 3 clients, notes/tasks/calls, communications compose/save/send, notifications action, role checks, 10x + 100x stress.

## Priority Formula

`Priority = (Frequency + User pain + Business risk) - Fix effort` (1-5 scale each)

## Ranked Top 10

| Rank | Issue | Category | Severity | Frequency | Pain | Risk | Effort | Priority |
|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | Dashboard counts cap at 200 clients | Bug | P1 | 4 | 4 | 4 | 2 | 10 |
| 2 | Client Tasks tab due-date filter not applied | Bug | P1 | 3 | 4 | 3 | 1 | 9 |
| 3 | Intermittent blank-screen state (user evidence) | Reliability | P1 | 2 | 5 | 4 | 2 | 9 |
| 4 | Notification unread polling is chatty | Performance | P2 | 4 | 3 | 3 | 2 | 8 |
| 5 | Heavy icon bundle impacts initial load | Performance | P2 | 4 | 3 | 3 | 2 | 8 |
| 6 | Client-details screen is API-heavy | Performance | P2 | 4 | 3 | 3 | 3 | 7 |
| 7 | Communications search applies only on Enter | UX friction | P2 | 3 | 3 | 2 | 1 | 7 |
| 8 | Dashboard over-fetch for summary widgets | Performance | P2 | 4 | 2 | 3 | 3 | 6 |
| 9 | Communication status vocabulary mismatch | Copy & clarity | P2 | 3 | 2 | 2 | 1 | 6 |
| 10 | Expected auth refresh expiry shows console 400 noise | Reliability | P3 | 2 | 2 | 2 | 2 | 4 |

## Full Issue Log

### 1) Dashboard counts cap at 200 clients

Issue Title: Dashboard total/pipeline stats are truncated above 200 clients  
Category: Bug  
Environment: Desktop, Windows 11, Chromium, MLO role, local run `mlo-mission-2026-02-24T13-25-48-564Z`  
Steps to reproduce:
1. Seed 100x mission data (`counts.clients = 3000`).
2. Log in as mission MLO user.
3. Open dashboard and compare stats against dataset size.
Expected vs Actual: Dashboard should reflect all clients and status distribution; dashboard fetch uses `/clients?limit=200` and computes totals from `clients.length`, truncating data above 200.  
Impact: Managers/MLOs get incorrect pipeline totals and stage distribution; trust issue for operational decisions.  
Severity: P1  
Evidence:
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z-100x/seed-summary.json` (`counts.clients: 3000`)
- `frontend/src/pages/Dashboard.tsx:83`
- `frontend/src/pages/Dashboard.tsx:203`
Suggested fix: Replace list-based counting with a backend aggregate endpoint (`/clients/statistics`) and use server-returned totals/status counts.  
Extra notes: This is a correctness defect, not just performance.

### 2) Client Tasks tab due-date filter not applied

Issue Title: Due-date filter UI does not affect rendered task list on client details  
Category: Bug  
Environment: Desktop, Windows 11, Chromium, MLO role  
Steps to reproduce:
1. Open a client record.
2. Add one task due today and one due in the future.
3. Set `Due date` filter to `Due Today` in the client Tasks tab.
Expected vs Actual: Only due-today tasks should render; list render path filters only by priority, so future tasks can remain visible.  
Impact: MLO may act on wrong task set and miss urgent work.  
Severity: P1  
Evidence:
- `frontend/src/components/client/TasksTab.tsx:78`
- `frontend/src/components/client/TasksTab.tsx:80`
- `frontend/src/components/client/TasksTab.tsx:92`
Suggested fix: Reuse one `filteredTasks` collection for both empty-state check and map rendering; apply priority + date filters consistently.  
Extra notes: Low-effort, high-confidence quick win.

### 3) Intermittent blank-screen state (user evidence)

Issue Title: App can enter full blank/gray screen with no recoverable UI  
Category: Reliability  
Environment: User-provided local run screenshots (desktop)  
Steps to reproduce:
1. Run app locally and navigate between core pages (reported by user).
2. Observe occasional full blank gray canvas state.
Expected vs Actual: App shell/navigation should remain visible with recoverable error UI; blank screen shown with no actionable feedback.  
Impact: Hard blocker when it occurs; user cannot continue MLO work.  
Severity: P1  
Evidence:
- User-attached screenshots in this thread (blank gray fullscreen)
Suggested fix: Add root-level fatal error fallback (with reload + trace id), capture runtime error telemetry, and auto-redirect to safe route when rendering crashes.  
Extra notes: I could not deterministically reproduce in latest run; treat as high-priority intermittent defect.

### 4) Notification unread polling is chatty

Issue Title: Unread notification polling dominates API call volume  
Category: Performance  
Environment: Desktop, Windows 11, Chromium, 19-minute mission run  
Steps to reproduce:
1. Keep app open through normal navigation/workflow pass.
2. Review network sample counts.
Expected vs Actual: Unread count refresh should be low-overhead; `GET /api/notifications/unread-count` executed 93 times in one run (highest endpoint volume).  
Impact: Extra backend load and battery/network overhead, worse with multiple tabs.  
Severity: P2  
Evidence:
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/network-samples.json`
- `frontend/src/components/NotificationCenter.tsx:169`
- `frontend/src/components/NotificationCenter.tsx:190`
Suggested fix: Use websocket/push invalidation for unread badge and per-user in-memory dedupe across tabs; keep polling as fallback only.  
Extra notes: Current implementation already pauses when hidden; next gain is cross-tab dedupe + push.

### 5) Heavy icon bundle impacts initial load

Issue Title: Large icon dependency chunk inflates startup payload  
Category: Performance  
Environment: Local mission run, Chromium  
Steps to reproduce:
1. Open app cold start.
2. Review largest payload entries.
Expected vs Actual: Icon assets should be minimized and split; largest payload repeatedly is `@tabler_icons-react.js` at ~2.68 MB.  
Impact: Slower first-load and degraded perceived performance, especially on constrained networks/devices.  
Severity: P2  
Evidence:
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/network-summary.json`
- `docs/qa/mlo-mission-performance-2026-02-24.md`
Suggested fix: Enforce route-level code splitting and production bundle audit (`vite build --analyze`), then lazy-load icon-heavy pages/widgets.  
Extra notes: Validate impact on production build separately (dev bundling may overstate absolute size).

### 6) Client-details screen is API-heavy

Issue Title: Client details page generates disproportionately high API traffic  
Category: Performance  
Environment: Local mission run, MLO role  
Steps to reproduce:
1. Open client details.
2. Navigate tabs and perform common edits.
3. Check screen-level API call counts.
Expected vs Actual: One client workspace should avoid repeated redundant fetches; `client-details` recorded 107 API calls (highest screen).  
Impact: Slower tab switching and higher backend load in daily MLO usage.  
Severity: P2  
Evidence:
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/network-summary.json`
Suggested fix: Add stronger React Query stale windows/prefetch strategy per tab and collapse related requests into summary endpoints for client shell.  
Extra notes: Good candidate for incremental perf sprint.

### 7) Communications search applies only on Enter

Issue Title: Communications search input has hidden apply behavior  
Category: UX friction  
Environment: Desktop, Windows 11, Chromium, MLO role  
Steps to reproduce:
1. Open Communications page.
2. Type a search query and pause.
3. Observe results; then press Enter.
Expected vs Actual: Search should apply immediately/debounced or expose explicit Apply action; current behavior applies only when Enter triggers `handleSearch()`.  
Impact: Users think search is broken or stale; extra cognitive load and retries.  
Severity: P2  
Evidence:
- `frontend/src/pages/Communications.tsx:74`
- `frontend/src/pages/Communications.tsx:75`
- `frontend/src/pages/Communications.tsx:132`
- `frontend/src/pages/Communications.tsx:138`
- `frontend/src/pages/Communications.tsx:335`
Suggested fix: Debounce input -> `q` update (300-500ms) or add visible `Search` button adjacent to field.  
Extra notes: Minor implementation effort.

### 8) Dashboard over-fetch for summary widgets

Issue Title: Dashboard summary uses large list payloads and extra follow-up calls  
Category: Performance  
Environment: Desktop, Windows 11, Chromium, MLO role  
Steps to reproduce:
1. Open Dashboard.
2. Inspect network requests from stats query.
Expected vs Actual: Summary cards should use compact aggregate endpoints; dashboard fetches large client list + multiple endpoints, plus additional task list call.  
Impact: Increased network and slower refresh under load, especially with large datasets.  
Severity: P2  
Evidence:
- `frontend/src/pages/Dashboard.tsx:74`
- `frontend/src/pages/Dashboard.tsx:83`
- `frontend/src/pages/Dashboard.tsx:131`
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/network-summary.json` (`dashboard` API calls: 38)
Suggested fix: Consolidate dashboard data via one backend aggregate endpoint and remove list endpoints for count-only widgets.  
Extra notes: Also fixes correctness issue #1 when combined with server-side totals.

### 9) Communication status vocabulary mismatch

Issue Title: UI status dictionary includes states unsupported by backend workflow  
Category: Copy & clarity  
Environment: Desktop, Windows 11, Chromium, MLO role  
Steps to reproduce:
1. Compare communication status definitions in frontend constants vs backend validation.
2. Inspect communication status labels/badges in UI.
Expected vs Actual: Status terms should be one consistent set across UI/API/workflow; frontend config still defines `PENDING`, `DELIVERED`, `SCHEDULED` while backend accepts only `DRAFT`, `READY`, `SENT`, `FAILED`.  
Impact: Confusion during status interpretation and template/workflow authoring.  
Severity: P2  
Evidence:
- `frontend/src/utils/constants.ts:112`
- `frontend/src/utils/constants.ts:115`
- `frontend/src/utils/constants.ts:118`
- `frontend/src/utils/constants.ts:119`
- `backend/src/services/communicationService.ts:32`
Suggested fix: Keep UI status dictionary aligned to backend-supported states or expand backend transitions intentionally and document them.  
Extra notes: Filter options are already aligned; this issue is status-label coherence.

### 10) Expected refresh expiry currently appears as console error noise

Issue Title: Session-expiry refresh path logs repeated 400 errors  
Category: Reliability  
Environment: Long-session mission flow (PASS_C), Chromium  
Steps to reproduce:
1. Execute session recovery scenario.
2. Inspect console and HAR after token expiry attempts.
Expected vs Actual: Expired refresh attempts should be handled as expected path with non-noisy logging; console logs repeated `Failed to load resource: 400` from `/api/auth/refresh`.  
Impact: Debug noise and potential false alarm during support triage.  
Severity: P3  
Evidence:
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/evidence/console.log`
- `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z/evidence/mission.har`
Suggested fix: Treat known refresh-expired responses as expected control flow in client logging; log at debug level only.  
Extra notes: No user-visible blocker observed; this is operational hygiene.

## Quick Wins vs Big Bets

Quick wins (high priority, low effort):
1. Fix client Tasks date-filter rendering bug (#2).
2. Add explicit search trigger/debounce in Communications (#7).
3. Align communication status vocabulary constants with backend (#9).

Big bets (cross-cutting):
1. Replace dashboard/client details list-heavy fetches with aggregate endpoints (#1, #6, #8).
2. Reduce notification polling via push invalidation + cross-tab dedupe (#4).
3. Bundle and route-splitting audit for icon-heavy frontend payloads (#5).

## Gate Recommendation

- Open P0: 0
- Open P1: 3 (`#1`, `#2`, `#3`)
- Release gate result: **FAIL** until P1 items are resolved or explicitly waived.
