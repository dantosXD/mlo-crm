# Mission Flow Maps

- Date: 2026-02-21
- Source run: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z`

| Flow ID | Pass | Status | Duration (ms) | Steps | Retries | Backtracks | Failed Requests | Friction Points |
|---|---|---|---:|---:|---:|---:|---:|---|
| pass-a-cold-start-onboarding | PASS_A | PASS | 5492 | 3 | 0 | 0 | 1 | - |
| pass-a-empty-states-and-wrong-actions | PASS_A | PASS | 14500 | 9 | 0 | 0 | 20 | empty state unclear on notes; empty state unclear on tasks; empty state unclear on documents; empty state unclear on loans |
| pass-b-client-lifecycle | PASS_B | PASS | 8298 | 4 | 0 | 0 | 18 | - |
| pass-b-pipeline-status-move | PASS_B | FAIL | 1252 | 1 | 0 | 0 | 0 | Flow error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

Expected: [32m"PROCESSING"[39m
Received: [31m"ACTIVE"[39m |
| pass-b-client-ops-note-task-call | PASS_B | PASS | 6233 | 3 | 0 | 0 | 0 | - |
| pass-b-documents-request-and-status | PASS_B | PASS | 2410 | 1 | 0 | 0 | 1 | - |
| pass-b-communications-compose-save-send | PASS_B | PASS | 3476 | 2 | 0 | 0 | 1 | - |
| pass-b-search-filter-drilldown | PASS_B | PASS | 4567 | 4 | 0 | 0 | 0 | - |
| pass-b-notifications-action | PASS_B | PASS | 1301 | 1 | 0 | 0 | 0 | - |
| pass-b-role-clarity | PASS_B | PASS | 8424 | 3 | 0 | 0 | 0 | - |
| pass-c-large-data-10x-100x | PASS_C | PASS | 76306 | 2 | 0 | 0 | 0 | 10x seeded clients were not discoverable via clients search. |
| pass-c-session-recovery | PASS_C | PASS | 71027 | 2 | 0 | 0 | 0 | - |
| pass-c-network-throttle-offline | PASS_C | PASS | 3445 | 2 | 0 | 0 | 1 | - |
| pass-c-rapid-actions-and-concurrency | PASS_C | PASS | 7862 | 2 | 0 | 0 | 1 | - |
| pass-c-bulk-and-accessibility-basics | PASS_C | PASS | 3919 | 3 | 0 | 0 | 1 | - |
