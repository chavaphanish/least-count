# TODOS General

- [ ] Adjust the dual logos layout.
- [ ] Make the player profile appear on the top left of the app instead of the game logo. (Only when signed in.)
- [ ] Investigate quit game / stand up from table / exit room options.
- [ ] Simplify local practice with number of bots and threshold.
- [ ] Clicking on profile picture to show a short player overview
- [ ] Top Bar Modifications: Player Profile | Notifications |
- [ ] Noitify Friend requests and messagebox. 
- [ ] Round/Game Completion notification.
- [ ] Cramped layout for keyboard inputs, check input layouts 


# TODOS Specific

## Phase 1: Security and Critical Fixes

- [ ] **01. Protect player privacy:** Remove private names and authentication metadata from multiplayer responses.
- [ ] **02. Prevent duplicate actions:** Improve request ID tracking to prevent repeated execution of the same move.
- [ ] **03. Rate-limit guest registration:** Prevent excessive guest account creation and automated abuse.
- [ ] **04. Rate-limit room creation:** Restrict excessive room creation from individual users or IP addresses.
- [ ] **05. Strengthen action authorization:** Verify permissions for every player action and host-only operation.
- [ ] **06. Audit database security:** Review Supabase RLS policies to prevent unauthorized data access.
- [ ] **07. Clean up expired sessions:** Automatically remove inactive guest sessions, expired tickets, and stale room references.
- [ ] **08. Improve server error handling:** Return consistent and meaningful errors without exposing internal details.
- [ ] **09. Secure account recovery:** Test password resets, email verification, session expiry, and account recovery.
- [ ] **10. Add security regression tests:** Test unauthorized access, hidden-card protection, invalid requests, and replay attacks.

## Phase 2: Multiplayer Stability and Gameplay

- [ ] **11. Improve automatic reconnection:** Restore players to their active games after temporary network interruptions.
- [ ] **12. Handle abandoned untimed games:** Provide a controlled solution when the current player disconnects indefinitely.
- [ ] **13. Prevent multi-tab conflicts:** Stop conflicting actions from multiple browser sessions belonging to the same player.
- [ ] **14. Test simultaneous player actions:** Ensure concurrent requests cannot corrupt or incorrectly advance game state.
- [ ] **15. Synchronize turn timers:** Keep countdown timers accurate and consistent with server-side deadlines.
- [ ] **16. Strengthen Seven-rule handling:** Test stacking, opening sevens, penalties, disconnections, and edge cases.
- [ ] **17. Validate Drop and Draw logic:** Test all card combinations, automatic draws, pickups, and invalid actions.
- [ ] **18. Improve host disconnection handling:** Automatically transfer host privileges without interrupting gameplay.
- [ ] **19. Implement reliable game recovery:** Restore active matches after server restarts or unexpected interruptions.
- [ ] **20. Clean up abandoned rooms:** Automatically close inactive rooms and release associated resources.
- [ ] **21. Test complete multi-round games:** Verify scoring, elimination, round transitions, and winner determination.
- [ ] **22. Improve action confirmations:** Clearly indicate pending, successful, failed, and retried game actions.
- [ ] **23. Display player connection status:** Show disconnected and reconnecting players directly on the game table.
- [ ] **24. Automate round transitions:** Introduce a countdown to automatically begin the next round.
- [ ] **25. Add rematch functionality:** Allow the same group to start another game without creating a new room.

## Phase 3: Mobile UI and User Experience

- [ ] **26. Optimize mobile game layout:** Ensure the game table and controls fit properly on Android and iPhone screens.
- [ ] **27. Improve card selection:** Optimize overlapping cards, touch interactions, and selection visibility.
- [ ] **28. Standardize action buttons:** Apply consistent gold-themed styling, sizing, spacing, and alignment.
- [ ] **29. Enhance card animations:** Improve dealing, dropping, drawing, and pickup animations.
- [ ] **30. Add interactive gameplay tutorial:** Teach new players the essential rules through a short guided game.
- [ ] **31. Add contextual gameplay hints:** Explain available actions and special rules during gameplay.
- [ ] **32. Improve waiting-room interface:** Clearly display players, connection status, settings, and game readiness.
- [ ] **33. Improve PWA installation:** Provide clear installation guidance for Android and iOS users.
- [ ] **34. Fix mobile safe-area issues:** Prevent interface elements from overlapping notches and system navigation controls.
- [ ] **35. Redesign round results:** Present scores, penalties, eliminations, and round transitions more clearly.

## Phase 4: Architecture, Testing, and Performance

- [ ] **36. Modularize the game engine:** Separate gameplay rules, scoring, penalties, validation, and state transitions.
- [ ] **37. Refactor multiplayer server:** Separate WebSocket handling, room management, authentication, and persistence.
- [ ] **38. Standardize code formatting:** Introduce ESLint and consistent formatting rules across the repository.
- [ ] **39. Implement GitHub Actions CI:** Automatically run builds, type checks, unit tests, and end-to-end tests.
- [ ] **40. Expand automated test coverage:** Add edge-case, regression, and property-based gameplay tests.
- [ ] **41. Optimize server state updates:** Reduce unnecessary storage operations and WebSocket broadcasts.
- [ ] **42. Add error monitoring:** Track server failures, connection issues, rejected actions, and unexpected game termination.
- [ ] **43. Improve frontend performance:** Optimize bundle sizes, lazy loading, assets, and initial page loading.
- [ ] **44. Version game-state schemas:** Support safe migration of saved games and historical events between releases.
- [ ] **45. Expand device compatibility testing:** Test major browsers, Android, iOS, PWAs, and unstable network conditions.

## Phase 5: Player Engagement and Release Readiness

- [ ] **46. Improve buddy invitations:** Enable direct game invitations through buddy profiles and shareable room links.
- [ ] **47. Enhance leaderboards:** Improve Global and Buddies rankings, player statistics, scrolling, and compact layouts.
- [ ] **48. Introduce achievements and badges:** Reward victories, winning streaks, successful Least declarations, and milestones.
- [ ] **49. Add detailed match summaries:** Display final standings, round history, notable achievements, and shareable results.
- [ ] **50. Prepare production release:** Verify security, privacy information, monitoring, deployment configuration, and rollback procedures.
