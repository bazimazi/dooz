# dooz

Tic Tac Toe on 3×3, 6×6 and 9×9 boards. Play someone on the same device, play
someone online, or play a bot that cannot be beaten at 3×3.

One codebase runs everywhere: as a web app, as an installable PWA, as a desktop
app on Windows, macOS and Linux, and as a native app on iOS and Android.

---

## The stack, and why

| Layer      | Choice                          | Why this one                                                                                                                                                                                                |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language   | TypeScript 7                    | The Go-native compiler. Type-checks the whole workspace in well under a second.                                                                                                                              |
| UI         | React 19                        | The design is a handful of screens with local state; React's ecosystem is the one everything else here targets.                                                                                              |
| Build      | Vite 8 (Rolldown)               | Rust bundler, sub-second production builds, first-class worker and PWA support.                                                                                                                              |
| Routing    | TanStack Router                 | Type-safe routes **and** type-safe search params, which is where the board size and room code live.                                                                                                          |
| Styling    | Tailwind CSS v4                 | CSS-first `@theme` config, so the Figma palette lives in one file as real CSS variables. Zero runtime.                                                                                                        |
| Shell      | Tauri 2                         | The one toolchain that covers desktop **and** mobile from a web frontend. Binaries are a few MB rather than a bundled browser.                                                                                |
| State      | Zustand                         | Only the online connection needs cross-screen state; everything else is component state.                                                                                                                     |
| Server     | Hono + `ws` on Node             | Small, standards-based, and deployable anywhere that runs Node. No vendor lock.                                                                                                                              |
| Validation | Zod 4                           | The server treats clients as hostile, so every inbound frame is parsed rather than cast.                                                                                                                     |
| Test       | Vitest 4                        | Same config format as Vite; the rules engine is pure TypeScript and needs no DOM.                                                                                                                            |
| Lint       | oxlint (+ tsgolint)             | Rust linter with type-aware rules built on TypeScript 7. `typescript-eslint` does not yet support TS 7.                                                                                                       |

The deliberate trade-off is **web technology everywhere** rather than native UI
per platform. The design leans on gradients, backdrop blur and SVG, all of which
port unchanged this way; a React Native build would have to re-author every
screen and would still need a wrapper for desktop.

## Layout

```
src/
├── packages/
│   ├── engine/      rules, win detection, and the AI — pure TypeScript, no framework
│   └── protocol/    the wire format, shared by client and server
└── apps/
    ├── web/         the client: React + Vite + Tailwind, and the PWA
    ├── server/      authoritative multiplayer server
    └── native/      Tauri shell for desktop and mobile
```

`engine` is a package rather than a folder inside the client because the server
runs the identical rules. The client predicts nothing: it sends a cell index and
renders whatever board comes back.

## Getting started

```bash
cd src
npm install

npm run dev            # client on http://localhost:3000
npm run dev:server     # multiplayer server on http://localhost:8787
```

Online play needs both. In development the client finds the server on its own;
for anything else see `apps/web/.env.example`.

### Desktop and mobile

These need a [Rust toolchain](https://rustup.rs); everything else does not.

```bash
npm run dev:desktop    # Windows, macOS or Linux window
npm run build:desktop  # installers in apps/native/src-tauri/target/release/bundle

npm run tauri --workspace @dooz/native -- android init
npm run dev:android    # needs Android Studio + NDK

npm run tauri --workspace @dooz/native -- ios init
npm run dev:ios        # macOS + Xcode only
```

The mobile and desktop builds **must** be given `VITE_SERVER_URL`: they are
served from `tauri://localhost` and have no origin to infer a server from.

### Everything else

```bash
npm test           # 64 tests: rules, AI, and the full matchmaking flow
npm run typecheck  # whole workspace
npm run lint       # oxlint, type-aware
npm run format     # prettier
npm run build      # production web build
```

## The rules

| Board | Line needed to win |
| ----- | ------------------ |
| 3 × 3 | 3                  |
| 6 × 6 | 4                  |
| 9 × 9 | 5                  |

Larger boards need a shorter line than a full row; requiring nine in a row on a
9×9 board would make every game a draw.

## The bot

`findBestMove` is iterative-deepening alpha-beta with a transposition table,
Zobrist hashing, and move ordering by threat value.

- **3 × 3** is solved outright. There is a test that plays every line a human
  can choose, from both sides, and asserts the bot never loses.
- **6 × 6 and 9 × 9** cannot be solved, so the search works to a time budget and
  falls back on a gomoku-style evaluation that scores each potential winning
  line by how far along it is. Candidate moves are limited to cells near an
  existing mark, which is what keeps the branching factor manageable.
- Winning and blocking moves are found before the search runs, so the bot never
  misses an obvious one because it ran out of time.

The search runs in a Web Worker. A 9×9 search can spend over a second in a tight
loop, which would otherwise freeze the interface for its whole duration.

## Online play

The server holds the game. A client can only ever send a cell index; the server
validates the turn and the move, applies it with the same engine the client
renders with, and broadcasts the result.

- **Quick match** — a queue per board size.
- **Private rooms** — a six-character code, drawn from an alphabet with no `0`/`O`
  or `1`/`I` confusion, shareable as a link.
- **Reconnection** — a client id in `localStorage` reclaims a seat for 45
  seconds, so a locked phone or a switched network does not end the game.
- **Rematch** — takes both players; either can offer.
- Inbound messages are rate-limited per connection, frames are size-capped, and
  dead sockets are dropped by heartbeat.

## Design

Everything comes from the [Figma
file](https://www.figma.com/file/qrujFLqQzWtczHCh8G0FQF). The palette lives in
`apps/web/src/styles/theme.css` under the same names it has there (`b1`–`b8`,
`g1`–`g10`, `p1`–`p3`, `y1`–`y3`).

Artwork is inline SVG rather than image files: it scales to any display, needs
no network, and recolours with the theme. The 109KB background bitmap the
original build shipped is now a few hundred bytes of vector.

## Accessibility

The board is a `role="grid"` with a roving tabindex, so it is a single tab stop
and the arrow keys move within it — a 9×9 board would otherwise put 81 stops in
the page's tab order. Every cell is labelled by position and contents, turn and
status changes are announced through a live region, and the reduced-motion
preference is honoured.

## Licence

MIT.
