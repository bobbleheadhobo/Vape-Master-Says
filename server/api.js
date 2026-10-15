import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.resolve('data', 'vape-master.db');

let db;

export const getDb = () => {
  if (db) return db;

  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS Players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL UNIQUE,
      high_score INTEGER NOT NULL DEFAULT 0,
      highest_level INTEGER NOT NULL DEFAULT 0,
      total_wins INTEGER NOT NULL DEFAULT 0,
      total_losses INTEGER NOT NULL DEFAULT 0,
      last_played TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  return db;
};

const toInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 10_000) reject(new Error('Body too large'));
  });
  req.on('end', () => {
    try {
      resolve(raw ? JSON.parse(raw) : {});
    } catch (err) {
      reject(err);
    }
  });
  req.on('error', reject);
});

const routes = {
  'GET /api/leaderboard': (_body, url) => {
    const limit = Math.min(toInt(url.searchParams.get('limit')) || 10, 100);
    const rows = getDb()
      .prepare(`SELECT player_name, high_score, highest_level, total_wins
                FROM Players ORDER BY high_score DESC LIMIT ?`)
      .all(limit);
    return [200, rows];
  },

  'GET /api/player': (_body, url) => {
    const name = url.searchParams.get('name');
    const row = getDb().prepare('SELECT * FROM Players WHERE player_name = ?').get(name);
    return row ? [200, row] : [404, { message: 'Player not found' }];
  },

  'POST /api/player': (body) => {
    const name = typeof body.player_name === 'string' ? body.player_name.trim() : '';
    if (!name || name.length > 50) return [400, { message: 'Invalid player name' }];

    try {
      const row = getDb()
        .prepare(`INSERT INTO Players (player_name, last_played) VALUES (?, ?) RETURNING *`)
        .get(name, new Date().toISOString());
      return [201, row];
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return [409, { message: 'Player already exists' }];
      throw err;
    }
  },

  'PUT /api/player': (body) => {
    const row = getDb()
      .prepare(`UPDATE Players
                SET high_score = ?, highest_level = ?, total_wins = ?, total_losses = ?, last_played = ?
                WHERE player_name = ? RETURNING *`)
      .get(
        toInt(body.high_score),
        toInt(body.highest_level),
        toInt(body.total_wins),
        toInt(body.total_losses),
        new Date().toISOString(),
        body.player_name,
      );
    return row ? [200, row] : [404, { message: 'Player not found' }];
  },
};

// Connect-style middleware, used by both the Vite dev and preview servers
export const apiMiddleware = async (req, res, next) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();

  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return sendJson(res, 404, { message: 'Not found' });

  try {
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};
    const [status, data] = handler(body, url);
    sendJson(res, status, data);
  } catch (err) {
    console.error('API error:', err);
    sendJson(res, 500, { message: 'Server error' });
  }
};
