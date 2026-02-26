# Mission Performance Findings

- Date: 2026-02-21
- Source run: `output/playwright/mlo-mission/mlo-mission-2026-02-21T02-52-50-465Z`

## Network Summary

```json
{
  "totalRequests": 5063,
  "failedRequests": 44,
  "apiCalls": 358,
  "callsByScreen": [
    {
      "screen": "client-details",
      "calls": 202
    },
    {
      "screen": "clients",
      "calls": 60
    },
    {
      "screen": "communications",
      "calls": 36
    },
    {
      "screen": "dashboard",
      "calls": 28
    },
    {
      "screen": "tasks",
      "calls": 13
    },
    {
      "screen": "unknown",
      "calls": 7
    },
    {
      "screen": "pipeline",
      "calls": 5
    },
    {
      "screen": "notes",
      "calls": 5
    },
    {
      "screen": "login",
      "calls": 2
    }
  ],
  "largestPayloads": [
    {
      "url": "http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5",
      "responseBytes": 2683131,
      "screen": "login"
    },
    {
      "url": "http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5",
      "responseBytes": 2683131,
      "screen": "clients"
    },
    {
      "url": "http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5",
      "responseBytes": 2683131,
      "screen": "clients"
    },
    {
      "url": "http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5",
      "responseBytes": 2683131,
      "screen": "client-details"
    },
    {
      "url": "http://localhost:5175/node_modules/.vite/deps/@tabler_icons-react.js?v=e01957d5",
      "responseBytes": 2683131,
      "screen": "client-details"
    }
  ],
  "failedEndpoints": [
    {
      "url": "http://localhost:3003/api/activities",
      "status": null,
      "count": 7
    },
    {
      "url": "http://localhost:3003/api/workflow-executions",
      "status": null,
      "count": 5
    },
    {
      "url": "http://localhost:3003/api/users/team",
      "status": null,
      "count": 5
    },
    {
      "url": "http://localhost:3003/api/communications",
      "status": null,
      "count": 5
    },
    {
      "url": "http://localhost:3003/api/loan-scenarios",
      "status": null,
      "count": 3
    },
    {
      "url": "http://localhost:3003/api/tasks",
      "status": null,
      "count": 3
    },
    {
      "url": "http://localhost:3003/api/documents",
      "status": null,
      "count": 3
    },
    {
      "url": "http://localhost:3003/api/notes",
      "status": null,
      "count": 3
    },
    {
      "url": "http://localhost:3003/api/notifications/unread-count",
      "status": null,
      "count": 3
    },
    {
      "url": "http://localhost:3003/api/auth/refresh",
      "status": 400,
      "count": 1
    }
  ]
}
```

## Top 5 Slow Screens

| Screen | Load (ms) | DOM Content Loaded (ms) | TTFB (ms) | URL |
|---|---:|---:|---:|---|
| tasks-slow-network | 835 | 830 | 7 | http://localhost:5175/tasks |
| dashboard-cold-start | 748 | 605 | 7 | http://localhost:5175/ |
| clients-10x | 457 | 376 | 8 | http://localhost:5175/clients?q=MLO_MISSION_mlo-mission-2026-02-21T02-52-50-465Z-10x_CLIENT_ |
| clients-empty | 445 | 434 | 7 | http://localhost:5175/clients |
| pipeline | 442 | 432 | 6 | http://localhost:5175/pipeline |
