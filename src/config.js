export const WIN_LEVEL = 2; // The level to reach to win

export const GAME_CONFIG = {
  startingLevel: 1,        // The level the game starts at
  winningLevel: WIN_LEVEL, // The level at which you win the game (set to null for endless mode)
};

export const DIFFICULTY_CONFIG = {
  startingTimer: 5,
  sequencePlaybackSpeed: 500,
  timerReduction: {
    enabled: true,
    everyNLevels: 3,
    reductionAmount: 0.5,
    minimumTimer: 2,
  },
  playbackSpeed: {
    enabled: true,
    everyNLevels: 3,
    reductionAmount: 75,
    minimumSpeed: 200,
  },
};


import vapeMysteryFile from './assets/vape_ticket_2.jpg';

// Win reward shown after beating the game.
// type: 'image' | 'song'
// file: imported asset (bundled by Vite with a hashed filename)
export const WIN_REWARD = {
  type: 'image',
  file: vapeMysteryFile,
};



export const ALERT_MODE_ENUM = {
  DISABLED: 'DISABLED',
  WIN_ONLY: 'WIN_ONLY',   // notify only on wins
  ALMOST_WIN: 'ALMOST_WIN', // notify on wins + fails within 3 levels of winning
  ALL: 'ALL',             // notify on every win and fail
};

// Default alert mode when no VITE_ALERT_MODE env var is set.
// Change this to control alerting without touching env vars.
export const DEFAULT_ALERT_MODE = ALERT_MODE_ENUM.ALMOST_WIN;
