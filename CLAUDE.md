# Vape Master Says: agent guide

A Simon Says memory game (React + Vite + Tailwind 4) with a shared leaderboard stored in local SQLite. It is self-hosted on the owner's Linux box and served publicly through a reverse proxy on `*.streamvine.app`.

## The one thing to know first

**`dist/` is the live site.** Production is `npm run preview` running as the systemd unit `vape-master.service` (port 4173, `WorkingDirectory` = this repo). Because `vite preview` serves files from `dist/` on disk:

- Running `npm run build` changes what real players see **immediately**, before anything is committed.
- Changes to `server/api.js` or `vite.config.js` only take effect after `sudo systemctl restart vape-master.service`. The API code is loaded once when the server starts.
- `scripts/build.sh` does `npm ci` + build + restart in one go.

When testing, run your own preview on a spare port (`npx vite preview --port 4999 --strictPort`) with `DB_PATH=<scratch file>` so you don't write test players into the real database.

## Layout

| Path | What it is |
|---|---|
| `src/App.jsx` | Almost all UI and game logic: the `App` state machine, plus the modal components (`GameOver`, `GameWin`, `VapeImage`, `VapeSong`, `NameEntry`, `SignInPrompt`, `Leaderboard`), `useLeaderboardRank`, `Confetti`, Web Audio sounds, and the MacroDroid webhook. |
| `src/VapeButton.jsx` | The SVG vape button. |
| `src/config.js` | `WIN_LEVEL`, difficulty curve, win reward (image or song), alert mode. Gameplay tuning goes here, not in `App.jsx`. |
| `src/playerApi.js` | Client for the API. Every function returns `{ data, error }`; `error.status` is the HTTP status (0 = network failure). |
| `server/api.js` | SQLite + four JSON routes, mounted as Connect middleware into both the Vite dev and preview servers by a plugin in `vite.config.js`. There is no separate backend process. |
| `scripts/import-supabase.js` | One-time import from the old Supabase project. Already run; kept for reference. |
| `data/` | `vape-master.db` (all player data) and the raw Supabase export. Gitignored. **Never delete or overwrite it.** It is the only copy of the leaderboard. |

## Data and API

- One table, `Players`: `player_name` is `UNIQUE`; stats are `high_score`, `highest_level`, `total_wins`, `total_losses`.
- Routes: `GET /api/leaderboard?limit=`, `GET /api/player?name=`, `POST /api/player`, `PUT /api/player`.
- `PUT` merges with `MAX(existing, incoming)`, so stats can only go up. This is deliberate: a stale browser or second device must never wipe a score. Don't "fix" it into a plain overwrite.
- Names are trimmed on the server and lowercased by the client.
- The API is unauthenticated, so anyone can post stats. That's an accepted trade-off for a fun game; don't add auth unless asked.
- Uses Node's built-in `node:sqlite` (needs Node ≥ 22.13; the box runs 24). The "SQLite is an experimental feature" warning in the logs is expected and harmless.

## Game state

- `gameState` is one of `idle` → `playing-sequence` ⇄ `user-turn` → `game-over` | `game-win`.
- Stats live in `localStorage` (`vapePlayerName`, `vapeHighScore`, `vapeHighestLevel`, `vapeTotalLosses`, `vapeTotalWins`) and are synced to the server on win or loss. Signing in merges local and server stats by taking the max of each.
- Keyboard: A/S/D/F press the vapes, and Space starts a game. The game-over screen restarts on Space/Enter unless a button has focus; the button handles the key itself, which prevents a double restart.
- On the final level the four tones are scrambled on purpose.
- Endless mode works by setting `GAME_CONFIG.winningLevel = null` at runtime; `startGame` resets it.

## Styling

- Tailwind **v4**, configured in CSS (`src/index.css`); there is no `tailwind.config.js`. Use v4 syntax: `bg-black/75`, not `bg-opacity-*`; `bg-linear-to-r`; `outline-hidden`.
- `src/index.css` holds the global base layer: dark `color-scheme`, selection color, `:focus-visible` outline, the button pointer cursor (v4 removed it) and a `prefers-reduced-motion` kill switch. Custom keyframes (`fade-in`, `shake`, `smoke-puff`) live in `src/App.css`.
- The visual identity is dark gray-900, saturated red/blue/green/yellow vapes, playful emoji in headings and an over-the-top tone. Keep it unless the owner asks for a redesign.
- The timer area has a fixed height per breakpoint so the vapes don't jump when a round starts. If you change the timer's font size, update those heights.

## Commands

```bash
npm run dev       # dev server + API on :5173 (uses the real data/ db unless DB_PATH is set)
npm run build     # updates the LIVE site, see above
npm run lint      # 6 known pre-existing issues in App.jsx (react-hooks rules); don't add new ones
npm audit         # was 0 vulnerabilities after the October 2026 upgrade
```

There is no test suite. Verify changes by running a preview on a spare port and driving it with Playwright. `playwright-core` isn't a project dependency: install it in a scratch directory and point it at `/usr/bin/google-chrome`. Check phone (390×844), tablet (820×1180) and desktop (1440×900). The headless Chrome here has no emoji font, so emoji render as empty boxes in screenshots; that isn't a bug.

## Gotchas

- Don't use `pkill -f <pattern>` when the pattern also appears in your own shell command line; it kills your own shell. Kill by PID instead.
- `.env` holds the MacroDroid webhook ID and alert mode (`VITE_*` values get baked into the client bundle at build time, so rebuild after changing them). The `VITE_SUPABASE_*` values are leftovers that are no longer used.
- The owner commits straight to `main`. Commit and push only when asked.
