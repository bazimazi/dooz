# dooz

An in-a-row strategy game. Nine modes across six rule sets — classic Tic Tac
Toe, larger boards, Gomoku, Misère, Gravity, Vanish and Ultimate — against a
six-level AI, a journey of rivals, a daily puzzle, a friend on the same device,
or a stranger on a rated ladder.

One codebase runs everywhere: as a web app, as an installable PWA, as a desktop
app on Windows, macOS and Linux, and as a native app on iOS and Android.

---

## What it is

|                    |                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Modes**          | Classic 3×3 · Grid 6 · Grid 9 · Gomoku 13 · Gomoku 15 · Misère · Vanish · Gravity · Ultimate                                                                       |
| **Play**           | Pass-and-play series with names and a running score · vs AI (6 levels) · practice with hints and engine suggestions · ranked · casual · private rooms · spectating |
| **Solo**           | A journey of six rivals and eighteen stages with star ratings · a pack of proven win-in-N puzzles with a daily puzzle and streaks                                  |
| **Feel**           | Synthesised sound on every move, an optional generative score, haptics, four piece sets to unlock, gravity drops, vanishing marks, win ripples                     |
| **Competitive**    | Accounts, Elo per mode, expanding-band matchmaking, clocks with increment, resign, draw offers, leaderboards                                                       |
| **After the game** | Match history, deterministic replays you can step through, achievements, per-mode statistics                                                                       |

## Offline use

The profile name and avatar, preferences, solo progress, local series score,
and unfinished local/bot games are stored on the device. They work without a
server account. Profile edits for an existing online account are queued and
synced when the connection returns. A server account is created when online
play or password setup needs one.

Previously downloaded online history, replays, and leaderboard snapshots are
cached locally. Current rankings, multiplayer, password setup, sign-in, and
reports require the server. Online ratings and match results remain authoritative
on the server.

The web app must be loaded online once so its service worker can download the
game bundle; native builds include that bundle. To verify the production PWA,
run `npm run build:web`, start `npm run preview -- --port 4173`,
then run `npm run audit:offline` from the repository root.

## The stack, and why

| Layer      | Choice                     | Why this one                                                                                                                                                                     |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language   | TypeScript 7               | The Go-native compiler. Checks the frontend, shared game code, server, and build scripts together.                                                                               |
| UI         | React 19                   | The design is a handful of screens with local state; React's ecosystem is the one everything else here targets.                                                                  |
| Build      | Vite 8 (Rolldown)          | Rust bundler, sub-second production builds, first-class worker and PWA support.                                                                                                  |
| Routing    | TanStack Router            | Type-safe routes **and** type-safe search params, which is where the mode, the difficulty and the room code live.                                                                |
| Styling    | Tailwind CSS v4            | CSS-first `@theme` config, so the palette lives in one file as real CSS variables. Zero runtime.                                                                                 |
| Shell      | Tauri 2                    | The one toolchain that covers desktop **and** mobile from a web frontend. Binaries are a few MB rather than a bundled browser.                                                   |
| State      | Zustand                    | Only the connection and the account need cross-screen state; everything else is component state.                                                                                 |
| Server     | Hono + `ws` on Node        | Small, standards-based, and deployable anywhere that runs Node. No vendor lock.                                                                                                  |
| Storage    | SQLite (`better-sqlite3`)  | Accounts, ratings, matches and replays outlive a restart. Synchronous API, real transactions, one file to back up.                                                               |
| Validation | Zod 4                      | The server treats clients as hostile, so every inbound frame is parsed rather than cast.                                                                                         |
| Test       | Vitest 4 + Testing Library | Same config format as Vite. The engine and the server run headless; the client runs against jsdom, because its reconnect and keyboard behaviour is not observable without a DOM. |
| Lint       | oxlint (+ tsgolint)        | Rust linter with type-aware rules built on TypeScript 7. `typescript-eslint` does not yet support TS 7.                                                                          |

The deliberate trade-off is **web technology everywhere** rather than native UI
per platform. The design leans on gradients, backdrop blur and SVG, all of which
port unchanged this way; a React Native build would have to re-author every
screen and would still need a wrapper for desktop.

## Layout

Run every npm command from the repository root. This is one Vite app with
one `package.json`, one TypeScript config, and a sibling `src-tauri/` directory,
following [Tauri's Vite integration](https://v2.tauri.app/start/frontend/vite/).

```
dooz/
├── package.json       dependencies and commands for every target
├── index.html         Vite entry point
├── vite.config.ts     web/PWA and Tauri frontend build
├── src/
│   ├── main.tsx       React entry point
│   ├── router.tsx     routes and validated search parameters
│   ├── game/          game code in one place
│   │   ├── engine/    pure rules, variants, replay model, and AI search
│   │   ├── bot/       worker and React hooks for the AI opponent
│   │   ├── components/ board, players, controls, and result reveal
│   │   └── useGame.ts local game state; feedback and hints live alongside it
│   ├── screens/       route screens and their composition
│   ├── features/      accounts, online play, journey, puzzles, and progress
│   ├── components/    shared UI and artwork
│   ├── lib/           preferences, audio, API, and UI utilities
│   ├── protocol/      validated wire format shared with the server
│   └── styles/        theme, animations, and fonts
├── src-tauri/         Rust shell, capabilities, native icons, and mobile projects
├── server/            authoritative multiplayer server and SQLite storage
├── public/            static browser/PWA assets
├── assets/brand/      editable artwork sources
└── scripts/           browser audits, icon generation, and engine benchmarks
```

Start with `src/router.tsx` to find a screen, `src/game/useGame.ts` for local
play, and `src/game/engine/index.ts` for the shared game API. Imports beginning
with `@/` resolve to `src/` in Vite, tests, and the server's `tsx` runner.
The server imports the same pure rules and protocol directly; separate npm
packages and generated TypeScript declarations are no longer needed. The online
client sends a cell index and renders the authoritative board returned by the
server.

## The engine

A game is a `GameConfig` — a variant, a board size and a run length — plus the
moves played. Everything else is derived.

```ts
const game = createGame({ variant: 'gomoku', size: 15, winLength: 5 });
const next = applyMove(game, 112); // null if the move is illegal
replay(game.config, X, next!.moves); // the same position, rebuilt
```

Variants live behind one interface (`create`, `canPlay`, `legalMoves`, `apply`)
and are registered in a single map, so adding one touches two files and nothing
else: the server, the client and the AI only ever see `GameState`. Four of the
six share an implementation — `classic`, `gomoku`, `misere` and `gravity` differ
only in the board they use, in which empty squares are open (gravity allows the
lowest free square of each column), and in who a completed line belongs to.
`vanish` keeps each player's three newest marks and lifts the oldest when a
fourth is placed; it needs no extra state, because the marks on the board are
always the last three each player played, so the move list says which leaves
next. `ultimate` is the one with state beyond the board, and it carries it in a
field the others leave null.

Because nothing in the rules reads a clock or a random number, a match is stored
as its config, its opener and its move list. That is what makes replays exact
rather than approximate: the client re-runs the same engine over the same moves.

## The AI

Six levels that differ in three independent ways, not in how much noise is added
to one engine:

- **How far ahead they look.** Beginner does not search; master searches until
  its clock runs out.
- **Which tactics they may use.** Every level takes a win it can see and blocks a
  loss it can see — missing those is not "easy", it is broken. Fork-finding
  unlocks at medium, which is where a human stops being able to win with a
  simple trap.
- **How close to the best move they insist on playing.** Weaker levels pick
  uniformly among the root moves within a score window, so they play a
  defensible move that is simply not the strongest. A forced win is never
  subject to it.

Under that sits an iterative-deepening alpha-beta search with a transposition
table (Zobrist-hashed, with a second hash verified on lookup), killer moves,
threat-based move ordering, and a quiescence extension that follows _forced_
replies only. Positions are scored by their win-windows, with open and closed
threats valued separately — the difference between a three that must be answered
now and one that is already half dead.

3×3 is solved outright from hard upwards. On the larger boards the search is
bounded by wall clock, always has a complete answer in hand when time runs out,
and can be cancelled mid-search when the position it was thinking about is no
longer on screen. Under gravity the same search runs with one candidate per
column instead of the neighbourhood rule, which is both narrower and exact, so
the strong levels afford two extra plies.

Vanish is solved completely. Its positions are two short queues of squares —
73,450 of them reachable — and once both players have three marks down every
position has exactly three moves, so a retrograde analysis labels every one of
them won, lost or drawn, with the exact distance to the end, in about 200ms the
first time the bot is asked. (The result: a first-player win in thirteen plies,
but only from an edge opening; the corners and the centre let the second player
hold.) Levels are weakened by how far down that distance they may see, the same
principle as the search's depth limit. Because draws exist and neither side is
forced to end one, a game with no line is drawn after fifty plies.

```bash
npm run bench    # the full strength ladder
npm run bench:speed
```

## Playing alone

- **The journey.** Six rivals — Pip, Mo, Sage, Bruno, Vex and Nyx, one per bot
  level — with three stages each across every mode. The player always moves
  first, so the stars measure the player rather than a coin toss: one for a
  win, more for winning inside each stage's par. Every stage is winnable; none
  of them puts the player against a level that plays 3×3 perfectly. The rivals
  talk: a taunt when they make a threat, a worry when you do, read off the same
  exact threat check the hints use.
- **Puzzles.** A pack of win-in-N positions from real bot games, each one proved
  by the generator in [`scripts/bench/puzzles.ts`](scripts/bench/puzzles.ts)
  against every defence, with a unique solution and the most stubborn defence
  recorded — so the client plays it back without searching. One of them is the
  daily puzzle, the same for everyone on the same day, with a streak for solving
  on consecutive days and a spoiler-free result to share.
- **Progress.** Records against each bot level, streaks, stars and solved
  puzzles are kept on the device (`features/progress`). They unlock three piece
  sets — Neon, Chalk and Candy — alongside the original Classic set. Nothing
  here is trusted by the server; it is cosmetics and a profile card.

```bash
npm run puzzles  # regenerate the pack: ~5 minutes, byte-identical every run
```

## Sound

Every sound is synthesised with the Web Audio API at the moment it plays
([`src/lib/sound.ts`](src/lib/sound.ts)) — no audio files,
for the same reasons the artwork is inline SVG: nothing to download, works
offline, and it can follow the game. A mark's pitch comes from where it lands,
higher up the board and further right being higher up a D major pentatonic
scale, so a game played out is also a short tune; X is plucked and O is a round
bloop, so the two players are told apart by ear. Gravity marks whistle as they
fall, vanish marks leave with a breath of air, and a win climbs to a chord.

The whole palette stays in one pentatonic key, so any two sounds — two marks,
a win and the music — sit together. The optional ambient score
([`lib/music.ts`](src/lib/music.ts)) is generated the same way and
never repeats. It is off by default, starts only after a gesture (browsers
insist), and pauses in the background. Effects, music, volume and vibration are
separate settings.

## Getting started

```bash
npm install

npm run dev            # client on http://localhost:3000
npm run dev:server     # multiplayer server on http://localhost:8787
npm run dev:all        # both at once
```

Online play needs both. In development the client finds the server on its own;
for anything else see [`.env.example`](.env.example)
and [`server/.env.example`](server/.env.example).

The server creates its SQLite database on first run (`./data/dooz.sqlite` by
default). It is the only thing that needs to persist between deploys.

### Desktop and mobile

These need a [Rust toolchain](https://rustup.rs); everything else does not.

```bash
npm run dev:desktop    # Windows, macOS or Linux window
npm run build:desktop  # installers in src-tauri/target/release/bundle

npm run init:android   # scaffolds src-tauri/gen/android
npm run dev:android    # needs Android Studio + NDK

npm run init:ios       # scaffolds src-tauri/gen/apple
npm run dev:ios        # macOS + Xcode only
```

`gen/` is generated, not committed, and `tauri android init` scaffolds it with
Tauri's own launcher icons. The `init:*` scripts therefore run `tauri icon`
straight afterwards, which overwrites them with the dooz icon. If a device ever
shows the Tauri logo, the project was scaffolded some other way — `npm run
icons` fixes it without a re-init.

The mobile and desktop builds **must** be given `VITE_SERVER_URL`: they are
served from `tauri://localhost` and have no origin to infer a server from. The
webview's content security policy is a static file rather than an environment
variable, so
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)
has to point at the same server.

### Game artwork

The [brand asset guide](assets/brand/README.md) lists the editable sources,
web/PWA icons, native launcher sets, and promotional images. Run `npm run icons`
from the repository root to regenerate the entire set and refresh scaffolded mobile projects.
The icon colors match the game's pink X, amber O, and indigo canvas.

Set `VITE_PUBLIC_URL` to the deployed web app address when building for the web
so social cards use absolute image URLs.

### Everything else

```bash
npm test           # rules, invariants, AI strength, server, protocol, client
npm run typecheck  # all TypeScript source
npm run lint       # oxlint, type-aware
npm run format     # prettier

npm run audit:a11y   # contrast and naming, against a real browser
npm run audit:experience  # teaching, touch, recovery and motion
npm run audit:sheet-back  # repeated selections and every sheet dismissal method
npm run audit:navigation  # return paths, settings, scrolling and phone layouts
```

The [player experience review](docs/PLAYER_EXPERIENCE_REVIEW.md) records the
research, observed friction, implemented improvements, and next playtest priorities.

## Online play

### Identity

Every device gets an account on first launch — no form, no email. The server
issues an id and a token; the token is the only credential, and only its hash is
stored. Attaching a password later is optional and is what lets the same account
be used on a second device.

An account holds one live connection. A second one takes over and the first is
told why, which is the behaviour a reconnect after a crash needs and the
behaviour two tabs fighting over one seat does not.

### What the server decides

Everything that a result depends on:

- whether a move is legal, and whose turn it is;
- whose clock is running, and whether it has run out;
- what a disconnection costs, and when an abandoned game is awarded;
- what a rating changes by.

The client sends a cell index and renders what comes back. It runs the same
rules, but only to draw a board it has already been given — never to decide one.

### Ranked, casual, private

They are kept apart because they are different games socially. Only ranked moves
a rating; leaving one early is a resignation. Private rooms are never rated, and
their codes come from the CSPRNG — a non-cryptographic generator's state can be
recovered from a handful of observed outputs, which would make every later code
predictable.

Ranked matchmaking pairs players inside a rating band that widens the longer
either has waited, because a perfectly fair match that never happens is worse
than a slightly lopsided one that does.

### What the server assumes about clients

Nothing. Beyond the rules above:

- Every inbound frame is parsed against the schema, and every outbound one is
  parsed again by the client — including cross-field checks, so a board that
  disagrees with the config it claims is rejected rather than rendered.
- Nothing but `hello` is accepted before a connection has proved who it is.
- The WebSocket upgrade checks `Origin` against `ALLOWED_ORIGINS`. The CORS
  middleware does not cover this: a WebSocket handshake is not subject to the
  same-origin policy, so without the check any page could open a socket here.
- Credentials are compared in constant time. Passwords go through scrypt with a
  per-account salt; tokens, which are 32 bytes of entropy, through SHA-256.
- A wrong password and an unknown name produce the same answer, after the same
  work.
- Inbound messages are rate-limited per connection, emotes far more tightly than
  that, account creation per address, frames are size-capped, dead sockets are
  dropped by heartbeat, and there are ceilings on sessions, rooms and spectators
  so no map can grow without bound.
- A declined draw offer cannot be repeated until the position has changed.

## Design

The palette comes from the
[Figma file](https://www.figma.com/file/qrujFLqQzWtczHCh8G0FQF) and lives in
[`src/styles/theme.css`](src/styles/theme.css) under
the same names it has there (`b1`–`b10`, `g1`–`g10`, `p1`–`p3`, `y1`–`y3`).

Components never reach for those directly. They use the semantic layer above
them — `canvas`, `surface`, `ink`, `stroke`, `mark-x` — which is what makes the
light theme a block of redefinitions rather than an audit of every file. Both
themes were measured: every piece of text meets WCAG AA against the surface it
is actually painted on, compositing included.

Artwork is inline SVG rather than image files: it scales to any display, needs
no network, and recolours with the theme.

### Animation policy

The game always uses its full animation experience on web, PWA, desktop, and
mobile. OS/browser reduced-motion settings and legacy saved `reducedMotion`
values are intentionally ignored. There is no in-game reduced-motion setting.

Future contributions must preserve animation timing, view transitions,
decorative effects, and result reveal delays regardless of device motion
settings. Do not add `prefers-reduced-motion` overrides, `motion-reduce` or
`motion-safe` utilities, motion preference detection, or a reduced-motion
toggle unless the project owner explicitly changes this policy. Contributor
instructions also live in [AGENTS.md](AGENTS.md).

`npm run audit:animations` and
`npm run audit:experience` check that full animations
remain enabled when the browser reports reduced motion.

## Accessibility

The board is a `role="grid"` of `role="row"`s with a roving tabindex, so it is a
single tab stop and the arrow keys move within it — a 15×15 board would
otherwise put 225 stops in the page's tab order. Home and End jump to the ends
of a row. Cells are never `disabled`, only `aria-disabled`: a disabled button
cannot take focus, and with a roving tabindex that would leave the grid with no
tab stop at all the moment somebody played the anchor cell. Every cell is
labelled by position and contents, and on an Ultimate board by which small board
it belongs to and how that board stands.

Overlays that set `aria-modal` honour it: focus moves in and is restored on
close, Tab wraps inside the panel, and the rest of the page is `inert` for as
long as the panel is up. Turn and status changes are announced through a live
region; a clock announces itself only once it is nearly out, because announcing
every second of both clocks would make the board unusable. The page does not
block zoom. Motion follows the [animation policy](#animation-policy) above.

There are tests for the parts a refactor can silently break — the tab stop, the
arrow keys, the grid structure, the focus trap, and the roles and names of every
composite control. Contrast, target size and "is every control named" need
layout and colour, so they are checked against a real browser by
`npm run audit:a11y`.

## The earlier versions

The game began as one build per framework - React, Vue, Svelte, Solid and
vanilla JavaScript - written as a comparison between them. The React one was the
most complete, and `src/` is the rebuild of it. The others are in the history
rather than the working tree.

## Licence

MIT - see [LICENSE](LICENSE).
