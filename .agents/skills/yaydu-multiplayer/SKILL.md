---
name: yaydu-multiplayer
description: Use for YAYDU room creation/join/start, WebSocket state synchronization, authoritative player projections, request retries/concurrency, disconnect/reconnect handling, online presence, or host-role transfers.
---

# YAYDU multiplayer workflow

Read the room/presence flows in [ARCHITECTURE.md](../../../ARCHITECTURE.md) and relevant [GAME_RULES.md](../../../GAME_RULES.md). Load [database skill](../yaydu-database/SKILL.md) only if persistent career/account data is involved.

1. Trace [server/index.ts](../../../server/index.ts) boundary → Directory/GameRoom in [objects.ts](../../../server/objects.ts) → [room.ts](../../../server/room.ts) → shared engine. Pair with [useRoom.ts](../../../src/hooks/useRoom.ts) and [wire/settings types](../../../src/shared/multiplayer.ts).
2. Reproduce with actor identity, membership, connection/ticket expiry, revision, pending request ID and deadline. Distinguish guest feature gating/configuration, API errors and socket errors; do not bypass authorization to make creation succeed.
3. Preserve serialized transitions and persistence, bounded actor/request-ID deduplication and ack/error behavior. Resolve races on the server, not with a client-only disabled button. Do not extend deadlines or automatically queue/replay moves after reconnect.
4. Keep actor IDs server-derived, start/next-round host checks, origin checks, single-use tickets and `view()` allowlist. Never broadcast full RoomRecord/GameState, hidden hands, deck order, bearer tokens or emails.
5. Keep room heartbeat/grace and account-presence semantics separate. Presence uses [shared client](../../../src/presence/client.ts), [provider](../../../src/presence/PresenceProvider.tsx) and [server/presence.ts](../../../server/presence.ts); reuse its 30s/60s multi-session tracking instead of per-avatar timers. Host handover must not change play order/scores/timers and must reject disconnected, eliminated or forfeited targets.
6. Use relevant room/object/host-transfer/presence tests and targeted browser multiplayer cases listed in [testing skill](../yaydu-testing/SKILL.md). Cover duplicate actions, stale tickets, competing requests, disconnects and restoration for the changed path.

Complete when all clients converge on accepted authoritative state, private data stays private, and tested reconnect/concurrency limits are reported. Cloudflare preview origins/live Supabase configuration require separate validation; do not conflate guest-test overrides with production access.
