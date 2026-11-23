# Guest visits

Guest accounts live in the existing private SQLite-backed Directory Durable Object. A guest can keep an optional display name. Their generated username is public and can be reused after logout or expiry. Each visit has a distinct session ID. Only the HttpOnly guest cookie authenticates the browser. Existing valid cookies keep their original player IDs and maximum lifetime when restored.

Guests expire after 30 minutes without activity or seven days from login. Closing a tab leaves the session available for restoration until expiry. The server records expiry at its deadline even if an alarm runs late. Logging out removes the temporary account immediately. Refreshes and multiple tabs sharing a cookie are one visit.

## Private statistics

Configure a strong random **production Worker secret** named `GUEST_STATS_TOKEN` to enable administrator access. Send it as a Bearer token to `GET /api/admin/guest-stats` over HTTPS. The response includes total visits, distinct sessions (one per visit), current active guests, UTC login-date counts, and device/browser/OS counts across retained history. These counts describe sessions, not distinct people. The endpoint returns aggregates only. The private Directory SQLite view `guest_visit_history` provides per-session timestamps in Unix milliseconds and duration in milliseconds for authorized infrastructure administrators.

Session timestamps and status are retained for service accounting. Optional IP and coarse device categories require opt-in at login. Global Privacy Control suppresses both. IP comes from Cloudflare ingress; raw user agents are never stored. Missing or purged device information groups as Unknown. Restrict infrastructure access and describe these purposes and retention periods in the deployment's privacy notice.

| Worker variable | Default | Meaning |
| --- | --- | --- |
| GUEST_IP_DAYS | 1 | Days from login before clearing IP |
| GUEST_DEVICE_DAYS | 30 | Days from login before clearing device, browser and OS |
| GUEST_HISTORY_DAYS | 90 | Days from session end before deleting the visit |

Use whole days from 0 through 365. Zero disables storage of the corresponding optional metadata or schedules immediate cleanup of ended visits. Metadata deadlines are set at login. Counts cover retained visits only.
