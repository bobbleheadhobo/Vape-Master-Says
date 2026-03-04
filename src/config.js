export const WIN_LEVEL = 18; // The level to reach to win

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


// Win reward shown after beating the game.
// type: 'certificate' | 'song'
// file: path to the image or audio file in /public
export const WIN_REWARD = {
  type: 'song',
  file: '/Vape_Mystery.mp3',
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