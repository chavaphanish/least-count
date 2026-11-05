# Least Count

A browser card game built with React, TypeScript, Vite, and plain responsive CSS. The long-term vision is an online multiplayer card game for web and mobile browsers, featuring real-time gameplay, private game rooms, and strategic low-score challenges.

**Current status: visual prototype only.** The landing page links to a sample card table and a rulebook placeholder. All players and hands are mock data. There is no playable game, scoring, backend, authentication, database, or online multiplayer. A provisional rulebook and initial confirmed decisions are documented; one pickup-eligibility question remains open. The sample hand size, seats, and table piles do not establish game rules.

## Provisional rulebook

The supplied [Rulebook — Edition 2.0 (Working Draft)](RULEBOOK.md) is preserved unchanged for review. Despite its “Official Game Rulebook” heading, it remains provisional and may be refined in later stages. [Confirmed decisions and open questions](docs/rule-clarifications.md) take precedence over conflicting draft text: only the latest eligible discard group can be picked up, empty hands must call Show on their next normal turn, zero-point Show ties award zero to all tied round winners, and there are no special tiebreaker rounds. Pickup eligibility after a penalty draw or timeout remains open. These decisions are documented but not yet implemented.

## Development

Use Node.js 22.12+ (22.x) or Node.js 24+ and npm. Node.js 24 is recommended.

```sh
npm install
npm run dev
```

Vite prints the local development address. For cloud development, use `npm run dev -- --host 0.0.0.0` when external binding is needed. Use the existing checkout; cloud tasks already have isolated environments and do not need an additional worktree.

## Build and preview

```sh
npm run build
npm run preview
```

The build first runs strict TypeScript checks and then creates static assets in `dist/`. The preview command serves those assets locally. There are no required environment variables or external application services. Fonts are bundled locally through Fontsource, with system font fallbacks.

## Tests

```sh
npm test
# Optional interactive watch mode:
npm run test:watch
```

`npm test` runs Vitest once and exits. Tests cover card identities, all 52 standard suit/rank combinations, independent deck creation, deterministic Fisher–Yates swaps, preservation of cards and input order, boundary inputs, and invalid random sources. These are playing-card utilities, not a finalized Least Count rules engine. `createDeck` currently describes a standard deck without jokers; game-specific deck composition remains open.

## Project structure

```text
src/
  game/         Framework-independent card types, deck creation, shuffle, and tests
  components/   Reusable playing cards and page layout
  pages/        Landing page, mock game table, and rulebook placeholder
  App.tsx       Small hash-based screen router
  styles.css    Shared styles and responsive layouts
```

Navigation uses `#/`, `#/game`, and `#/rules` so direct links work on static hosting without server routing. The interface supports keyboard navigation, visible focus indicators, a skip link, screen-reader card labels, and reduced-motion preferences.

## Cloudflare Pages

Use the repository root, build command `npm run build`, and output directory `dist`. Set Node.js to a supported version (recommended: `NODE_VERSION=24`). No Pages Functions, secrets, or backend are needed. Deployments have not been configured or published by this change.

## Next steps

1. Review the provisional rulebook together with the confirmed decisions and resolve the remaining pickup-eligibility question before implementing affected gameplay behavior.
2. Implement and test the rules in `src/game` before connecting them to the table interface.
3. Add real gameplay interactions. Online rooms and multiplayer can follow in a separate phase.
