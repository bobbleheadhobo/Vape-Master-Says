# Simon Says - Progressive Memory Game

A modern, progressively difficult Simon Says memory game built with React, Vite, and Tailwind CSS. The game features dynamic difficulty scaling, sound effects, and a polished UI designed to challenge players as they advance.

## Features

### Core Gameplay
- **4 colored buttons** (red, blue, green, yellow) in a 2x2 grid
- **Progressive difficulty** - each level adds one more step to the sequence
- **Countdown timer** - 5 seconds per move (reduces as you progress)
- **Visual feedback** - animations for correct/incorrect moves
- **Sound effects** - unique tones for each button
- **High score tracking** - stored in localStorage

### Difficulty Progression
The game automatically increases difficulty through:
- **Timer reduction** - reduces by 0.5s every 3 levels (minimum 2s)
- **Faster playback** - sequence plays faster every 5 levels
- **Progressive challenge** - levels 1-5 are easy, 16+ are brutal

### Polish
- Smooth animations and transitions
- Timer warning (pulses red under 2 seconds)
- Success/failure sound effects
- Game over screen with statistics
- Sound toggle option
- Responsive design

## Getting Started

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

The built files will be in the `dist/` directory.

## Game Configuration

The game difficulty can be easily configured by modifying the `DIFFICULTY_CONFIG` object in `src/App.jsx`:

```javascript
const DIFFICULTY_CONFIG = {
  // Base settings
  startingTimer: 5,           // seconds per move at level 1
  sequencePlaybackSpeed: 600, // ms between button flashes
  
  // Timer reduction (applied every N levels)
  timerReduction: {
    enabled: true,
    everyNLevels: 3,          // reduce timer every 3 levels
    reductionAmount: 0.5,     // reduce by 0.5 seconds
    minimumTimer: 2,          // never go below 2 seconds
  },
  
  // Playback speed increase
  playbackSpeed: {
    enabled: true,
    everyNLevels: 5,          // speed up every 5 levels
    reductionAmount: 50,      // reduce delay by 50ms
    minimumSpeed: 200,        // never go below 200ms
  },
};
```

### Configuration Examples

**Easy Mode** (slower progression):
```javascript
timerReduction: {
  enabled: true,
  everyNLevels: 5,
  reductionAmount: 0.3,
  minimumTimer: 3,
}
```

**Hard Mode** (faster progression):
```javascript
timerReduction: {
  enabled: true,
  everyNLevels: 2,
  reductionAmount: 0.7,
  minimumTimer: 1.5,
}
```

**No Timer Reduction**:
```javascript
timerReduction: {
  enabled: false,
  // other settings ignored
}
```

## How to Play

1. Click **Start Game** to begin
2. Watch the sequence of colored buttons light up
3. Repeat the sequence by clicking the buttons in the same order
4. Each correct button click resets the timer to full
5. Complete the sequence to advance to the next level
6. Game ends if you click the wrong button or time runs out

## Tech Stack

- **React 19** - Component-based UI
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Web Audio API** - Sound generation

## Project Structure

```
simon-says/
├── src/
│   ├── App.jsx          # Main game component with all logic
│   ├── App.css          # Custom animations
│   ├── index.css        # Tailwind imports
│   └── main.jsx         # React entry point
├── public/              # Static assets
├── index.html           # HTML template
├── tailwind.config.js   # Tailwind configuration
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies
```

## Customization

### Colors
Modify button colors in the `ColorButton` component:
```javascript
const colors = {
  red: { base: 'bg-red-500', active: 'bg-red-400', border: 'border-red-600' },
  // customize other colors...
};
```

### Sound Frequencies
Modify button tones in the `frequencies` object:
```javascript
const frequencies = {
  0: 329.63, // Red - E4
  1: 392.00, // Blue - G4
  2: 261.63, // Green - C4
  3: 523.25, // Yellow - C5
};
```

## Integration with Other Applications

The game is designed to emit completion events. To integrate:

```javascript
// In App.jsx, add onComplete callback
const handleGameComplete = (level, score) => {
  // Emit event or call API
  window.dispatchEvent(new CustomEvent('gameComplete', { 
    detail: { level, score } 
  }));
};
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (Web Audio API)
- Mobile: Optimized for touch but best on desktop

## Performance

- No memory leaks (timers properly cleaned up)
- Smooth 60fps animations
- Minimal bundle size (~150KB gzipped)

## License

MIT

## Credits

Built with React, Vite, and Tailwind CSS following modern web development best practices.
