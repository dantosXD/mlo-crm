# Quick Capture MLO Scenario Run

- Date: 2026-02-24
- Role: `mlo@example.com`
- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:3002/api`
- Artifacts: `output/playwright/quick-capture-mlo-2026-02-24T11-05-28`

## Scenario Results

| Scenario | Result | Notes |
|---|---|---|
| Open quick capture (`Ctrl+K`) | Pass | Default action list renders. |
| Quick action: Go to Notes | Pass | Route changed to `/notes`. |
| Quick action: Go to Dashboard | Pass | Route changed to `/`. |
| Quick action: Add New Client + create | Pass | Created `QC MLO RUN 1771949384149`. |
| Client search jump | Pass | Typed client name and opened client details. |
| `/task` natural language (`... client ... tomorrow`) | Pass | Task created and due date interpreted. |
| `/task` template-only | Skip | No task templates available in this account dropdown. |
| `/note` with client in text (immediate after open) | Pass | Fixed. Auto-detection now submits immediately. |
| `/note` with explicit client selection flow | Pass | Note created successfully. |
| `/reminder` natural language | Pass | Reminder created successfully. |
| `/activity` with client in text (immediate after open) | Pass | Fixed. Auto-detection now submits immediately. |
| `/activity` with explicit client selection flow | Pass | Activity logged successfully. |
| Empty slash command guardrail (`/task` then Enter) | Pass | "Input Needed" warning shown. |
| Slash keyboard selection (`/`, ArrowDown, Enter) | Pass | Command prefill worked (`/note `). |

## Fix Applied

### Client auto-detection race after opening Quick Capture

- Category: UX friction / Reliability edge case
- Severity: P2 (resolved in this patch)
- Repro steps:
1. Open Quick Capture (`Ctrl+K`).
2. Immediately type `/note spoke with <full client name> ...` or `/activity called <full client name> ...`.
3. Press Enter quickly.
- Expected: Client is auto-detected and action submits immediately.
- Actual before fix: It often fell back to the "Select a client" screen.
- Actual after fix: Immediate-entry detection works and command submits directly.
- Why it matters: Fast users no longer hit an unnecessary extra step.
- Evidence:
  - Pre-fix:
  - `output/playwright/quick-capture-mlo-2026-02-24T11-05-28/08-activity-detection-falls-back-select-client-20260224-111352.png`
  - `output/playwright/quick-capture-mlo-2026-02-24T11-05-28/09-note-detection-falls-back-select-client-20260224-111406.png`
  - Post-fix:
  - `output/playwright/quick-capture-mlo-2026-02-24T11-05-28/10-postfix-immediate-note-detected-success-20260224-111824.png`
  - `output/playwright/quick-capture-mlo-2026-02-24T11-05-28/scenario-results.json`
- Implemented fix:
  - `frontend/src/components/QuickCapture.tsx`: Quick Capture now awaits client fetch (or an in-flight fetch) before deciding detected-client vs manual selection for `/note` and `/activity`.

## Machine-readable results

- `output/playwright/quick-capture-mlo-2026-02-24T11-05-28/scenario-results.json`
