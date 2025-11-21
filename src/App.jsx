import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import VapeButton from './VapeButton';

// Configuration
const GAME_CONFIG = {
  startingLevel: 1,  // The level the game starts at
  winningLevel: 17,  // The level at which you win the game (set to null for endless mode)
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

const AlertMode = import.meta.env.VITE_ALERT_MODE || ALERT_MODE.DISABLED;




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
  if (AlertMode === ALERT_MODE.WIN_ONLY && eventType !== 'win') return;
  if (AlertMode === ALERT_MODE.ALMOST_WIN) {
    if (eventType === 'win') {
      // Always notify on wins
    } else if (eventType === 'fail' && level < Math.max(GAME_CONFIG.winningLevel - 3, 1)) {
      // Only notify on fails that are close to winning (within 2 levels)
      return;
    }
  }
  
  const webhookId = import.meta.env.VITE_MACRODROID_WEBHOOK_ID;
  if (!webhookId) return;

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

const GameWin = ({ level, score, onRestart, onClose }) => {
  const [showCertificate, setShowCertificate] = useState(false);
  const highScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
  const highestLevel = parseInt(localStorage.getItem('vapeHighestLevel') || '0');
  const isNewHighScore = score > highScore;
  const isNewHighestLevel = level > highestLevel;
  
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-4xl font-bold text-green-400 mb-6 text-center">🎉 You Win! 🎉</h2>
        <div className="space-y-4 mb-8">
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
        <button
          onClick={() => setShowCertificate(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          💨 Vape Now
        </button>
      </div>
    </div>
  );
};

const GameOver = ({ level, score, onRestart }) => {
  const highScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
  const highestLevel = parseInt(localStorage.getItem('vapeHighestLevel') || '0');
  const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0');
  const isNewHighScore = score > highScore;
  const isNewHighestLevel = level > highestLevel;
  
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-4xl font-bold text-white mb-6 text-center">Game Over!</h2>
        <div className="space-y-4 mb-8">
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
          onClick={onRestart} // Delay restart by 1 second
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Welcome to Vape Master Says!</h2>
        <p className="text-gray-400 text-center mb-6">Enter your name to get started</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            maxLength={20}
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Start Playing
          </button>
        </form>
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
  const [userName, setUserName] = useState('');
  const [scrambledFrequencies, setScrambledFrequencies] = useState(null);
  
  const timerRef = useRef(null);
  const maxTimerRef = useRef(5);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    const storedName = localStorage.getItem('vapePlayerName');
    if (storedName) {
      setUserName(storedName);
    } else {
      setShowNameEntry(true);
    }
  }, []);

  const handleNameSubmit = (name) => {
    localStorage.setItem('vapePlayerName', name);
    setUserName(name);
    setShowNameEntry(false);
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
        sendWebhook('fail', level, score, currentHighScore, totalLosses);
      }, 500);
      return;
    }
    
    setCorrectButton(buttonIndex);
    setTimeout(() => setCorrectButton(null), 200);
    resetTimer();
    
    if (newUserInput.length === sequence.length) {
      if (soundEnabled) playSuccessSound();
      setScore(score + sequence.length * 10);
      setGameState('playing-sequence');// Disable buttons immediately after input completion

      
      // Check for win condition
      if (GAME_CONFIG.winningLevel && level >= GAME_CONFIG.winningLevel) {
        setTimeout(async () => {
          setGameState('game-win');
          const currentHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
          const finalScore = score + sequence.length * 10;
          const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0')
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
      // Handle Start Game button with Space or Enter when idle
      if (gameState === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
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
  }, [gameState, handleButtonClick, startGame]);

  useEffect(() => {
    if (gameState === 'user-turn') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 0.1;
          if (newTime <= 0) {
            clearInterval(timerRef.current);
            playFailSound();
              const currentHighScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
              const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0') + 1;
              localStorage.setItem('vapeTotalLosses', totalLosses.toString());
              sendWebhook('fail', level, score, currentHighScore, totalLosses);
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
  }, [gameState, soundEnabled]);

  const highScore = parseInt(localStorage.getItem('vapeHighScore') || '0');
  const highestLevel = parseInt(localStorage.getItem('vapeHighestLevel') || '0');
  const totalLosses = parseInt(localStorage.getItem('vapeTotalLosses') || '0');

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-1 md:mb-2">Vape Master Says</h1>
          <p className="text-sm md:text-base text-gray-400">Beat level {GAME_CONFIG.winningLevel} to find the vape</p>
        </div>

        <div className="flex flex-col items-center mb-4 md:mb-8 gap-3 md:gap-4">
          
          <div className="grid grid-cols-2 md:flex gap-4 md:gap-8 text-white w-full max-w-md md:max-w-none justify-center">
            <div className="text-center">
              <p className="text-xs md:text-sm text-gray-400">Score</p>
              <p className="text-lg md:text-2xl font-bold">{score}</p>
            </div>
            <div className="text-center">
              <p className="text-xs md:text-sm text-gray-400">High Score</p>
              <p className="text-lg md:text-2xl font-bold text-yellow-400">{highScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs md:text-sm text-gray-400">Highest Level</p>
              <p className="text-lg md:text-2xl font-bold text-green-400">{highestLevel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs md:text-sm text-gray-400">Total Losses</p>
              <p className="text-lg md:text-2xl font-bold text-red-400">{totalLosses}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs md:text-sm text-gray-400 mb-1">Current Level</p>
            <p className="text-5xl md:text-6xl font-bold text-blue-400">{level}</p>
          </div>
        </div>

        <div className="flex flex-col items-center mb-4 md:mb-8 gap-4 md:gap-8">
          {/* Timer and game state */}
          <div className="text-center">
            {gameState === 'idle' ? (
              <button
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 md:py-3 px-6 md:px-8 rounded-lg transition-colors text-base md:text-lg shadow-lg"
              >
                Start Game
              </button>
            ) : (
              <div>
                <div className={`
                  text-white font-bold text-4xl md:text-6xl
                  ${timeRemaining < 2 ? 'text-red-400 animate-pulse' : ''}
                  drop-shadow-lg
                `}>
                  {timeRemaining > 0 ? `${timeRemaining.toFixed(1)}s` : '0.0s'}
                </div>
                {gameState === 'playing-sequence' && (
                  <div className="text-gray-400 text-xs md:text-sm mt-2">Watch the pattern...</div>
                )}
                {gameState === 'user-turn' && (
                  <div className="text-green-400 text-xs md:text-sm mt-2">Your Turn! Click the vapes!</div>
                )}
              </div>
            )}
          </div>

          {/* Vape buttons in a horizontal row */}
          <div className="w-full flex justify-center px-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-12 place-items-center">
              <div className="w-32 h-[260px] sm:w-40 sm:h-[320px] md:w-56 md:h-[450px] lg:w-64 lg:h-[520px]">
              <VapeButton
                color="red"
                isActive={activeButton === 0}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(0)}
                isWrong={wrongButton === 0}
                isCorrect={correctButton === 0}
              />
            </div>
            <div className="w-32 h-[260px] sm:w-40 sm:h-[320px] md:w-56 md:h-[450px] lg:w-64 lg:h-[520px]">
              <VapeButton
                color="blue"
                isActive={activeButton === 1}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(1)}
                isWrong={wrongButton === 1}
                isCorrect={correctButton === 1}
              />
            </div>
            <div className="w-32 h-[260px] sm:w-40 sm:h-[320px] md:w-56 md:h-[450px] lg:w-64 lg:h-[520px]">
              <VapeButton
                color="green"
                isActive={activeButton === 2}
                isDisabled={gameState !== 'user-turn' || gameState === 'idle'}
                onClick={() => handleButtonClick(2)}
                isWrong={wrongButton === 2}
                isCorrect={correctButton === 2}
              />
            </div>
            <div className="w-32 h-[260px] sm:w-40 sm:h-[320px] md:w-56 md:h-[450px] lg:w-64 lg:h-[520px]">
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
        />
      )}

      {showNameEntry && (
        <NameEntry onSubmit={handleNameSubmit} />
      )}
    </div>
  );
}

export default App;
