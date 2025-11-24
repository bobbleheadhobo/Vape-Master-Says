const VapeButton = ({ color, isActive, isDisabled, onClick, isWrong, isCorrect }) => {
  const colors = {
    red: { 
      base: '#ef4444',
      active: '#fca5a5', 
      glow: '#dc2626',
      screen: '#7f1d1d'
    },
    blue: { 
      base: '#3b82f6',
      active: '#93c5fd',
      glow: '#2563eb',
      screen: '#1e3a8a'
    },
    green: { 
      base: '#22c55e',
      active: '#86efac',
      glow: '#16a34a',
      screen: '#14532d'
    },
    yellow: { 
      base: '#eab308',
      active: '#fde047',
      glow: '#ca8a04',
      screen: '#713f12'
    },
  };

  const keyMap = {
    red: 'A',
    blue: 'S',
    green: 'D',
    yellow: 'F'
  };

  const colorScheme = colors[color];
  const currentColor = isActive ? colorScheme.active : colorScheme.base;
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative
        ${isDisabled && !isActive ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${isWrong ? 'animate-shake' : ''}
      `}
      style={{ 
        filter: isActive ? `drop-shadow(0 0 20px ${colorScheme.glow})` : 'none',
        overflow: 'visible',
      }}
    >
      <div className={`relative transition-all duration-150 ${isActive ? 'scale-105' : ''}`} style={{ transformOrigin: 'center center' }}>
      <svg 
        viewBox="0 -40 120 240" 
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Main body gradient - left to right */}
          <linearGradient id={`body-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: currentColor, stopOpacity: 0.85 }} />
            <stop offset="50%" style={{ stopColor: currentColor, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: currentColor, stopOpacity: 0.8 }} />
          </linearGradient>
          
          {/* Left highlight */}
          <linearGradient id={`highlight-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
          </linearGradient>
          
          {/* Right shadow */}
          <linearGradient id={`shadow-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: 'black', stopOpacity: 0 }} />
            <stop offset="100%" style={{ stopColor: 'black', stopOpacity: 0.25 }} />
          </linearGradient>
        </defs>
        
        {/* Main rectangular body with rounded corners */}
        <rect 
          x="10" 
          y="35" 
          width="100" 
          height="155" 
          rx="13" 
          ry="13"
          fill={`url(#body-grad-${color})`}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />
        
        {/* Left side highlight for glossy effect */}
        <rect 
          x="12" 
          y="37" 
          width="40" 
          height="151" 
          rx="10" 
          ry="10"
          fill={`url(#highlight-${color})`}
          opacity="0.4"
        />
        
        {/* Right side shadow for depth */}
        <rect 
          x="68" 
          y="37" 
          width="40" 
          height="151" 
          rx="10" 
          ry="10"
          fill={`url(#shadow-${color})`}
          opacity="0.5"
        />
        
        {/* Vertical pill-shaped label on left side */}
        <rect 
          x="15" 
          y="80" 
          width="12" 
          height="60" 
          rx="5" 
          ry="5"
          fill="white"
          opacity="0.95"
        />
        
        {/* Vertical text inside pill - rotated 90 degrees */}
        <text 
          x="12" 
          y="119" 
          fontFamily="Arial, sans-serif" 
          fontSize="6.5" 
          fill="rgba(0,0,0,0.85)"
          textAnchor="right"
          fontWeight="bold"
          transform="rotate(90, 30, 108)"
          style={{ textRendering: 'geometricPrecision' }}
        >
          100K
        </text>

        {/* Vertical text inside pill - rotated 90 degrees */}
        <text 
          x="33" 
          y="119" 
          fontFamily="Arial, sans-serif" 
          fontSize="6.5" 
          fill="rgba(0,0,0,0.85)"
          textAnchor="left"
          fontWeight="bold"
          transform="rotate(90, 30, 108)"
          style={{ textRendering: 'geometricPrecision' }}
        >
          PUFFS
        </text>
        
        {/* Mouthpiece - rectangular, wider at base, rounded top only */}
        <path
          d="M 45 35 L 45 15 Q 45 8 50 8 L 70 8 Q 75 8 75 15 L 75 35 Z"
          fill={currentColor}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />
        
        {/* Mouthpiece top rounded cap */}
        <rect 
          x="50" 
          y="8" 
          width="20" 
          height="10" 
          rx="10" 
          ry="10"
          fill={currentColor}
        />
        
        {/* Small highlight on mouthpiece */}
        <ellipse 
          cx="55" 
          cy="12" 
          rx="6" 
          ry="3"
          fill="white"
          opacity="0.4"
        />
        
        {/* Smoke puffs - only visible when active */}
        {isActive && (
        <g>
            <circle 
              cx="60" 
              cy="5" 
              r="8"
              fill="white"
              opacity="0.6"
              className="animate-smoke"
            />
            <circle 
              cx="55" 
              cy="3" 
              r="6"
              fill="white"
              opacity="0.5"
              className="animate-smoke-delay-1"
            />
            <circle 
              cx="65" 
              cy="4" 
              r="5"
              fill="white"
              opacity="0.4"
              className="animate-smoke-delay-2"
            />
          </g>
        )}
      </svg>
      
      {/* Keyboard shortcut hint - only visible on large screens */}
      <div className="hidden lg:flex absolute bottom-4 left-0 right-0 justify-center pointer-events-none">
        <div className="text-white text-lg font-bold px-3 py-1 text-opacity-70">
          {keyMap[color]}
        </div>
      </div>
      </div>
    </button>
  );
};

export default VapeButton;
