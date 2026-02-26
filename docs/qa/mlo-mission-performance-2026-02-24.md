# Mission Performance Findings

- Date: 2026-02-24
- Source run: `output/playwright/mlo-mission/mlo-mission-2026-02-24T13-25-48-564Z`

## Network Summary

```json
{
  "totalRequests": 2555,
  "failedRequests": 0,
  "apiCalls": 283,
  "callsByScreen": [
    {
      "screen": "client-details",
      "calls": 107
    },
    {
      "screen": "clients",
      "calls": 76
    },
    {
      "screen": "dashboard",
      "calls": 38
    },
    {
      "screen": "communications",
      "calls": 35
    },
    {
      "screen": "tasks",
      "calls": 11
    },
    {
      "screen": "pipeline",
      "calls": 6
    },
    {
      "screen": "login",
      "calls": 5
    },
    {
      "screen": "notes",
      "calls": 5
    }
  ],
  "largestPayloads": [
    {
      "url": "http://localhost:5173/node_modules/.vite/deps/@tabler_icons-react.js?v=df8df04c",
      "responseBytes": 2683131,
      "screen": "login"
    },
    {
      "url": "http://localhost:5173/node_modules/.vite/deps/@tabler_icons-react.js?v=df8df04c",
      "responseBytes": 2683131,
      "screen": "clients"
    },
    {
      "url": "http://localhost:5173/node_modules/.vite/deps/@tabler_icons-react.js?v=df8df04c",
      "responseBytes": 2683131,
      "screen": "clients"
    },
    {
      "url": "http://localhost:5173/node_modules/.vite/deps/@tabler_icons-react.js?v=df8df04c",
      "responseBytes": 2683131,
      "screen": "client-details"
    },
    {
      "url": "http://localhost:5173/node_modules/.vite/deps/@tabler_icons-react.js?v=df8df04c",
      "responseBytes": 2683131,
      "screen": "client-details"
    }
  ],
  "failedEndpoints": []
}
```

## Top 5 Slow Screens

| Screen | Load (ms) | DOM Content Loaded (ms) | TTFB (ms) | URL |
|---|---:|---:|---:|---|
| dashboard-cold-start | 618 | 588 | 11 | http://localhost:5173/ |
| tasks-slow-network | 588 | 585 | 17 | http://localhost:5173/tasks |
| clients-10x | 200 | 141 | 25 | http://localhost:5173/clients?q=MLO_MISSION_mlo-mission-2026-02-24T13-25-48-564Z-10x_CLIENT_ |
| pipeline | 175 | 113 | 5 | http://localhost:5173/pipeline |
| clients-empty | 119 | 80 | 5 | http://localhost:5173/clients |
