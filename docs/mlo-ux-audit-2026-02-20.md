# MLO UX Audit - 2026-02-20

## Scope
- Validate the full MLO workflow as a real user after the UX hardening patch set.
- Confirm fixes for:
  - communications search/filter behavior
  - notes search behavior
  - tasks table action clarity
  - workflow placeholder compatibility
  - session timeout guardrails

## Environment
- App URL: `http://localhost:5173`
- Browser automation: MCP browser automation tools (Playwright CLI wrapper was unavailable in this Windows session because `bash`/WSL was not available).
- Date tested: `2026-02-20`

## User-Flow Scenarios Executed
1. Logged in as admin.
2. Created 3 clients:
   - `MLO UX Hardening A 20260220`
   - `MLO UX Hardening B 20260220`
   - `MLO UX Hardening C 20260220`
3. For each client, completed typical MLO actions:
   - added note
   - added task
   - logged call interaction
4. Communications flow:
   - composed/saved draft communication
   - composed/sent communication
5. Search/discovery checks:
   - communications search by client name
   - notes search by client name
6. Task operations check:
   - reviewed bulk-select affordance and completion/incompletion actions
7. Workflow placeholder compatibility check:
   - changed client status and verified workflow-generated note text rendering.

## Fix Verification Matrix
| Area | Expected | Result |
|---|---|---|
| Communications search input | Search by client name, subject, or body | Passed (`Search by client name, subject, or body...` shown and functional) |
| Communications status filter options | Only `Draft`, `Ready`, `Sent`, `Failed` (+ `All`) | Passed in `/communications` and client `Communications` tab |
| Communications clear filters | Resets search + checkboxes + date/filter state | Passed in UI behavior |
| Notes search semantics | Match note text OR client name | Passed (`MLO UX Hardening C 20260220` returned expected note) |
| Tasks table clarity | Bulk-select intent clearly separated from completion action | Passed (`Select` column label, helper copy, clear action labels) |
| Placeholder compatibility | `{{old_status}}/{{new_status}}` resolves from `fromStatus/toStatus` style data | Passed for newly generated status-change note (`LEAD` -> `PRE_QUALIFIED`) |
| Session timeout hardening | Guardrails + sane defaults via shared parser | Passed by unit tests |

## Additional UX Findings (Post-Fix)
1. Historical unresolved placeholders still visible in old notes.
   - Existing pre-fix records still show `{{old_status}}` / `{{new_status}}`.
   - Impact: users may think templating is still broken.
   - Recommendation: one-time backfill/migration script for historical templated notes, or mark legacy entries visually.

2. Communications fuzzy search can feel noisy for exact-name intent.
   - Searching full client name still returns unrelated rows due broad fuzzy matching.
   - Impact: reduced precision for MLOs expecting exact-client narrowing.
   - Recommendation: add optional exact-mode toggle (`Exact client`) or rank exact client matches first.

3. Notes list can be visually dominated by very long note content.
   - Extremely long notes render full text in list view.
   - Impact: scanability drops on busy MLO days.
   - Recommendation: clamp note preview to 2-3 lines with expand-on-click.

## Automated Validation Run
- Backend tests:
  - `communicationService.search.test.ts`
  - `noteRoutes.search.test.ts`
  - `services/actions/types.test.ts`
  - Result: passed
- Frontend tests:
  - `Communications.filters.test.tsx`
  - `sessionTimeout.test.ts`
  - Result: passed
- Typecheck:
  - frontend + backend
  - Result: passed

## Conclusion
- The audited UX blockers in this patch set are resolved for current user flows.
- Remaining issues are primarily legacy-data visibility and search precision refinements, not regressions in the implemented fixes.
