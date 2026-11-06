# Player careers, XP, and buddies

These systems do not change Least Count card rules. The authoritative rulebook remains [RULEBOOK.md](RULEBOOK.md).

## Deployment and migration order

1. Back up the Supabase database. Keep the existing `202611050001_profiles.sql` migration applied.
2. Apply `supabase/migrations/202611060001_avatar_limits.sql`, then `202611060002_careers.sql` in the Supabase SQL editor, in that order. These are forward migrations; do not rerun old migrations or remove existing profiles/storage objects. The careers migration has an explicit transaction: a failed statement rolls it back.
3. Deploy the Worker/client PR after review. Leave `CAREER_ENABLED` unset during setup. Guest rooms, local practice, profile edits, and authentication remain available independently of career ingestion.
4. In **Cloudflare → least-count → Settings → Variables and Secrets**, add **`SUPABASE_CAREER_KEY` as a secret**, using a Supabase backend secret key or legacy service-role key. Use Cloudflare's secret entry form or `npx wrangler secret put SUPABASE_CAREER_KEY`. Never put this key in source, chat, a `VITE_` variable, public runtime config, or a build log. Existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` stay public configuration.
5. Add **`CAREER_ORIGIN`** as a Worker secret containing the exact production origin (for example `https://least-count.chavaphanish.workers.dev`), and **`CAREER_ENABLED`** as a Worker secret containing `true`, then deploy. These non-sensitive settings are stored as secret bindings so Wrangler deploys preserve dashboard values; they are never sent to the browser. This opts new all-registered rooms into career recording. Do not enable it in local development, preview Workers, or automated-test environments connected to production Supabase. Use a separate Supabase test project for live integration tests.
   A preview origin cannot start career games against production storage. For full preview room isolation, use a separate Worker/Durable Object namespace and test Supabase project.
6. Verify with two verified test accounts in a new room: finish a round, check the ledger/XP summaries, finish the match, refresh/reconnect, and confirm totals do not change again. Check both Global and Buddies rankings.

Before the runtime bindings are enabled, career requests return an explicit unavailable status without calling external career services. The UI includes retry/empty states if the database migration is missing after enablement. This is not a substitute for applying migrations before enabling the feature. The publishable key cannot apply schema changes or ingest career results. No live schema or secrets are modified by the automated tests.

## Avatar uploads

The reported failure was a photo exceeding the former 2 MB limit. Registered players can now select JPG, PNG or WebP up to **5 MB**. The browser decodes, center-crops, resizes to **512 × 512**, and compresses to WebP before showing a circular preview. Save shows an indeterminate uploading/saving state; Fetch does not provide upload progress, so no artificial percentage is displayed. A failed upload keeps the saved avatar and allows retry of the selected preview.

The Worker bounds request bytes, validates MIME/file signatures, generates a unique `user-id/random-id.extension` path, uploads it, and only then updates the owner profile. Replacing a photo uses a new URL, avoiding stale cached pictures. Removing a photo saves the null profile reference before removing the old object, so a database-save failure preserves the old picture. Failed replacement saves clean up the newly uploaded object. Old-object cleanup is best effort after a successful save; a failed cleanup can leave an unreferenced object, which an administrator can remove later.

The original owner-only Storage insert/update/delete/select policies are still required. The public `avatars` bucket permits only JPG/PNG/WebP MIME types and 5 MB objects. Do not add public write policies. Large original photos are never sent to Storage after browser optimization. Images remain public identity pictures, not private account data. Missing/broken images use the existing initials fallback. Room identities refresh on authenticated view/ticket requests after a profile edit.

## Which games count

- Only **new server-started rooms with all seats belonging to verified registered accounts**, with career recording enabled, are career games. This isolates permanent statistics from guest identity churn and keeps automated/local games out of rankings.
- Mixed guest rooms, all-guest rooms, local practice and recording-disabled preview/test rooms are **casual**: card rules are identical, but no permanent career statistics or XP are created.
- A career participant is a verified seat connected when the host officially starts a valid full room. A disconnected session alone is not an intentional abandonment. Explicitly leaving/signing out while still active is abandonment. Leaving after score/timeout elimination preserves normal final-result eligibility.
- `gamesStarted` counts accepted starts. `gamesPlayed` counts finalized non-abandoned results and equals wins plus losses. `gamesAbandoned` is separate; abandonment does not add a second loss. A score/timeout-eliminated player receives one loss when the match finishes.
- Active matches remain active until the engine produces a final result, or all participants intentionally leave. Untimed rooms with disconnected seats may remain active; disconnection is not invented into a completed game. Historical matches started before this feature are not backfilled.
- Statistics stop adding new round participation/scoring after intentional abandonment. Previously earned round XP remains. No completed-game or victory reward is granted to an abandoning player, even if the unchanged game engine later lists that seat as winner.

## Statistics and calculation definitions

All counters originate from accepted authoritative state transitions; browsers cannot submit results or counters. The profile separates career, scoring, Least declarations, Power Card 7, card actions and playing time.

| Metric | Definition |
|---|---|
| Games won/lost, win rate | Final engine winner and non-abandoned participants; won / finalized games. |
| Rounds played | Rounds started while still an active, non-abandoned participant, including a round ending in timeout. |
| Rounds completed | Finalized rounds where the player appears in the official score result and has not abandoned. |
| Rounds won | Successful **own Least declarations**; another player's zero-point tied win is not counted as an own declaration. |
| Average rounds/game | Rounds participated in **finalized, non-abandoned games** / finalized games; in-progress games do not inflate this ratio. |
| Least metrics | Accepted declarations, successful/failed resolutions, declared hand-total sum, zero declarations, and 40-point failed-declaration penalties. Success rate = successes / attempts; average declared hand = sum / attempts. |
| Power Card 7 | One action per multi-7 drop; count physical 7s separately. Count nonzero penalties initiated/stacked, penalty cards drawn, real participants in full-cycle cancellations, and largest penalty passed. A cancelled sequence does not count an imaginary penalty draw. |
| Card actions | Dropped cards; closed replacement and penalty draws; open pickups; Match and Drop; dropped cards worth zero under the round's indicator. Hidden card identities are never stored in career reports. |
| Scoring | Sum of official round penalties; minimum/maximum completed-round hand total; score and timeout eliminations. Average round penalty = sum / completed rounds. |
| Streaks | Consecutive finalized wins in official completion-time order, with match ID as a stable tie-breaker; losses and explicit abandonment break the streak. Abandonment uses its own server timestamp even if the room completes later. Recomputed on final ingestion to tolerate delayed reports. |
| Playing time | Server-observed active gameplay intervals while not eliminated/abandoned, bounded by last heartbeat + 45 seconds. Lobby waiting and between-round result screens do not count. This is connected participation time, not proof that a tab is foregrounded. |
| Decision time | Complete player-controlled turns only: normal Drop plus replacement is one turn, as are a manually played 7, accepted penalty, or Least declaration. Automatic penalty responses and timeouts do not add deliberate-turn samples. The same turn start survives the Drop → replacement phase. |
| Average/fastest/slowest move | Total completed-turn elapsed milliseconds / completed player-controlled turns; minimum and maximum samples. Zero denominators and unavailable extrema display `—`. |

Server timestamps are stored in milliseconds in reports; SQL start/completion columns use `timestamptz`. The browser formats durations and dates. The server cannot reliably separate animation or thinking time inside a complete turn, or detect foreground/background browser activity: those intervals are not misrepresented as measured attention. Neither telemetry nor animations delay/reset the game deadline.

Final placement is display metadata: the surviving winner comes first, then later elimination, then score and stable player ID for simultaneous eliminations. It does not create a gameplay tiebreaker.

## XP and levels

`career_config` is the single backend reward configuration. Defaults: completed qualifying round **10 XP**, finalized-game participation **25 XP**, victory **75 bonus XP**. Five completed rounds plus a victory earn 150 XP; four rounds plus a loss earn 65 XP. Score/timeout-eliminated participants remain eligible for the 25 XP final reward. Unfinished rounds do not create a round award.

The `xp_transactions` primary key `(user_id, game_id, round_number, event_type)` makes each reward unique. It records the actual XP before/after each award, allowing confirmed level-up messages. Reconnects, HTTP retries, old revisions and finalized-report replays do not create rewards. Central per-user UTC ingestion-day reward caps bound obvious automated room farming (defaults in `career_config`: 200 round rewards and 40 game rewards). Capped game rewards also suppress their associated victory bonus; statistics still record valid play. These are metagame reward limits, not card-rule changes.

Total XP is permanent. Level is derived from total XP, never a separately writable level field:

```
minimum XP for level = levelBase × (level − 1) × level
levelBase = 50 by default
```

Thresholds are 0, 100, 300, 600, 1,000, 1,500, 2,100… XP. The shared progression module derives the current level and within-level progress; the Worker also includes derived progression in public player responses. At 1,250 XP the player is level 5, 250/500 toward level 6. Level base is returned from backend configuration, so rankings and profiles use the same formula. Round/game summaries display actual ledger awards, not speculative client rewards. Pending sync is explicitly labeled and polling is bounded.

## Durable processing and schema

The room observes every validated transition before committing `room` and request-deduplication state together. It retains a private career snapshot with unacknowledged round score outcomes, monotonic counters, sequence cursor, and ingestion revision. The snapshot is a coalescing durable outbox: a later pending revision includes earlier unsent results. Confirmed rounds are removed from the room snapshot and merged by round number into PostgreSQL history; ordinary long games do not retain their entire career history inside one room-storage value. No private hands/draw-pile order are copied into it.

Database ingestion runs asynchronously after the durable game commit. External database latency does not hold the game-action path. A pending snapshot schedules a retry alarm (also for closed rooms). An acknowledgement marks **only the revision actually sent**; changes accepted during the request remain pending. SQL ignores older/equal revisions and already finalized matches. A transaction applies per-match counter deltas, XP ledger inserts, totals and streaks together. Aggregate counters are read directly on profile load; full histories are not replayed per page.

Tables: `career_config`, `career_totals`, `career_matches`, `career_match_players`, `career_opponents`, `xp_transactions`, `buddy_requests`, `buddy_relationships`, `player_blocks`. The existing `profiles` table gains a stable, unique `username`, generated from the player ID; names and avatars are retained. `career_matches.report.rounds` stores finalized round reports inside the authoritative match snapshot rather than a competing independently updated round table. Minima/maxima use min/max updates; additive counters apply only the accepted per-match delta. The ingestion transaction currently serializes writes with an advisory lock for correctness across rooms and daily caps. At substantially higher volume, partition that lock with a consistent user-lock ordering and benchmark leaderboard queries before scaling.

Migrations add ranking/history/relationship/XP-limit indexes. Global ranking and history are paginated. Full history reports load on demand; global/profile/buddy data refreshes at most every 30 seconds on visible pages and on focus, without a global realtime subscription. Rewards briefly poll for ledger confirmation. Database outages leave a durable pending snapshot; inspect Worker alarms and database RPC logs if sync remains pending. They do not fabricate XP or completed games.

## Buddies and privacy

Discovery uses exact public usernames or display-name prefixes, never email. Names need not be unique; `lc_<stable identifier>` usernames distinguish duplicates. Search is limited to 20 results. Requests are bounded to 50 pending outgoing requests. Requests must be accepted by their recipient; the sender may cancel. Recipients may decline. Either buddy may remove the relationship. Blocking removes both requests and accepted relationships and prevents requests in either direction until unblocked by the blocker. Pending/reversed/self relationships are rejected transactionally.

Buddies shows incoming/outgoing/accepted lists and the owner's block list. The dashboard displays incoming-request notices. No unverified online-status badge is shown. An indexed `career_opponents` aggregate avoids replaying history on profile loads. Most Played Against counts finalized shared games once per opponent per game; an owner's win increments wins, that opponent's win increments losses, and a third player's victory increments only games together.

Global XP Ranking uses XP descending, wins descending, then stable UUID ascending. Blocking hides rows without improving the blocker’s absolute global position. Buddies Ranking includes only self and accepted buddies, uses the same ordering, and assigns positions within that group. Top-three entries are highlighted; pages contain ten entries and the current player's rank remains visible outside that page.

All new tables have RLS enabled with no direct anon/authenticated writes. The bounded `career_api` RPC returns allowlisted public fields and enforces identity for private operations. Only `ingest_career_match` has a service-role execution grant. Private helpers cannot be invoked directly by browser roles. New public profiles require verified email, and public discovery excludes anonymous/unverified identities. Public fields are display name, username, avatar, join date, XP, derived level, ranking and aggregate win performance. Emails, tokens, room codes, secret bindings, hidden cards, full telemetry and detailed history/opponent metrics are never returned to other players. Even a participant's own game report strips **other players' private metric snapshots** while retaining official shared scores/results.

## Validation and remaining live checks

Run `npm test`, `npm run typecheck`, `npm run build`, and after building `PLAYWRIGHT_PREVIEW=1 npm run test:e2e`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if using a system Chromium. PostgreSQL migration/permission/transaction tests use PGlite (a dev-only embedded PostgreSQL engine) with minimal Supabase Auth/Storage schema fixtures. Browser provider paths use mocked identities and career responses; guest multiplayer tests run the real local Worker/Durable Objects. No linter is currently configured.

Before production enablement, apply migrations and configure the Worker secret, then verify real verified-email sessions, Storage upload/replace/remove, service-role ingestion, a round/game reward, reconnect idempotency, and two-account buddy acceptance against the actual Supabase project. Embedded PostgreSQL validates SQL behavior, but cannot prove live project policies or secrets were deployed correctly. Achievements and guest-to-registered progress migration are deferred; no historical data is invented.
