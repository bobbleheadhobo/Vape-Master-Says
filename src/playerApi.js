// Talks to the local SQLite-backed API in server/api.js
const request = async (method, path, body) => {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: data };
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const createPlayer = async (playerName) => {
  const result = await request('POST', '/api/player', { player_name: playerName });
  if (result.error) console.error('Error creating player:', result.error);
  return result;
};

export const getLeaderboard = async (limit = 10) => {
  const result = await request('GET', `/api/leaderboard?limit=${limit}`);
  if (result.error) console.error('Error fetching leaderboard:', result.error);
  return result;
};

export const getPlayerByName = async (playerName) => {
  // A missing player is expected (new name), so don't log it as an error
  return request('GET', `/api/player?name=${encodeURIComponent(playerName)}`);
};

export const updatePlayerStats = async (playerName, stats) => {
  const result = await request('PUT', '/api/player', {
    player_name: playerName,
    high_score: stats.high_score,
    highest_level: stats.highest_level,
    total_wins: stats.total_wins,
    total_losses: stats.total_losses,
  });
  if (result.error) console.error('Error updating player stats:', result.error);
  return result;
};
