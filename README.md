# GameHub

**▶ [Play it](https://just-rice.github.io/gamehub/)**

Fifteen arcade and puzzle classics, written from scratch in vanilla JavaScript.
No engines, no frameworks, no sprite sheets, no dependencies — every game is
drawn with Canvas 2D or plain DOM, and every sound is synthesised with Web Audio.

Flappy Bird · Ping Pong · Snake · Tetris · Breakout · Space Invaders ·
Whack-a-Mole · Simon · 2048 · Minesweeper · Memory Match · Tic Tac Toe ·
Connect Four · Hangman · Wordle

## Running it

```sh
open index.html            # macOS — works straight from the filesystem
python3 -m http.server 8000   # or serve it, http://localhost:8000
```

There is no build step for development. `index.html` loads `js/engine.js`, then
each game file, then `js/main.js`. The games are classic scripts rather than ES
modules specifically so that `file://` works without a server.

## The games

| Game | Category | Scored on |
| --- | --- | --- |
| Flappy Bird | Arcade | pipes passed |
| Ping Pong | Arcade | match wins (first to 7) |
| Snake | Arcade | food eaten |
| Tetris | Puzzle | points |
| Breakout | Arcade | points across levels |
| Space Invaders | Arcade | points across waves |
| Whack-a-Mole | Arcade | hits in 30 seconds |
| Simon | Memory | sequence length |
| 2048 | Puzzle | points |
| Minesweeper | Puzzle | boards cleared (best time per difficulty) |
| Memory Match | Memory | fewest moves (4×4) |
| Tic Tac Toe | Strategy | wins vs. CPU |
| Connect Four | Strategy | wins vs. CPU |
| Hangman | Word | words solved |
| Wordle | Word | words solved |

Tic Tac Toe's hard CPU is full minimax, so it cannot be beaten — a draw is the
best available result. Connect Four uses negamax with alpha-beta pruning to
depth 5 and a positional heuristic that values centre columns and open threats.

## Layout

```
index.html          hub markup + script manifest (order matters)
css/style.css       the entire visual system
js/engine.js        shared mini-engine — see below
js/main.js          hub shell: grid, search, filters, launch/teardown
js/games/*.js       one self-registering file per game
build.py            bundles everything into dist/ single files
```

## The engine

`js/engine.js` exposes a global `GameHub`. A game registers itself:

```js
GameHub.register({
  id: 'snake',            // also the deep-link hash: index.html#snake
  name: 'Snake',
  emoji: '🐍',
  category: 'Arcade',     // becomes a filter chip on the hub
  desc: 'Eat, grow, and try not to eat yourself.',
  controls: 'Arrow keys',  // HTML, shown under the stage
  scoreLabel: 'Best',      // optional, defaults to "Best"
  lowerIsBetter: false,    // set true for times / move counts
  mount: function (api) { /* build the game here */ }
});
```

`mount(api)` gets a fresh session. Everything created through `api` is torn
down automatically when the player leaves, so no game can leak a timer, a
listener, or an animation frame back to the hub.

Useful bits of `api`:

- `api.canvas(w, h)` — DPR-scaled canvas, returns `{el, ctx, w, h}`
- `api.loop(fn)` — rAF loop with clamped `dt` in seconds; freezes when paused
- `api.tick(ms, fn)` — fixed-interval logic tick with a `setRate` handle
- `api.onKey(down, up)` plus `api.keys` for polling held keys
- `api.onSwipe(el, fn)`, `api.dpad(fn)`, `api.buttons([...])` — touch controls
- `api.hudInit([labels])` / `api.hud(label, value)` — the readouts in the bar
- `api.best()` / `api.submit(score)` — per-game high scores in `localStorage`
- `api.overlay({...})` / `api.gameOver({...})` — pause and end-of-game cards
- `api.timeout` / `api.interval` / `api.on` — auto-cleaned wrappers

Adding a game is: drop a file in `js/games/`, add one `<script src>` line to
`index.html`. The hub picks it up, including its filter chip and high score.

## Bundling

```sh
python3 build.py
```

Writes two self-contained files:

- `dist/gamehub.html` — the whole arcade in one file you can email or open offline
- `dist/artifact.html` — a body-only fragment for publishing as a Claude Artifact

Both inline the CSS and every script in the order `index.html` declares, so the
bundle can never drift from the source tree.

## Conventions

- Scores live in `localStorage` under `gh:` keys; "Reset scores" clears them.
- `Esc` always returns to the hub, so no game binds it.
- Every game is playable with a keyboard and with touch.
- Sound is on by default and synthesised on demand; the hub's toggle is stored
  per browser, and the AudioContext is only created on the first tone played.
