// One-time import of the Players table from Supabase into the local SQLite db.
// Usage: node --env-file=.env scripts/import-supabase.js
import { getDb } from '../server/api.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('VITE_SUPABASE_URL and VITE_SUPABASE_KEY must be set in .env');
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/Players?select=*`, {
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
});
if (!res.ok) {
  console.error(`Supabase request failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const players = await res.json();

const insert = getDb().prepare(`
  INSERT INTO Players (player_name, high_score, highest_level, total_wins, total_losses, last_played, created_at)
  VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
  ON CONFLICT(player_name) DO UPDATE SET
    high_score    = MAX(high_score, excluded.high_score),
    highest_level = MAX(highest_level, excluded.highest_level),
    total_wins    = MAX(total_wins, excluded.total_wins),
    total_losses  = MAX(total_losses, excluded.total_losses),
    last_played   = MAX(COALESCE(last_played, ''), COALESCE(excluded.last_played, ''))
`);

for (const p of players) {
  insert.run(
    p.player_name,
    p.high_score ?? 0,
    p.highest_level ?? 0,
    p.total_wins ?? 0,
    p.total_losses ?? 0,
    p.last_played ?? null,
    p.created_at ?? null,
  );
}

const { count } = getDb().prepare('SELECT COUNT(*) AS count FROM Players').get();
console.log(`Imported ${players.length} players from Supabase. Local db now has ${count} players.`);
