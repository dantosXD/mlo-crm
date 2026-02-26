# Navigation Production Readiness - Component Audit (2026-02-24 refresh)

## Environment
- App: `http://localhost:5173`
- API: `http://localhost:3002`
- Browser: Chromium automation session
- Role: `mlo@example.com`
- Evidence root: `output/playwright/nav-component-audit-2026-02-24T14-54-28/evidence`

## Component-by-component status
| Navigation component | Feature checks run | Status | Production needs |
|---|---|---|---|
| Dashboard | KPI cards, Today list, navigation entry | Pass with friction | Add high-volume paging/chunking for Today feed; cap default cards/list payload |
| Calendar | Open page, New Event, Share | **Fail (P0)** | Fix `EventFormModal` crash (`clients.map is not a function`) |
| Clients | Search, open details, add note/task/call, tab switching | **Fail (P1)** | Stabilize tab counters/cache (`Notes/Tasks/Communications` badge mismatch after tab switches) |
| Pipeline | Board/table mode switch, lane/table visibility | Partial fail (P2) | Fix control semantics/visibility (hidden input pattern causes fragile interaction and accessibility gaps) |
| Documents | Open hub and empty/list states | Pass | Add regression checks for upload status and bulk actions |
| Calculator | Input/edit/compute flow | Pass | Add edge-case validation tests (empty/invalid values) |
| Loan Scenarios | Create comparison modal, client selection, save path | Pass with UX debt | Reduce modal density; add required-field/inline validation guidance |
| Loan Programs | Program list and create modal | Pass | Add stronger duplicate/invalid-value validation + tests |
| Tasks | List filters, row actions, create/update | Pass with scale friction | Add pagination/virtualization; improve bulk-action clarity at high row counts |
| Reminders | Create reminder, schedule/date flow | Pass | Add conflict/duplicate reminder UX guidance |
| Notes | Search and list reading | Pass with scale friction | Add virtualized list/pagination; throttle rich list rendering for 10x/100x data |
| Templates | Tab switching, create note template, create task template modal | Pass with UX debt | Standardize required-field validation visibility and field types (`Type`/`Priority` should be explicit selects) |
| Communications | Compose, save draft, client tab + hub visibility | Pass | Keep regression coverage for draft/send/failure + filter reset behavior |
| Workflows | List, builder open/save validation, actions | Partial fail (P1/P2) | Fix executions pagination when filtered empty; tighten row-action feedback and search filter affordances |
| Analytics | KPI rendering, stage cards, workflow/communications sections | Partial fail (P2) | Expose date-range controls accessibly and ensure filter effects are obvious/observable |
| Settings | Profile/security/notification/appearance/integrations | **Fail (P1)** | Fix profile persistence gaps and integrations error feedback (details below) |

## Confirmed blockers (must fix before release)

### 1) Calendar New Event crash
- Severity: P0
- Repro:
  1. Go to `/calendar`
  2. Click `New Event`
- Actual: Error boundary with `TypeError: clients.map is not a function`
- Evidence:
  - `output/playwright/nav-component-audit-2026-02-24T14-54-28/evidence/calendar-new-event-crash-reconfirm-20260224-152548.png`
- Needed for production:
  - Guard/normalize `clients` input in calendar modal
  - Add unit test for empty/non-array client payload
  - Add e2e smoke test for `New Event` open

### 2) Client detail tab counters are inconsistent
- Severity: P1
- Repro:
  1. Open client detail with existing note/task/communication
  2. Switch tabs (`Notes` -> `Communications` -> `Tasks` -> `Notes`)
  3. Observe badge values while data remains present
- Actual: Badge counts intermittently regress (e.g. `Communications (1)` briefly shown as `Communications (0)`)
- Evidence:
  - `output/playwright/nav-component-audit-2026-02-24T14-54-28/evidence/client-tab-count-mismatch-comm-reset-to-zero-20260224-152745.png`
  - Prior related: `client-note-count-reset-after-tab-switch-20260224-150019.png`, `client-task-count-reset-after-comm-tab-20260224-150318.png`
- Needed for production:
  - Single source of truth for tab counts and tab data (shared cache key)
  - Mutation invalidation consistency after note/task/communication creates
  - Add tab-switch consistency e2e assertion

### 3) Settings profile save does not persist phone
- Severity: P1
- Repro:
  1. `/settings` -> Profile
  2. Enter `Phone Number`
  3. Click `Save Changes`
  4. Reload/reopen settings
- Actual:
  - Network payload omits phone (`PUT /api/auth/profile` only sends name/email)
  - Phone value is lost on reload
- Evidence:
  - `output/playwright/nav-component-audit-2026-02-24T14-54-28/evidence/settings-profile-phone-not-persisted-20260224-152423.png`
  - HTTP log from run: `PUT /api/auth/profile` body missing phone
- Needed for production:
  - Wire phone field to request DTO + backend persistence
  - Show save-success only after persisted response includes updated field
  - Add profile persistence integration test

### 4) Settings integrations OAuth start fails without actionable UX
- Severity: P1
- Repro:
  1. `/settings` -> Integrations
  2. Click `Connect with Google`
- Actual: `GET /api/calendar-sync/oauth/google/start` returns `500` with weak user guidance
- Evidence:
  - `output/playwright/nav-component-audit-2026-02-24T14-54-28/evidence/settings-google-oauth-fail-no-feedback-20260224-152343.png`
  - HTTP log: `500` `{ "error": "Failed to start calendar OAuth flow" }`
- Needed for production:
  - Provide clear in-UI error state with next action (misconfig vs transient)
  - Add preflight config check and disable button with explanation when unavailable
  - Add integration test for OAuth-start failure handling

## Additional high-value fixes before production hardening
- Notes/Tasks/Today high-volume rendering needs virtualization/pagination and API-level result limits.
- Pipeline and settings switches/segmented controls need accessible visible controls (not hidden-only inputs).
- Workflows executions pagination should hide/adjust when filtered result count is zero.
- Templates form UX should consistently display required-field errors and use explicit select controls where applicable.
- Analytics time-range controls should be clearly interactive and testable with visible state changes.

## Release gate
- **Do not release with open P0/P1 above.**
- Ship readiness after blockers close: rerun full nav audit + regression checks on calendar create, client tab-count consistency, settings profile persistence, and integrations OAuth error UX.
