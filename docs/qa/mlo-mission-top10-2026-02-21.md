# Top 10 Ship-Now Improvements

- Date: 2026-02-21
- Source run: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z`

| Rank | Issue | Category | Severity | Priority Score | Effort | Suggested Fix |
|---|---|---|---|---:|---:|---|
| 1 | High API chatter on client-details screen | Performance | P2 | 9 | 2 | Debounce refresh triggers and consolidate parallel fetches on client detail views. |
| 2 | Mission run recorded failed network requests | Reliability | P2 | 8 | 2 | Handle request cancellations explicitly and reduce avoidable retries/timeouts. |
| 3 | Largest frontend payload is over 1 MB | Performance | P2 | 8 | 2 | Split heavy UI/icon bundles and lazy-load rarely used icon sets. |
| 4 | Frequent request failures on http://localhost:3003/api/activities | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 5 | Frequent request failures on http://localhost:3003/api/workflow-executions | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 6 | Frequent request failures on http://localhost:3003/api/users/team | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 7 | Frequent request failures on http://localhost:3003/api/communications | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 8 | Frequent request failures on http://localhost:3003/api/loan-scenarios | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 9 | Frequent request failures on http://localhost:3003/api/tasks | Reliability | P2 | 8 | 2 | Add retry/backoff for transient failures and suppress noisy calls during route transitions. |
| 10 | Inactivity timeout simulation did not force re-authentication | Reliability | P2 | 8 | 2 | Unify inactivity checks across app init and runtime heartbeat timers. |
