# Least Count

Least Count is a browser card game built around reducing the value of your hand, calling Show, and staying below the cumulative elimination cutoff. The long-term vision is card nights with friends through real-time online play and private rooms, on desktop and mobile browsers.

**Current status: local playable practice.** Play full matches against 1–7 simulated opponents in your browser. The game implements the working rulebook and confirmed clarifications, including jokers, 7 penalties, Show, scoring, timers, and elimination. Online multiplayer is not available.

## What works today

- Responsive green felt table for 2–8 players, with selectable cards, card values, current-turn indication, scores, and action feedback.
- One- or two-deck setup, unique physical card identities, Printed Jokers, a Selected Joker indicator, and seven-card starting hands.
- Same-rank discards, mandatory Match and Drop, eligible open pickup, and draw-pile recycling or exhaustion settlement.
- 7 penalty stacking, automatic penalties when no 7 is held, optional acceptance when holding 7, and full-cycle cancellation.
- Show validation, zero-point tied round winners, cumulative scoring, score and timeout elimination, and ordinary next rounds until one match winner remains.
- A single 60-second deadline covering both discard and required draw, retained through navigation and refreshes.
- Simulated opponents using only their own hand and public table information, plus concealed opponent cards and totals-only round results.
- A readable Rules screen and downloads of both rule documents.
- Keyboard-accessible controls, visible focus, a skip link, and responsive layouts.
- Static assets suitable for Cloudflare Pages; no application services or secrets required.

Click **Play Game**, choose the table size, and select **Start local game**. Select one or more cards of the same rank and discard them; the interface then offers any required draw. Show is enabled only at the beginning of an eligible normal turn. At round results, choose the next round or set up a new match after a win.

### Local practice and saving

The human player is **You**. Other seats are simple simulated opponents, not online players. Their strategy reduces their own hand, calls Show at five or less, and responds to 7s without inspecting opponent hands or the closed draw order.

Progress is stored in `sessionStorage` for the current browser tab. Refreshing or visiting the Rules screen does not renew the turn deadline; an expired saved turn is resolved on return. Closing the tab normally ends its saved session. **New game** intentionally replaces progress after confirmation during an active round. If browser storage is unavailable, the UI reports that refreshes will lose progress.

All cards and game state exist on your device, including simulated opponents' hands. Those cards are hidden from the UI, not protected from browser inspection. This is a local practice game, not a secure multiplayer system. Timers use the local clock and can be affected by device time changes or browser suspension. No backend, authentication, database, online rooms, or mobile packaging is included.

## Rulebook and confirmed decisions

Read these documents together:

1. [Rulebook — Edition 2.0 (Working Draft)](RULEBOOK.md): the original uploaded document, preserved unchanged.
2. [Confirmed rule decisions](docs/rule-clarifications.md): the user's clarifications, which **take precedence over conflicting text in the original draft**.

The initial clarification topics have been answered. The overall rulebook remains provisional and can be refined in later stages; newly discovered ambiguities should be clarified before implementing affected behavior.

### Gameplay reference

The local engine follows these rules; the linked documents give the full details:

- **Players and dealing:** 2–8 players, seven starting cards each; one standard deck plus one Printed Joker for 2–4 players, or two decks plus two Printed Jokers for 5–8 players.
- **Selected Joker:** choose a new eligible indicator each round, excluding 7s and Printed Jokers. Remove that physical card from play; the remaining cards of its rank are worth zero.
- **Normal turns:** discard one card or a same-rank group, then draw one replacement unless the discard matches the previously visible top rank. That Match and Drop action requires no draw.
- **Open pickup:** a required replacement draw may come from the immediately preceding player's latest eligible discard group or the draw pile. Older groups are unavailable. Accepting a 7 penalty or timing out clears eligibility, so the next required replacement draw must come from the draw pile. Match and Drop still requires no draw.
- **Power card 7:** starts a two-card penalty, with two more cards per responding 7 action. Multiple 7s in one action still add only two. A full uninterrupted cycle through all active players cancels the penalty.
- **Show:** available at the start of a normal turn with a hand total of five or less. An empty-handed player must call Show at their next normal turn; passing is not allowed. Show cannot be called during a 7 penalty.
- **Zero-point Show ties:** all zero-point players, including the caller, are tied round winners and receive zero round penalties. The caller does not receive the 40-point failed-Show penalty for a zero-point tie. This exception does not extend to positive-point ties.
- **Elimination and winning:** the default cumulative cutoff is 100 points; reaching or exceeding it eliminates a player. Turns have a 60-second limit, with immediate elimination on timeout. There are no special tiebreaker rounds. Ordinary rounds retain cumulative scores until elimination leaves one match winner.

For example, if the final two players each have 99 cumulative points and tie on a zero-point Show, both remain at 99 and play another ordinary round. A tied round result is not a shared match victory.

The linked documents contain the detailed scoring, hand-privacy, penalty, and draw-pile exhaustion rules. Online hand privacy and authoritative timers will require server enforcement in the later multiplayer phase.

## Technology stack

- React 19 and TypeScript with strict type checking.
- Vite for development and static production builds.
- Plain CSS for styling and responsive layouts.
- Vitest for unit tests.
- Locally bundled Fontsource fonts, with system font fallbacks.

## Getting started

Use **Node.js 24** (recommended and recorded in `.nvmrc`) and npm. The package also supports Node.js 22.12+ within 22.x, or Node.js 24+.

From the repository root:

```sh
npm ci
npm run dev
```

`npm ci` installs the committed lockfile without changing it. Use `npm install` when intentionally adding or updating dependencies. Vite prints the development address.

No environment variables, secrets, external application services, or backend are needed for the current local game. In a managed cloud task, use the existing isolated checkout; an additional Git worktree is unnecessary. For cloud access when required, bind the development server with:

```sh
npm run dev -- --host 0.0.0.0
```

### Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server with hot reload. |
| `npm run build` | Run TypeScript checks and build static assets into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally; run the build first. |
| `npm test` | Run Vitest once, noninteractively, and exit. |
| `npm run test:watch` | Run Vitest in interactive watch mode. |
| `npm run test:e2e` | Run Playwright browser tests, starting the app automatically. |

To check and preview a production build:

```sh
npm run build
npm test
npm run preview
```

Unit tests cover card and deck construction, selected-rank values, legal and illegal actions, pickup eligibility, Show and scoring, zero-point ties at 99, full 7 cycles, deadlines, elimination, recycling, exhaustion, saved sessions, and seeded whole matches for 2, 4, and 8 players.

Browser tests cover responsive eight-player tables at 320–1440px, actual card controls, illegal selections, Match and Drop, pickup, refresh recovery, 7 actions, timers, scoring, next rounds, keyboard navigation, rule downloads, and a complete local match through the UI.

To run the Playwright checks (the test runner starts Vite automatically):

```sh
npx playwright install chromium
npm run test:e2e
```

On Linux, `npx playwright install --with-deps chromium` also installs required system libraries when permitted. In the managed environment, the installed system browser can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`. To test built static assets, first run `npm run build`, then set `PLAYWRIGHT_PREVIEW=1` when running the browser tests. Browser artifacts under `test-results/` and `playwright-report/` are ignored.

`createDeck()` remains a standard 52-card utility. `assembleDeck()` and `prepareDeck()` add the rulebook’s one/two-deck composition, Printed Jokers, unique physical identities, and Selected Joker removal. The immutable game reducer accepts an explicit clock and random source for deterministic tests.

## Project structure

```text
RULEBOOK.md                    Original provisional rulebook
README.md                      Project status and development guide
docs/
  rule-clarifications.md       Confirmed decisions overriding draft conflicts
src/
  game/                        Decks, immutable engine, bot strategy, and unit tests
  components/                  Playing cards, round results, and page layout
  pages/                       Landing, playable local table, and Rules screen
  App.tsx                      Hash-based screen navigation
  hooks/                       Local session, timer, and simulated-opponent orchestration
  lib/                         Versioned session storage and validation
  main.tsx                     React entry point
  styles.css                   Shared styles and responsive layouts
e2e/                           Playwright gameplay and responsive browser tests
playwright.config.ts           Development/production browser test setup
public/
  favicon.svg                  Static application icon
```

Keep game state, validation, and scoring independent of React in `src/game`. Reusable display elements belong in `src/components`; screens and their interactions belong in `src/pages`.

Navigation uses `#/`, `#/game`, and `#/rules`, allowing direct links and refreshes on static hosting without server routing.

## Cloudflare Pages

Configure a future Pages deployment with:

| Setting | Value |
|---|---|
| Root directory | Repository root |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `NODE_VERSION=24` |

No Pages Functions or secrets are required for the current static local game. A production multiplayer service is a separate future component. Deployment has not been configured or published as part of this work.

## Development roadmap

1. **Review and refine local practice.** Playtest the provisional rules, improve opponent strategy and usability, and record any additional rule decisions before changing behavior.
2. **Online multiplayer later.** Add private rooms and a server-authoritative game service, protecting private hands and enforcing actions and timers across clients. A static browser-only build cannot enforce these guarantees.
3. **Additional platform work later.** Authentication, databases, and mobile packaging remain outside this phase.

Use pull requests for substantial changes such as gameplay work. Small, trivial updates may go directly to `main` when authorized. Document rule decisions explicitly rather than inventing behavior in code.
