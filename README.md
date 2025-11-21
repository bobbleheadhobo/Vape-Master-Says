# Vape Master Says

A Simon Says style memory game with vapes. Watch the sequence of vapes light up, then repeat it. Each level gets progressively harder with faster sequences and shorter timers. Beat level 20 to win and download your vape ticket!

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm run preview
```

That's it.
The game will run on `http://localhost:5173`

## Features

- Progressive difficulty (timer gets shorter, sequences play faster)
- Keyboard support (A/S/D/F for vapes, Space/Enter to start)
- Stats tracking (high score, highest level, total losses)
- Customizable difficulty
- Mobile responsive
- Sound effects for each button
- Scrambled sounds on the final level to mess with you
- Optional macrodroid webhook notifications (set `VITE_MACRODROID_WEBHOOK_ID` in `.env`)

## Tech

Built with React, Vite, and Tailwind CSS.
