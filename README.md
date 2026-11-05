# Least Count

Least Count is a browser card game built around reducing the value of your hand, calling Show, and staying below the cumulative elimination cutoff. The long-term vision is card nights with friends through real-time online play and private rooms, on desktop and mobile browsers.

**Current status: visual prototype.** The repository includes a responsive landing page, a mock card table, tested card utilities, and a provisional rulebook with confirmed clarifications. Playable turns, scoring, timers, and opponent behavior have not been implemented. The next development phase is a local playable game; online multiplayer will follow later.

## What works today

- Green felt-inspired landing page with Play Game and Rules navigation.
- Visual table with a sample hand, mock opponents, and sample card piles.
- Responsive layouts, keyboard navigation, visible focus indicators, a skip link, and screen-reader card labels.
- Framework-independent standard card creation and non-mutating Fisher–Yates shuffling.
- Static production build suitable for Cloudflare Pages.

The Play Game button currently opens the **table preview**. The Rules screen is still a placeholder; the rulebook is available in this repository. Mock hand sizes, seats, and piles are display fixtures, not gameplay rules. There is no backend, authentication, database, online multiplayer, or mobile packaging.

## Rulebook and confirmed decisions

Read these documents together:

1. [Rulebook — Edition 2.0 (Working Draft)](RULEBOOK.md): the original uploaded document, preserved unchanged.
2. [Confirmed rule decisions](docs/rule-clarifications.md): the user's clarifications, which **take precedence over conflicting text in the original draft**.

The initial clarification topics have been answered. The overall rulebook remains provisional and can be refined in later stages; newly discovered ambiguities should be clarified before implementing affected behavior.

### Gameplay reference for the next phase

These rules describe intended gameplay, not working features:

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

No environment variables, secrets, external application services, or backend are needed for the current prototype. In a managed cloud task, use the existing isolated checkout; an additional Git worktree is unnecessary. For cloud access when required, bind the development server with:

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

To check and preview a production build:

```sh
npm run build
npm test
npm run preview
```

The existing 12 unit tests cover card identities, the 52 standard suit/rank combinations, independent deck creation, deterministic shuffle swaps, input preservation, small decks, and invalid random sources. They do not validate gameplay that has not been implemented.

`createDeck()` currently creates a standard 52-card deck without jokers. The rulebook's game-specific deck assembly, Printed Jokers, Selected Joker handling, and unique identities for duplicate physical cards still need to be implemented.

## Project structure

```text
RULEBOOK.md                    Original provisional rulebook
README.md                      Project status and development guide
docs/
  rule-clarifications.md       Confirmed decisions overriding draft conflicts
src/
  game/                        Framework-independent card utilities and tests
  components/                  Reusable playing cards and page layout
  pages/                       Landing, mock table, and Rules placeholder
  App.tsx                      Hash-based screen navigation
  main.tsx                     React entry point
  styles.css                   Shared styles and responsive layouts
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

No Pages Functions or secrets are required for the current static prototype. A production multiplayer service is a separate future component. Deployment has not been configured or published as part of this work.

## Development roadmap

1. **Next: tested local game engine.** Implement deck assembly, dealing, card values, turn validation, pickup eligibility, Match and Drop, 7 sequences, Show, scoring, elimination, and round transitions using the rulebook plus confirmed decisions.
2. **Local playable table.** Connect the engine to the existing UI, add simulated opponents, turn controls, hand totals, a timer, and round results. Keep the local development mode clearly labeled.
3. **Online multiplayer later.** Add private rooms and a server-authoritative game service, protecting private hands and enforcing actions and timers across clients. Authentication, databases, and mobile packaging are outside the current phase.

Develop changes on review branches and prepare pull requests before merging into `main`. Document additional rule decisions explicitly rather than inventing behavior in code.
