// One-time import of the Players table from Supabase into the local SQLite db.
// Usage: node --env-file=.env scripts/import-supabase.js
import { getDb, normalizeName } from '../server/api.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('VITE_SUPABASE_URL and VITE_SUPABASE_KEY must be set in .env');
  process.exit(1);
}

// PostgREST caps each response at its max-rows setting, so page through by id
const fetchAllPlayers = async () => {
  const players = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Players?select=*&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${await res.text()}`);

    const page = await res.json();
    players.push(...page);
    if (page.length < PAGE_SIZE) return players;
  }
};

let players;
try {
  players = await fetchAllPlayers();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const db = getDb();
const insert = db.prepare(`
  INSERT INTO Players (player_name, high_score, highest_level, total_wins, total_losses, last_played, created_at)
  VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
  ON CONFLICT(player_name) DO UPDATE SET
    high_score    = MAX(high_score, excluded.high_score),
    highest_level = MAX(highest_level, excluded.highest_level),
    total_wins    = MAX(total_wins, excluded.total_wins),
    total_losses  = MAX(total_losses, excluded.total_losses),
    last_played   = MAX(COALESCE(last_played, ''), COALESCE(excluded.last_played, ''))
`);

// All or nothing, so a bad row can't leave a half-finished import
db.exec('BEGIN');
try {
  for (const p of players) {
    const name = normalizeName(p.player_name);
    if (!name) throw new Error(`Supabase row id ${p.id} has no player_name`);

    insert.run(
      name,
      p.high_score ?? 0,
      p.highest_level ?? 0,
      p.total_wins ?? 0,
      p.total_losses ?? 0,
      p.last_played ?? null,
      p.created_at ?? null,
    );
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(`Import aborted, nothing was written: ${err.message}`);
  process.exit(1);
}

const { count } = db.prepare('SELECT COUNT(*) AS count FROM Players').get();
console.log(`Imported ${players.length} players from Supabase. Local db now has ${count} players.`);
