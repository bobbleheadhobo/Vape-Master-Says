import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import VapeButton from './VapeButton';

// Configuration
const GAME_CONFIG = {
  startingLevel: 1,  // The level the game starts at
  winningLevel: 20,  // The level at which you win the game (set to null for endless mode)
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

const playButtonSound = (buttonIndex, duration = 200) => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = frequencies[buttonIndex];
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

const GameWin = ({ level, score, onRestart }) => {
  const highScore = parseInt(localStorage.getItem('simonHighScore') || '0');
  const isNewHighScore = score > highScore;
  
  useEffect(() => {
    if (isNewHighScore) {
      localStorage.setItem('simonHighScore', score.toString());
    }
  }, [isNewHighScore, score]);
  
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
          onClick={onRestart}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

const GameOver = ({ level, score, onRestart }) => {
  const highScore = parseInt(localStorage.getItem('simonHighScore') || '0');
  const isNewHighScore = score > highScore;
  
  useEffect(() => {
    if (isNewHighScore) {
      localStorage.setItem('simonHighScore', score.toString());
    }
  }, [isNewHighScore, score]);
  
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
  
  const timerRef = useRef(null);
  const maxTimerRef = useRef(5);
  const gameStartedRef = useRef(false);

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
        if (soundEnabled) playButtonSound(btnIndex);
        setTimeout(() => {
          setActiveButton(null);
          if (i === newSequence.length - 1) {
            setGameState('user-turn');
          }
        }, playbackSpeed / 2);
      }, i * playbackSpeed);
    });
  }, [sequence, level, soundEnabled, resetTimer]);

  const handleButtonClick = useCallback((buttonIndex) => {
    if (gameState !== 'user-turn') return;
    
    const newUserInput = [...userInput, buttonIndex];
    setUserInput(newUserInput);
    
    if (soundEnabled) playButtonSound(buttonIndex);
    setActiveButton(buttonIndex);
    setTimeout(() => setActiveButton(null), 200);
    
    if (sequence[newUserInput.length - 1] !== buttonIndex) {
      setWrongButton(buttonIndex);
      if (soundEnabled) playFailSound();
      setTimeout(() => {
        setGameState('game-over');
      }, 500);
      return;
    }
    
    setCorrectButton(buttonIndex);
    setTimeout(() => setCorrectButton(null), 200);
    resetTimer();
    
    if (newUserInput.length === sequence.length) {
      if (soundEnabled) playSuccessSound();
      setScore(score + sequence.length * 10);
      
      // Check for win condition
      if (GAME_CONFIG.winningLevel && level >= GAME_CONFIG.winningLevel) {
        setTimeout(() => {
          setGameState('game-win');
        }, 500);
      } else {
        setTimeout(() => {
          setLevel(level + 1);
        }, 500);
      }
    }
  }, [gameState, userInput, sequence, level, score, soundEnabled, resetTimer]);

  const startGame = () => {
    // Reset all game state
    setSequence([]);
    setUserInput([]);
    setScore(0);
    setWrongButton(null);
    setCorrectButton(null);
    setLevel(GAME_CONFIG.startingLevel);
    
    // Set flag and start after state has updated
    gameStartedRef.current = true;
    setTimeout(() => {
      // Generate initial sequence based on starting level
      const initialSequence = Array.from({ length: GAME_CONFIG.startingLevel }, () => Math.floor(Math.random() * 4));
      setSequence(initialSequence);
      setGameState('playing-sequence');
      
      // Reset timer with starting level duration
      const duration = calculateTimerDuration(GAME_CONFIG.startingLevel);
      setTimeRemaining(duration);
      maxTimerRef.current = duration;
      
      const playbackSpeed = calculatePlaybackSpeed(GAME_CONFIG.startingLevel);
      initialSequence.forEach((btnIndex, i) => {
        setTimeout(() => {
          setActiveButton(btnIndex);
          if (soundEnabled) playButtonSound(btnIndex);
          setTimeout(() => {
            setActiveButton(null);
            if (i === initialSequence.length - 1) {
              setGameState('user-turn');
            }
          }, playbackSpeed / 2);
        }, i * playbackSpeed);
      });
    }, 100);
  };

  useEffect(() => {
    // Only advance when level increases AND game has been started
    if (gameStartedRef.current && level > GAME_CONFIG.startingLevel) {
      startNewLevel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    if (gameState === 'user-turn') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 0.1;
          if (newTime <= 0) {
            clearInterval(timerRef.current);
            if (soundEnabled) playFailSound();
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

  const highScore = parseInt(localStorage.getItem('simonHighScore') || '0');

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">Vape Master Says</h1>
          <p className="text-gray-400">Watch the pattern and repeat it!</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex gap-8 text-white">
            <div className="text-center">
              <p className="text-sm text-gray-400">Level</p>
              <p className="text-3xl font-bold">{level}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Score</p>
              <p className="text-3xl font-bold">{score}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">High Score</p>
              <p className="text-3xl font-bold text-yellow-400">{highScore}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center mb-8 gap-8">
          {/* Timer and game state */}
          <div className="text-center">
            {gameState === 'idle' ? (
              <button
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg shadow-lg"
              >
                Start Game
              </button>
            ) : (
              <div>
                <div className={`
                  text-white font-bold text-5xl md:text-6xl
                  ${timeRemaining < 2 ? 'text-red-400 animate-pulse' : ''}
                  drop-shadow-lg
                `}>
                  {timeRemaining > 0 ? `${timeRemaining.toFixed(1)}s` : '0.0s'}
                </div>
                {gameState === 'playing-sequence' && (
                  <div className="text-gray-400 text-sm mt-2">Watch the pattern...</div>
                )}
                {gameState === 'user-turn' && (
                  <div className="text-green-400 text-sm mt-2">Your Turn! Click the vapes!</div>
                )}
              </div>
            )}
          </div>

          {/* Vape buttons in a horizontal row */}
          <div className="w-full flex justify-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 place-items-center">
              <div className="w-56 h-[450px] md:w-64 md:h-[520px]">
              <VapeButton
                color="red"
                isActive={activeButton === 0}
                isDisabled={gameState === 'playing-sequence' || gameState === 'idle'}
                onClick={() => handleButtonClick(0)}
                isWrong={wrongButton === 0}
                isCorrect={correctButton === 0}
              />
            </div>
            <div className="w-56 h-[450px] md:w-64 md:h-[520px]">
              <VapeButton
                color="blue"
                isActive={activeButton === 1}
                isDisabled={gameState === 'playing-sequence' || gameState === 'idle'}
                onClick={() => handleButtonClick(1)}
                isWrong={wrongButton === 1}
                isCorrect={correctButton === 1}
              />
            </div>
            <div className="w-56 h-[450px] md:w-64 md:h-[520px]">
              <VapeButton
                color="green"
                isActive={activeButton === 2}
                isDisabled={gameState === 'playing-sequence' || gameState === 'idle'}
                onClick={() => handleButtonClick(2)}
                isWrong={wrongButton === 2}
                isCorrect={correctButton === 2}
              />
            </div>
            <div className="w-56 h-[450px] md:w-64 md:h-[520px]">
              <VapeButton
                color="yellow"
                isActive={activeButton === 3}
                isDisabled={gameState === 'playing-sequence' || gameState === 'idle'}
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
        <GameWin level={level} score={score} onRestart={startGame} />
      )}
    </div>
  );
}

export default App;
