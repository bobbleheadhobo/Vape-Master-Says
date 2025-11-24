import { createClient } from '@supabase/supabase-js';

// TODO: Get these from your .env file
// Hint: use import.meta.env.VITE_VARIABLE_NAME
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TODO: Write a function to create a new player
export const createPlayer = async (playerName) => {

    const { data, error } = await supabase
        .from('Players')
        .insert([
            { 
                player_name: playerName,
                high_score: 0,
                highest_level: 0,
                total_wins: 0, 
                total_losses: 0,
                last_played: new Date()
             }
        ])
        .select()
        .single();

    if (error) {
    console.error('Error creating player:', error);
    return { data: null, error };
  }
  
  return { data, error: null };
};

export const getLeaderboard = async (limit = 10) => {
  const { data, error } = await supabase
    .from('Players')
    .select('player_name, high_score, highest_level, total_wins')
    .order('high_score', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching leaderboard:', error);
    return { data: null, error };
  }
  
  return { data, error: null };
};

export const getPlayerByName = async (playerName) => {
    const { data, error } = await supabase
        .from('Players')
        .select('*')
        .eq('player_name', playerName)
        .single();

  if (error) {
    console.error('Error fetching player by name:', error);
    return { data: null, error };
  }
  
  return { data, error: null };
};

export const updatePlayerStats = async (playerName, stats) => {
  const { data, error } = await supabase
    .from('Players')
    .update({
      high_score: stats.high_score,
      highest_level: stats.highest_level,
      total_wins: stats.total_wins,
      total_losses: stats.total_losses,
      last_played: new Date()
    })
    .eq('player_name', playerName)
    .select()
    .single();

  if (error) {
    console.error('Error updating player stats:', error);
    return { data: null, error };
  }
  
  return { data, error: null };
};

