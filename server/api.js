import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(PROJECT_ROOT, process.env.DB_PATH)
  : path.join(PROJECT_ROOT, 'data', 'vape-master.db');

const SQLITE_CONSTRAINT_UNIQUE = 2067;

let db;
let statements;

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

const getStatements = () => {
  if (statements) return statements;

  const conn = getDb();
  statements = {
    leaderboard: conn.prepare(`SELECT player_name, high_score, highest_level, total_wins
                               FROM Players ORDER BY high_score DESC LIMIT ?`),
    getPlayer: conn.prepare('SELECT * FROM Players WHERE player_name = ?'),
    createPlayer: conn.prepare('INSERT INTO Players (player_name, last_played) VALUES (?, ?) RETURNING *'),
    // Stats only ever go up, so stale or partial client state can't wipe them
    updatePlayer: conn.prepare(`UPDATE Players
                                SET high_score = MAX(high_score, ?),
                                    highest_level = MAX(highest_level, ?),
                                    total_wins = MAX(total_wins, ?),
                                    total_losses = MAX(total_losses, ?),
                                    last_played = ?
                                WHERE player_name = ? RETURNING *`),
  };
  return statements;
};

export const normalizeName = (name) => (typeof name === 'string' ? name.trim() : '');

const toInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

class BadRequest extends Error {}

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 10_000) reject(new BadRequest('Body too large'));
  });
  req.on('end', () => {
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return reject(new BadRequest('Invalid JSON'));
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return reject(new BadRequest('Body must be a JSON object'));
    }
    resolve(body);
  });
  req.on('error', reject);
});

const routes = {
  'GET /api/leaderboard': (_body, url) => {
    const limit = Math.min(toInt(url.searchParams.get('limit')) || 10, 100);
    return [200, getStatements().leaderboard.all(limit)];
  },

  'GET /api/player': (_body, url) => {
    const row = getStatements().getPlayer.get(normalizeName(url.searchParams.get('name')));
    return row ? [200, row] : [404, { message: 'Player not found' }];
  },

  'POST /api/player': (body) => {
    const name = normalizeName(body.player_name);
    if (!name || name.length > 50) return [400, { message: 'Invalid player name' }];

    try {
      return [201, getStatements().createPlayer.get(name, new Date().toISOString())];
    } catch (err) {
      if (err.errcode === SQLITE_CONSTRAINT_UNIQUE) return [409, { message: 'Player already exists' }];
      throw err;
    }
  },

  'PUT /api/player': (body) => {
    const row = getStatements().updatePlayer.get(
      toInt(body.high_score),
      toInt(body.highest_level),
      toInt(body.total_wins),
      toInt(body.total_losses),
      new Date().toISOString(),
      normalizeName(body.player_name),
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
    if (err instanceof BadRequest) return sendJson(res, 400, { message: err.message });
    console.error('API error:', err);
    sendJson(res, 500, { message: 'Server error' });
  }
};
