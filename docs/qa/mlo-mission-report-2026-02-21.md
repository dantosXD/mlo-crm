# MLO Mission Report

- Date: 2026-02-21
- Run directory: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z`
- Release gate (P0/P1): **PASS**
- Open P0/P1 issues: 0
- Total issues logged: 13
- Total flows executed: 15

## Mission Summary

```json
{
  "runId": "mlo-mission-2026-02-21T02-52-50-465Z",
  "startedAt": "2026-02-21T02:52:50.586Z",
  "endedAt": "2026-02-21T02:56:39.351Z",
  "environment": {
    "baseUrl": "http://localhost:5175",
    "apiBaseUrl": "http://127.0.0.1:3003/api",
    "browser": "chromium",
    "os": "win32 10.0.29531"
  },
  "issueCounts": {
    "P0": 0,
    "P1": 0,
    "P2": 12,
    "P3": 1
  },
  "openP0P1Count": 0,
  "releaseGate": "PASS",
  "top10IssueIds": [
    "ISSUE-005",
    "ISSUE-006",
    "ISSUE-009",
    "ISSUE-010",
    "ISSUE-011",
    "ISSUE-008",
    "ISSUE-007",
    "ISSUE-012",
    "ISSUE-004",
    "ISSUE-003"
  ],
  "quickWinIssueIds": [
    "ISSUE-005",
    "ISSUE-006",
    "ISSUE-009"
  ],
  "notes": [
    "100x skipped by default; set MLO_MISSION_ENABLE_100X=true to attempt.",
    "Inactivity timeout did not trigger in simulated window"
  ]
}
```

## Full Issue Log

### 1. High API chatter on client-details screen
- Issue Title: High API chatter on client-details screen
- Category: Performance
- Severity: P2
- Priority Score: 9 (F:5, P:3, R:3, E:2)
- Flow: pass-b-search-filter-drilldown (PASS_B)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run mission core workflows
  2. Inspect callsByScreen in network summary
- Expected vs Actual: High-traffic screens should avoid unnecessary repeated API calls | 202 API calls recorded for client-details
- Impact: Increases latency and server load during normal operations.
- Suggested fix: Debounce refresh triggers and consolidate parallel fetches on client detail views.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 2. Mission run recorded failed network requests
- Issue Title: Mission run recorded failed network requests
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Review network-summary.json failedRequests
- Expected vs Actual: Core mission flows complete with minimal failed requests | 44 failed requests captured
- Impact: Raises risk of intermittent user-facing errors under real usage.
- Suggested fix: Handle request cancellations explicitly and reduce avoidable retries/timeouts.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 3. Largest frontend payload is over 1 MB
- Issue Title: Largest frontend payload is over 1 MB
- Category: Performance
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-large-data-10x-100x (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Review network-summary.json largestPayloads
- Expected vs Actual: Top static payloads should stay below 1 MB for responsive cold loads | 2683131 bytes served from http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5
- Impact: Slower initial rendering on weaker connections/devices.
- Suggested fix: Split heavy UI/icon bundles and lazy-load rarely used icon sets.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 4. Frequent request failures on http://localhost:3003/api/activities
- Issue Title: Frequent request failures on http://localhost:3003/api/activities
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 7 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 5. Frequent request failures on http://localhost:3003/api/workflow-executions
- Issue Title: Frequent request failures on http://localhost:3003/api/workflow-executions
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 5 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 6. Frequent request failures on http://localhost:3003/api/users/team
- Issue Title: Frequent request failures on http://localhost:3003/api/users/team
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 5 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 7. Frequent request failures on http://localhost:3003/api/communications
- Issue Title: Frequent request failures on http://localhost:3003/api/communications
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 5 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 8. Frequent request failures on http://localhost:3003/api/loan-scenarios
- Issue Title: Frequent request failures on http://localhost:3003/api/loan-scenarios
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 3 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 9. Frequent request failures on http://localhost:3003/api/tasks
- Issue Title: Frequent request failures on http://localhost:3003/api/tasks
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:4, P:3, R:3, E:2)
- Flow: pass-c-network-throttle-offline (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run full mission
  2. Inspect failedEndpoints list in network summary
- Expected vs Actual: Critical endpoints should not repeatedly fail during normal navigation | 3 failures observed
- Impact: Users may see stale panels, missing data, or inconsistent state.
- Suggested fix: Add retry/backoff for transient failures and suppress noisy calls during route transitions.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 10. Inactivity timeout simulation did not force re-authentication
- Issue Title: Inactivity timeout simulation did not force re-authentication
- Category: Reliability
- Severity: P2
- Priority Score: 8 (F:3, P:3, R:4, E:2)
- Flow: pass-c-session-recovery (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Set stale lastActivity in storage
  2. Reload app and wait for inactivity window
- Expected vs Actual: Session should reliably expire after configured inactivity timeout | Session remained active in simulation check
- Impact: Session behavior may be unpredictable for long-lived tabs.
- Suggested fix: Unify inactivity checks across app init and runtime heartbeat timers.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 11. 10x seeded clients are difficult to discover in clients search
- Issue Title: 10x seeded clients are difficult to discover in clients search
- Category: UX friction
- Severity: P2
- Priority Score: 7 (F:3, P:3, R:3, E:2)
- Flow: pass-c-large-data-10x-100x (PASS_C)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Seed 10x mission dataset
  2. Open Clients page
  3. Search for seeded prefix
- Expected vs Actual: Seeded clients appear in list search results | No visible seeded result in UI search check
- Impact: Large-list workflows become hard to validate and navigate quickly.
- Suggested fix: Improve search indexing and expose deterministic sort/filter for recent seeded records.
- Evidence:
  - Screenshot: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/10x-search-discovery-1771642503963.png`
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 12. Mission flow failed: Pipeline move
- Issue Title: Mission flow failed: Pipeline move
- Category: UX friction
- Severity: P2
- Priority Score: 7 (F:3, P:3, R:3, E:2)
- Flow: pass-b-pipeline-status-move (PASS_B)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Run mission flow pass-b-pipeline-status-move
  2. Review flow-metrics friction notes
- Expected vs Actual: Flow completes end-to-end without retries/backtracks. | Flow error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

Expected: [32m"PROCESSING"[39m
Received: [31m"ACTIVE"[39m
- Impact: Introduces uncertainty and extra manual recovery steps for operators.
- Suggested fix: Stabilize flow interactions and add explicit in-app completion feedback.
- Evidence:
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A

### 13. No actionable notifications during mission run
- Issue Title: No actionable notifications during mission run
- Category: UX friction
- Severity: P3
- Priority Score: 5 (F:3, P:2, R:2, E:2)
- Flow: pass-b-notifications-action (PASS_B)
- Environment: Desktop | win32 10.0.29531 | chromium | role=MLO
- Steps to reproduce:
  1. Complete key flows
  2. Open notification center
- Expected vs Actual: At least one actionable event in notification center | Notification center remained empty
- Impact: Reduces trust in bell indicator
- Suggested fix: Emit key action notifications with deep links
- Evidence:
  - Screenshot: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/empty-notifications-1771642419202.png`
  - HAR: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/mission.har`
  - Log: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z/evidence/console.log`
- Extra notes: N/A
