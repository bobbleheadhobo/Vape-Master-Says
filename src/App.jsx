import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import VapeButton from './VapeButton';
import {createPlayer, getPlayerByName, getLeaderboard, updatePlayerStats} from './supabaseClient';

const WIN_LEVEL = 15;  // The level to reach to win
// Configuration
const GAME_CONFIG = {
  startingLevel: 1,  // The level the game starts at
  winningLevel: WIN_LEVEL,  // The level at which you win the game (set to null for endless mode)
};

const DIFFICULTY_CONFIG = {
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

// Alert mode enum
const ALERT_MODE = {
  DISABLED: 'DISABLED',
  WIN_ONLY: 'WIN_ONLY',
  ALMOST_WIN: 'ALMOST_WIN',
  ALL: 'ALL'
};

let AlertMode = ALERT_MODE.DISABLED;
const webhookId = import.meta.env.VITE_MACRODROID_WEBHOOK_ID;
if (webhookId){
  AlertMode = import.meta.env.VITE_ALERT_MODE || ALERT_MODE.DISABLED;
}
  




// Utility functions
const calculateTimerDuration = (level) => {
  const config = DIFFICULTY_CONFIG.timerReduction;
  if (!config.enabled) return DIFFICULTY_CONFIG.startingTimer;
  const reductions = Math.floor((level - 1) / config.everyNLevels);
  const reducedTime = DIFFICULTY_CONFIG.startingTimer - (reductions * config.reductionAmount);
  return Math.max(reducedTime, config.minimumTimer);
};

const calculatePlaybackSpeed = (level) => {
  const config = DIFFICULTY_CONFIG.playbackSpeed;
  if (!config.enabled) return DIFFICULTY_CONFIG.sequencePlaybackSpeed;
  const reductions = Math.floor((level - 1) / config.everyNLevels);
  const reducedSpeed = DIFFICULTY_CONFIG.sequencePlaybackSpeed - (reductions * config.reductionAmount);
  return Math.max(reducedSpeed, config.minimumSpeed);
};

// Sound utilities
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;
const frequencies = { 0: 329.63, 1: 392.00, 2: 261.63, 3: 523.25 };

const playButtonSound = (buttonIndex, duration = 200, frequencyMap = null) => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Use custom frequency map if provided, otherwise use default
  const freq = frequencyMap ? frequencyMap[buttonIndex] : frequencies[buttonIndex];
  oscillator.frequency.value = freq;
  
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration / 1000);
};

const playSuccessSound = () => {
  if (!audioContext) return;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = freq;
    oscillator.type = 'sine';
    const startTime = audioContext.currentTime + (i * 0.1);
    gainNode.gain.setValueAtTime(0.2, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  });
};

const playFailSound = () => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 100;
  oscillator.type = 'sawtooth';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

// Webhook utility
const sendWebhook = async (eventType, level, score, highScore, totalLosses) => {
  if (AlertMode === ALERT_MODE.DISABLED) return;
  if (AlertMode === ALERT_MODE.ALL) { /* Always notify */}
  if (AlertMode === ALERT_MODE.WIN_ONLY && eventType !== 'win') return;
  if (AlertMode === ALERT_MODE.ALMOST_WIN) {
    if (eventType === 'win') {
      // Always notify on wins
    } else if (eventType === 'fail' && level < Math.max(GAME_CONFIG.winningLevel - 3, 1)) {
      // Only notify on fails that are close to winning (within 2 levels)
      return;
    }
  }
  


  const vapeName = localStorage.getItem('vapePlayerName') || 'Unknown';
  console.log('Sending webhook for', vapeName);

  const locationData = await getUserLocation();

  const emoji = eventType === 'win' ? '🎉' : '❌';
  const title = `${emoji} Vape Master Says ${emoji}`;
  const message = `${vapeName} ${eventType === 'win' ? 'beat the game' : 'lost the game'} ${emoji}\nLevel: ${level} of ${GAME_CONFIG.winningLevel}\nScore: ${score}\nHigh Score: ${highScore}\nTotal Losses: ${totalLosses}\nLocation: ${locationData.city}, ${locationData.country}`;
  const extra = `IP: ${locationData.ip}`
  const filename = `vape_master.txt`
  
  const url = `https://trigger.macrodroid.com/${webhookId}/universal?title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}&extra=${encodeURIComponent(extra)}&filename=${encodeURIComponent(filename)}`;
  
  try { 
    await fetch(url, { mode: 'no-cors' });
  } catch (error) {
    console.error('Webhook error:', error);
  }
};

// Get user IP address and location
const getUserLocation = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return {
      ip: data.ip || 'Unknown',
      city: data.city || 'Unknown',
      country: data.country_name || 'Unknown'
    };
  } catch (error) {
    return {
      ip: 'Unknown',
      city: 'Unknown',
      country: 'Unknown'
    };
  }
};

// Components
// ColorButton component replaced with VapeButton

const Timer = ({ timeRemaining, maxTime, gameState }) => {
  const isUrgent = timeRemaining < 2;
  
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 text-center">
      <div className={`
        text-white font-bold text-5xl md:text-6xl
        ${isUrgent ? 'text-red-400 animate-pulse' : ''}
        drop-shadow-lg
      `}>
        {timeRemaining > 0 ? `${timeRemaining.toFixed(1)}s` : '0.0s'}
      </div>
      {gameState === 'playing-sequence' && (
        <div className="text-gray-400 text-sm mt-2">Watch...</div>
      )}
      {gameState === 'user-turn' && (
        <div className="text-green-400 text-sm mt-2">Your Turn!</div>
      )}
    </div>
  );
};


const VapeCertificate = ({ onClose }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/src/img/vape_ticket.png';
    link.download = 'vape_ticket.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">🎫 Congratulations! 🎫</h2>
        <p className="text-white text-center mb-8 text-lg">
          You've earned your official Vape Ticket!
          <br />
          <span className="text-gray-400 text-sm mt-2 block">Download it and hit the griddy!</span>
        </p>
        <div className="space-y-4">
          <button
            onClick={handleDownload}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Download Ticket
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const GameWin = ({ level, score, onRestart, onClose, onContinue }) => {
  const [showCertificate, setShowCertificate] = useState(false);
  const [initialHighScore] = useState(() => parseInt(localStorage.getItem('vapeHighScore') || '0'));
  const [initialHighestLevel] = useState(() => parseInt(localStorage.getItem('vapeHighestLevel') || '0'));
  const highScore = initialHighScore;
  const highestLevel = initialHighestLevel;
  const isNewHighScore = score > initialHighScore;
  const isNewHighestLevel = level > initialHighestLevel;
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  
  useEffect(() => {
    const checkLeaderboardRank = async () => {
      const playerName = localStorage.getItem('vapePlayerName');
      if (!playerName || !isNewHighScore) return;
      
      const { data } = await getLeaderboard(3);
      if (data && data.length > 0) {
        // Check if player is already on the leaderboard and their current rank
        const currentRankIndex = data.findIndex(p => p.player_name === playerName);
        const wasOnLeaderboard = currentRankIndex !== -1;
        const oldRank = wasOnLeaderboard ? currentRankIndex + 1 : null;
        
        // Calculate new rank based on new score
        let newRank = null;
        if (data.length < 3 && !wasOnLeaderboard) {
          // Less than 3 players and not on board yet
          newRank = data.length + 1;
        } else if (score > data[0].high_score) {
          newRank = 1;
        } else if (data.length >= 2 && score > data[1].high_score) {
          newRank = 2;
        } else if (data.length >= 3 && score > data[2].high_score) {
          newRank = 3;
        } else if (!wasOnLeaderboard && data.length < 3) {
          // Player is new and fills a spot in top 3
          newRank = data.length + 1;
        }
        
        // Show message if: (1) newly in top 3, OR (2) improved rank in top 3
        if (newRank && (!wasOnLeaderboard || (oldRank && newRank < oldRank))) {
          setLeaderboardRank(newRank);
        }
      } else if (score > 0) {
        // First player ever
        setLeaderboardRank(1);
      }
    };
    
    checkLeaderboardRank();
  }, [score, isNewHighScore]);
  
  useEffect(() => {
    if (isNewHighScore) {
      localStorage.setItem('vapeHighScore', score.toString());
    }
    if (isNewHighestLevel) {
      localStorage.setItem('vapeHighestLevel', level.toString());
    }
  }, [isNewHighScore, score, isNewHighestLevel, level]);
  
  if (showCertificate) {
    return <VapeCertificate onClose={onClose} />;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in pointer-events-none">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 pointer-events-auto">
        <h2 className="text-4xl font-bold text-green-400 mb-6 text-center">🎉 You Win! 🎉</h2>
        <div className="space-y-4 mb-8">
          {leaderboardRank && (
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                leaderboardRank === 1 ? 'text-yellow-400' : 
                leaderboardRank === 2 ? 'text-gray-300' : 
                'text-orange-500'
              }`}>
                {leaderboardRank === 1 ? '🥇 #1 on Leaderboard! 🥇' : 
                 leaderboardRank === 2 ? '🥈 #2 on Leaderboard! 🥈' : 
                 '🥉 #3 on Leaderboard! 🥉'}
              </p>
            </div>
          )}
          <div className="text-center">
            <p className="text-gray-400 text-sm">You completed all levels!</p>
            <p className="text-5xl font-bold text-green-400">{level}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Final Score</p>
            <p className="text-3xl font-bold text-white">{score}</p>
          </div>
          {isNewHighScore && (
            <div className="text-center">
              <p className="text-yellow-400 text-xl font-bold">🎉 New High Score! 🎉</p>
            </div>
          )}
          {!isNewHighScore && highScore > 0 && (
            <div className="text-center">
              <p className="text-gray-400 text-sm">High Score</p>
              <p className="text-xl font-bold text-yellow-400">{highScore}</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <button
            onClick={onContinue}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            ♾️ Continue (Endless Mode)
          </button>
          <button
            onClick={() => setShowCertificate(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            💨 Vape Now
          </button>
        </div>
      </div>
    </div>
  );
};

const GameOver = ({ level, score, onRestart }) => {
  const [initialHighScore] = useState(() => parseInt(localStorage.getItem('vapeHighScore') || '0'));
  const [initialHighestLevel] = useState(() => parseInt(localStorage.getItem('vapeHighestLevel') || '0'));
  const highScore = initialHighScore;
  const highestLevel = initialHighestLevel;
  const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0');
  const isNewHighScore = score > initialHighScore;
  const isNewHighestLevel = level > initialHighestLevel;
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  
  useEffect(() => {
    const checkLeaderboardRank = async () => {
      const playerName = localStorage.getItem('vapePlayerName');
      if (!playerName || !isNewHighScore) return;
      
      const { data } = await getLeaderboard(3);
      if (data && data.length > 0) {
        // Check if player is already on the leaderboard and their current rank
        const currentRankIndex = data.findIndex(p => p.player_name === playerName);
        const wasOnLeaderboard = currentRankIndex !== -1;
        const oldRank = wasOnLeaderboard ? currentRankIndex + 1 : null;
        
        // Calculate new rank based on new score
        let newRank = null;
        if (data.length < 3 && !wasOnLeaderboard) {
          // Less than 3 players and not on board yet
          newRank = data.length + 1;
        } else if (score > data[0].high_score) {
          newRank = 1;
        } else if (data.length >= 2 && score > data[1].high_score) {
          newRank = 2;
        } else if (data.length >= 3 && score > data[2].high_score) {
          newRank = 3;
        } else if (!wasOnLeaderboard && data.length < 3) {
          // Player is new and fills a spot in top 3
          newRank = data.length + 1;
        }
        
        // Show message if: (1) newly in top 3, OR (2) improved rank in top 3
        if (newRank && (!wasOnLeaderboard || (oldRank && newRank < oldRank))) {
          setLeaderboardRank(newRank);
        }
      } else if (score > 0) {
        // First player ever
        setLeaderboardRank(1);
      }
    };
    
    checkLeaderboardRank();
  }, [score, isNewHighScore]);
  
  useEffect(() => {
    if (isNewHighScore) {
      localStorage.setItem('vapeHighScore', score.toString());
    }
    if (isNewHighestLevel) {
      localStorage.setItem('vapeHighestLevel', level.toString());
    }
  }, [isNewHighScore, score, isNewHighestLevel, level]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onRestart]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 animate-fade-in pointer-events-none">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 pointer-events-auto">
        <h2 className="text-4xl font-bold text-white mb-6 text-center">Game Over!</h2>
        <div className="space-y-4 mb-8">
          {leaderboardRank && (
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                leaderboardRank === 1 ? 'text-yellow-400' : 
                leaderboardRank === 2 ? 'text-gray-300' : 
                'text-orange-500'
              }`}>
                {leaderboardRank === 1 ? '🥇 #1 on Leaderboard! 🥇' : 
                 leaderboardRank === 2 ? '🥈 #2 on Leaderboard! 🥈' : 
                 '🥉 #3 on Leaderboard! 🥉'}
              </p>
            </div>
          )}
          <div className="text-center">
            <p className="text-gray-400 text-sm">Level Reached</p>
            <p className="text-5xl font-bold text-blue-400">{level}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm">Final Score</p>
            <p className="text-3xl font-bold text-white">{score}</p>
          </div>
          {isNewHighScore && (
            <div className="text-center">
              <p className="text-yellow-400 text-xl font-bold">🎉 New High Score! 🎉</p>
            </div>
          )}
          {!isNewHighScore && highScore > 0 && (
            <div className="text-center">
              <p className="text-gray-400 text-sm">High Score</p>
              <p className="text-xl font-bold text-yellow-400">{highScore}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-gray-400 text-sm">Total Losses</p>
            <p className="text-xl font-bold text-red-400">{totalLosses}</p>
          </div>
        </div>
        <button
          onClick={onRestart} 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

const NameEntry = ({ onSubmit }) => {
  const [name, setName] = useState('');

  const isValidUsername = (username) => {
    const trimmed = username.trim();
    
    // Check minimum length of 3 characters
    if (trimmed.length < 3) return false;

    if (username.length > 30) return false;
    
    // Only allow letters, numbers, spaces, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9 _-]+$/;
    if (!validPattern.test(trimmed)) return false;
    
    // Must contain at least 3 letters
    const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    return true;
  };

  const handleChange = (e) => {
    setName(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValidUsername(name)) {
      onSubmit(name.trim());
    }
  };

  const isValid = isValidUsername(name);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Welcome to Vape Master Says!</h2>
        <p className="text-gray-400 text-center mb-6">Enter your name to get started</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={handleChange}
            placeholder="Your name"
            className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 ${
              name && !isValid ? 'ring-2 ring-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
            }`}
            autoFocus
            maxLength={20}
          />
          <button
            type="submit"
            disabled={!isValid}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Start Playing
          </button>
        </form>
      </div>
    </div>
  );
};

const SignInPrompt = ({ existingName, onSignIn, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">⚠️ Name Already Exists</h2>
        <p className="text-white text-center mb-6">
          The name <span className="font-bold text-blue-400">"{existingName}"</span> is already taken.
        </p>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Is this your account? Sign in to continue with your existing stats.
        </p>
        <div className="space-y-3">
          <button
            onClick={onSignIn}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Yes, This is Me (Sign In)
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            No, Choose Different Name
          </button>
        </div>
      </div>
    </div>
  );
};

const Leaderboard = ({ onClose }) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const { data, error } = await getLeaderboard(20); // Get top 20
      if (error) {
        setError('Failed to load leaderboard');
        console.error(error);
      } else {
        setLeaderboardData(data || []);
      }
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 sm:p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">🏆 Leaderboard</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-2xl sm:text-3xl font-bold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-white text-xl">Loading...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-xl">{error}</div>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-xl">No players yet. Be the first!</div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header Row - Desktop only */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-gray-400 text-sm font-semibold border-b border-gray-700">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4 text-left">Name</div>
                <div className="col-span-3 text-center">High Score</div>
                <div className="col-span-2 text-center">Level</div>
                <div className="col-span-2 text-center">Wins</div>
              </div>

              {/* Leaderboard Rows */}
              {leaderboardData.map((player, index) => {
                const rank = index + 1;
                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-orange-400' : 'text-gray-400';
                const currentUser = localStorage.getItem('vapePlayerName');
                const isCurrentUser = player.player_name === currentUser;
                
                return (
                  <div 
                    key={index}
                    className={`
                      bg-gray-700 hover:bg-gray-650 
                      rounded-lg transition-colors
                      ${rank <= 3 ? 'ring-2 ring-opacity-80' : ''}
                      ${rank === 1 ? 'ring-amber-400' : ''}
                      ${rank === 2 ? 'ring-slate-200' : ''}
                      ${rank === 3 ? 'ring-orange-400' : ''}
                    `}
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 items-center">
                      <div className={`col-span-1 text-center font-bold ${rankColor} text-xl`}>
                        {rankEmoji || `#${rank}`}
                      </div>
                      
                      <div className={`col-span-4 font-semibold text-lg truncate text-left ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                        {player.player_name}
                      </div>
                      
                      <div className="col-span-3 text-center text-green-400 font-bold text-lg">
                        {player.high_score}
                      </div>
                      
                      <div className="col-span-2 text-center text-blue-400 font-semibold text-base">
                        {player.highest_level}
                      </div>
                      
                      <div className="col-span-2 text-center text-purple-400 font-semibold text-base">
                        {player.total_wins}
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`font-bold ${rankColor} text-lg`}>
                            {rankEmoji || `#${rank}`}
                          </div>
                          <div className={`font-semibold text-base truncate ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                            {player.player_name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center">
                          <div className="text-gray-400 text-xs mb-1">Score</div>
                          <div className="text-green-400 font-bold text-sm">{player.high_score}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 text-xs mb-1">Level</div>
                          <div className="text-blue-400 font-semibold text-sm">{player.highest_level}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 text-xs mb-1">Wins</div>
                          <div className="text-purple-400 font-semibold text-sm">{player.total_wins}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-900 p-4 sm:p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [gameState, setGameState] = useState('idle');
  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [level, setLevel] = useState(GAME_CONFIG.startingLevel);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [activeButton, setActiveButton] = useState(null);
  const [wrongButton, setWrongButton] = useState(null);
  const [correctButton, setCorrectButton] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userName, setUserName] = useState('');
  const [attemptedName, setAttemptedName] = useState('');
  const [scrambledFrequencies, setScrambledFrequencies] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  
  const timerRef = useRef(null);
  const maxTimerRef = useRef(5);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    const storedName = localStorage.getItem('vapePlayerName');
    if (storedName) {
      getPlayerData(storedName);
    } else {
      setShowNameEntry(true);
    }
  }, []);

  const handleNameSubmit = async (name) => {
    name = name.toLowerCase();
    const {data, error} = await getPlayerByName(name);

    if (!data) {
      // Player does not exist, create new
      const {data: newPlayerData, error: createError} = await createPlayer(name);
      if (newPlayerData && !createError) {
        setPlayerData(newPlayerData);
        localStorage.setItem('vapePlayerName', name);
        localStorage.setItem('vapeTotalWins', '0');   
        setUserName(name);
        setShowNameEntry(false);
      }
    } else {
      // Player already exists - ask if they want to sign in
      setAttemptedName(name); // Save the name they tried
      setShowSignInPrompt(true); // Show the prompt
      setShowNameEntry(false); // Hide name entry
    }
  };

  const handleSignIn = async () => {
    // Load their existing data
    await getPlayerData(attemptedName);
    setShowSignInPrompt(false);
  };

  const handleSignInCancel = () => {
    // Go back to name entry
    setShowSignInPrompt(false);
    setShowNameEntry(true);
    setAttemptedName('');
  };

  const getPlayerData = async (name) => {
    const { data, error } = await getPlayerByName(name);
      if (data) {
        setPlayerData(data);
        setUserName(data.player_name);

        // if they were playing offline, merge stats
        // Merge local stats with server stats, keeping the higher values
        let vapeHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
        let vapeHighestLevel = parseInt(localStorage.getItem('vapeHighestLevel') || '0'); // may not reflect perfect accuracy when tracking stats
        let vapeTotalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0');
        let vapeTotalWins = parseInt(localStorage.getItem('vapeTotalWins') || '0');

        const updatedStats = {
          high_score: Math.max(data.high_score, vapeHighScore),
          highest_level: Math.max(data.highest_level, vapeHighestLevel),
          total_losses: Math.max(data.total_losses, vapeTotalLosses),
          total_wins: Math.max(data.total_wins, vapeTotalWins),
        };

        localStorage.setItem('vapePlayerName', data.player_name);
        localStorage.setItem('vapeHighScore', updatedStats.high_score.toString());
        localStorage.setItem('vapeHighestLevel', updatedStats.highest_level.toString());
        localStorage.setItem('vapeTotalLosses', updatedStats.total_losses.toString());
        localStorage.setItem('vapeTotalWins', updatedStats.total_wins.toString());


        await updatePlayerStats(data.player_name, updatedStats);

      } else {
        setShowNameEntry(true);
      }
  };

  const syncPlayerStats = async () => {
    if (!userName) return;
  
      const stats = {
        high_score: parseInt(localStorage.getItem('vapeHighScore') || '0'),
        highest_level: parseInt(localStorage.getItem('vapeHighestLevel') || '0'),
        total_losses: parseInt(localStorage.getItem('vapeTotalLosses') || '0'),
        total_wins: parseInt(localStorage.getItem('vapeTotalWins') || '0')
      };
      
      await updatePlayerStats(userName, stats);
      console.log('Player stats synced.');
  };

    

  // Scramble frequencies when reaching the final level
  useEffect(() => {
    if (level === GAME_CONFIG.winningLevel) {
      // Create a shuffled array of frequency values
      const freqValues = Object.values(frequencies);
      const shuffled = [...freqValues].sort(() => Math.random() - 0.5);
      const scrambledMap = {
        0: shuffled[0],
        1: shuffled[1],
        2: shuffled[2],
        3: shuffled[3]
      };
      setScrambledFrequencies(scrambledMap);
    } else {
      setScrambledFrequencies(null);
    }
  }, [level]);

  const resetTimer = useCallback(() => {
    const duration = calculateTimerDuration(level);
    setTimeRemaining(duration);
    maxTimerRef.current = duration;
  }, [level]);

  const startNewLevel = useCallback(() => {
    const newSequence = [...sequence, Math.floor(Math.random() * 4)];
    setSequence(newSequence);
    setUserInput([]);
    setGameState('playing-sequence');
    resetTimer();
    
    const playbackSpeed = calculatePlaybackSpeed(level);
    
    newSequence.forEach((btnIndex, i) => {
      setTimeout(() => {
        setActiveButton(btnIndex);
        if (soundEnabled) playButtonSound(btnIndex, 200, scrambledFrequencies);
        setTimeout(() => {
          setActiveButton(null);
          if (i === newSequence.length - 1) {
            setGameState('user-turn');
          }
        }, playbackSpeed / 2);
      }, i * playbackSpeed);
    });
  }, [sequence, level, soundEnabled, resetTimer, scrambledFrequencies]);

  const handleButtonClick = useCallback((buttonIndex) => {
    if (gameState !== 'user-turn') return;
    
    const newUserInput = [...userInput, buttonIndex];
    setUserInput(newUserInput);
    
    if (soundEnabled) playButtonSound(buttonIndex, 200, scrambledFrequencies);
    setActiveButton(buttonIndex);
    setTimeout(() => setActiveButton(null), 200);
    
    // Check if wrong button clicked OR if clicking after completing the sequence
    if (sequence[newUserInput.length - 1] !== buttonIndex || newUserInput.length > sequence.length) {
      setWrongButton(buttonIndex);
      playFailSound();
      setGameState('game-over'); // Immediately set to game-over to disable buttons
      setTimeout(async () => {
        const currentHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
        const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0') + 1;
        localStorage.setItem('vapeTotalLosses', totalLosses.toString());
        await syncPlayerStats();
        sendWebhook('fail', level, score, currentHighScore, totalLosses);
      }, 500);
      return;
    }
    
    setCorrectButton(buttonIndex);
    setTimeout(() => setCorrectButton(null), 200);
    resetTimer();
    
    // Increase score for each correct button click
    setScore(score + 10);
    
    if (newUserInput.length === sequence.length) {
      if (soundEnabled) playSuccessSound();
      setGameState('playing-sequence');// Disable buttons immediately after input completion

      
      // Check for win condition
      if (GAME_CONFIG.winningLevel && level >= GAME_CONFIG.winningLevel) {
        setTimeout(async () => {
          setGameState('game-win');
          const currentHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
          const finalScore = score + 10; // Already added 10 above
          const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0')
          const totalWins = parseInt(localStorage.getItem('vapeTotalWins') || '0') + 1;
          localStorage.setItem('vapeTotalWins', totalWins.toString());
          await syncPlayerStats();
          sendWebhook('win', level, finalScore, currentHighScore, totalLosses);
        }, 500);
      } else {
        setTimeout(() => {
          setLevel(level + 1);
        }, 1000);
      }
    }
  }, [gameState, userInput, sequence, level, score, soundEnabled, resetTimer, scrambledFrequencies]);

  const startGame = () => {
    // Reset all game state
    GAME_CONFIG.winningLevel = WIN_LEVEL; // Reset winning level to default
    setSequence([]);
    setUserInput([]);
    setScore(0);
    setWrongButton(null);
    setCorrectButton(null);
    setLevel(GAME_CONFIG.startingLevel);
    setGameState('playing-sequence');

    // Reset timer with starting level duration
    const duration = calculateTimerDuration(GAME_CONFIG.startingLevel);
    setTimeRemaining(duration);
    maxTimerRef.current = duration;
    
    // Set flag and start after state has updated
    gameStartedRef.current = true;
    setTimeout(() => {
      // Generate initial sequence based on starting level
      const initialSequence = Array.from({ length: GAME_CONFIG.startingLevel }, () => Math.floor(Math.random() * 4));
      setSequence(initialSequence);
      setGameState('playing-sequence');
      

      
      const playbackSpeed = calculatePlaybackSpeed(GAME_CONFIG.startingLevel);
      initialSequence.forEach((btnIndex, i) => {
        setTimeout(() => {
          setActiveButton(btnIndex);
          if (soundEnabled) playButtonSound(btnIndex, 200, scrambledFrequencies);
          setTimeout(() => {
            setActiveButton(null);
            if (i === initialSequence.length - 1) {
              setGameState('user-turn');
            }
          }, playbackSpeed / 2);
        }, i * playbackSpeed);
      });
    }, 600);
  };

  useEffect(() => {
    // Only advance when level increases AND game has been started
    if (gameStartedRef.current && level > GAME_CONFIG.startingLevel) {
      startNewLevel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Keyboard controls: a, s, d, f for vape buttons, Space/Enter for Start Game
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle keyboard shortcuts if name entry, sign-in, or leaderboard modals are showing
      // But allow game over modal to handle its own keyboard shortcuts
      if (showNameEntry || showSignInPrompt || showLeaderboard) {
        return;
      }
      
      // Handle Start Game button with Space or Enter when idle
      if (gameState === 'idle' && (e.key === ' ')) {
        e.preventDefault();
        startGame();
        return;
      }

      // Only allow vape button keyboard input during user's turn
      if (gameState !== 'user-turn') return;
      
      const keyMap = {
        'a': 0,
        's': 1,
        'd': 2,
        'f': 3
      };
      
      const buttonIndex = keyMap[e.key.toLowerCase()];
      if (buttonIndex !== undefined) {
        handleButtonClick(buttonIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, handleButtonClick, startGame, showNameEntry, showSignInPrompt, showLeaderboard]);

  useEffect(() => {
    if (gameState === 'user-turn') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 0.1;
          if (newTime <= 0) {
            clearInterval(timerRef.current);
            playFailSound();
            (async () => {
              const currentHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
              const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0') + 1;
              localStorage.setItem('vapeTotalLosses', totalLosses.toString());
              
              // Now we can await!
              await syncPlayerStats();
              
              sendWebhook('fail', level, score, currentHighScore, totalLosses);
            })();
              setGameState('game-over');
            return 0;
          }
          return newTime;
        });
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState, soundEnabled, level, score]);

  const highScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
  const highestLevel = parseInt(localStorage.getItem('vapeHighestLevel') || '0');
  const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0');

  const continueEndlessMode = () => {
    GAME_CONFIG.winningLevel = null; // Enable endless mode
    setGameState('playing-sequence'); // Close the win screen
    setTimeout(() => {
      setLevel(level + 1); // Continue to next level
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl 2xl:max-w-7xl w-full">
      <div className="text-center mb-4 lg:mb-6 2xl:mb-7 relative">
        <div className="relative flex items-center justify-center">
          <h1 className="text-2xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white mb-1 lg:mb-2">Vape Master Says</h1>
          
          {/* Leaderboard button - positioned to the right */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 lg:px-6 2xl:py-3 2xl:px-10 rounded-lg transition-colors text-lg lg:text-base 2xl:text-xl shadow-lg flex items-center gap-3 2xl:gap-3 z-50"
          >
            <span>🏆</span>
            <span className="hidden lg:inline">Leaderboard</span>
          </button>
        </div>
        <p className="text-sm lg:text-base 2xl:text-lg text-gray-400">Beat level {GAME_CONFIG.winningLevel === null ? '∞' : GAME_CONFIG.winningLevel} to find the vape</p>
      </div>        <div className="flex flex-col items-center mb-3 lg:mb-6 2xl:mb-8 gap-2 lg:gap-4 2xl:gap-6">
          
          <div className="grid grid-cols-2 lg:flex gap-3 lg:gap-8 2xl:gap-12 text-white w-full max-w-md lg:max-w-none justify-center">
            <div className="text-center">
              <p className="text-xs lg:text-sm 2xl:text-base text-gray-400">Score</p>
              <p className="text-base lg:text-xl xl:text-2xl 2xl:text-3xl font-bold">{score}</p>
            </div>
            <div className="text-center">
              <p className="text-xs lg:text-sm 2xl:text-base text-gray-400">High Score</p>
              <p className="text-base lg:text-xl xl:text-2xl 2xl:text-3xl font-bold text-yellow-400">{highScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs lg:text-sm 2xl:text-base text-gray-400">Highest Level</p>
              <p className="text-base lg:text-xl xl:text-2xl 2xl:text-3xl font-bold text-green-400">{highestLevel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs lg:text-sm 2xl:text-base text-gray-400">Total Losses</p>
              <p className="text-base lg:text-xl xl:text-2xl 2xl:text-3xl font-bold text-red-400">{totalLosses}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs lg:text-sm 2xl:text-base text-gray-400 mb-1">Current Level</p>
            <p className="text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-blue-400">{level}</p>
          </div>
        </div>

        <div className="flex flex-col items-center mb-3 lg:mb-6 2xl:mb-8 gap-3 lg:gap-5 2xl:gap-7">
          {/* Timer and game state */}
          <div className="text-center">
            {gameState === 'idle' ? (
              <button
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 lg:py-3 2xl:py-4 px-6 lg:px-8 2xl:px-12 rounded-lg transition-colors text-base lg:text-lg 2xl:text-xl shadow-lg"
              >
                Start Game
              </button>
            ) : (
              <div>
                <div className={`
                  text-white font-bold text-3xl lg:text-5xl xl:text-6xl 2xl:text-7xl
                  ${timeRemaining < 2 ? 'text-red-400 animate-pulse' : ''}
                  drop-shadow-lg
                `}>
                  {timeRemaining > 0 ? `${timeRemaining.toFixed(1)}s` : '0.0s'}
                </div>
                {gameState === 'playing-sequence' && (
                  <div className="text-gray-400 text-xs lg:text-sm 2xl:text-base mt-2">Watch the pattern...</div>
                )}
                {gameState === 'user-turn' && (
                  <div className="text-green-400 text-xs lg:text-sm 2xl:text-base mt-2">Your Turn! Click the vapes!</div>
                )}
              </div>
            )}
          </div>

          {/* Vape buttons in a horizontal row */}
          <div className="w-full flex justify-center px-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 lg:gap-6 xl:gap-6 2xl:gap-6 place-items-center">
              <div className="w-28 h-[220px] sm:w-36 sm:h-[280px] md:w-40 md:h-[320px] lg:w-46 lg:h-[350px] xl:w-56 xl:h-[380px] 2xl:w-64 2xl:h-[420px]">
              <VapeButton
                color="red"
                isActive={activeButton === 0}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(0)}
                isWrong={wrongButton === 0}
                isCorrect={correctButton === 0}
              />
            </div>
            <div className="w-28 h-[220px] sm:w-36 sm:h-[280px] md:w-40 md:h-[320px] lg:w-46 lg:h-[350px] xl:w-56 xl:h-[380px] 2xl:w-64 2xl:h-[420px]">
              <VapeButton
                color="blue"
                isActive={activeButton === 1}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(1)}
                isWrong={wrongButton === 1}
                isCorrect={correctButton === 1}
              />
            </div>
            <div className="w-28 h-[220px] sm:w-36 sm:h-[280px] md:w-40 md:h-[320px] lg:w-46 lg:h-[350px] xl:w-56 xl:h-[380px] 2xl:w-64 2xl:h-[420px]">
              <VapeButton
                color="green"
                isActive={activeButton === 2}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(2)}
                isWrong={wrongButton === 2}
                isCorrect={correctButton === 2}
              />
            </div>
            <div className="w-28 h-[220px] sm:w-36 sm:h-[280px] md:w-40 md:h-[320px] lg:w-46 lg:h-[350px] xl:w-56 xl:h-[380px] 2xl:w-64 2xl:h-[420px]">
              <VapeButton
                color="yellow"
                isActive={activeButton === 3}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(3)}
                isWrong={wrongButton === 3}
                isCorrect={correctButton === 3}
              />
            </div>
          </div>
          </div>
        </div>
        {/* <div className="flex gap-4 justify-center">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              soundEnabled 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            Sound: {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div> */}
      </div>

      {gameState === 'game-over' && (
        <GameOver level={level} score={score} onRestart={startGame} />
      )}
      
      {gameState === 'game-win' && (
        <GameWin 
          level={level} 
          score={score} 
          onRestart={startGame} 
          onClose={() => setGameState('idle')}
          onContinue={continueEndlessMode}
        />
      )}

      {showNameEntry && (
        <NameEntry onSubmit={handleNameSubmit} />
      )}

      {showSignInPrompt && (
        <SignInPrompt 
        existingName={attemptedName}
        onSignIn={handleSignIn}
        onCancel={handleSignInCancel}
        />
      )}

      {showLeaderboard && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}

export default App;
