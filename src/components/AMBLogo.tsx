import React from 'react';

interface AMBLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'white' | 'emerald' | 'currentColor' | 'black';
}

export const AMBLogo: React.FC<AMBLogoProps> = ({ 
  className = '', 
  size = '100%', 
  variant = 'currentColor' 
}) => {
  // Color configuration
  const colorClass = 
    variant === 'white' ? 'fill-white stroke-white' : 
    variant === 'emerald' ? 'fill-emerald-600 stroke-emerald-600' : 
    variant === 'black' ? 'fill-neutral-900 stroke-neutral-900' :
    'fill-current stroke-current';

  const veinColor = 
    variant === 'white' ? '#10b981' : // emerald-500
    variant === 'black' ? '#ffffff' :
    variant === 'emerald' ? '#ffffff' :
    'rgba(255,255,255,0.85)';

  return (
    <svg 
      viewBox="0 0 200 200" 
      width={size} 
      height={size} 
      className={`${className} select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 3 Leaves at the center */}
      {/* Middle/Center Leaf */}
      <path 
        d="M 100 22 C 80 45 84 82 100 102 C 116 82 120 45 100 22 Z" 
        className={colorClass}
        strokeWidth="1"
        fillRule="evenodd"
      />
      {/* Middle Leaf Central Vein */}
      <path 
        d="M 100 101 L 100 48" 
        stroke={veinColor}
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />

      {/* Left Leaf */}
      <path 
        d="M 91 100 C 62 92 42 70 45 42 C 62 36 82 58 91 100 Z" 
        className={colorClass}
        strokeWidth="1"
        fillRule="evenodd"
      />
      {/* Left Leaf Central Vein */}
      <path 
        d="M 90 98 C 80 81 69 68 59 62" 
        stroke={veinColor} 
        strokeWidth="3.2" 
        strokeLinecap="round" 
      />

      {/* Right Leaf */}
      <path 
        d="M 109 100 C 138 92 158 70 155 42 C 138 36 118 58 109 100 Z" 
        className={colorClass}
        strokeWidth="1"
        fillRule="evenodd"
      />
      {/* Right Leaf Central Vein */}
      <path 
        d="M 110 98 C 120 81 131 68 141 62" 
        stroke={veinColor} 
        strokeWidth="3.2" 
        strokeLinecap="round" 
      />

      {/* "AMB" word in bold typeface for Al Mayadin Bazar */}
      <text 
        x="100" 
        y="126" 
        textAnchor="middle" 
        className={`${variant === 'white' ? 'fill-white' : variant === 'emerald' ? 'fill-emerald-800' : variant === 'black' ? 'fill-white' : 'fill-current'} font-sans font-black select-none`}
        fontSize="25"
        letterSpacing="0.8"
        style={{ fontWeight: 950 }}
      >
        AMB
      </text>

      {/* Left Hand cupping the center logo */}
      <path 
        d="M 89 178 
           L 63 178 
           C 63 150 48 125 34 100 
           C 23 80 18 64 25 54 
           C 29 46 38 48 43 58 
           C 47 68 55 90 62 112 
           C 63 118 65 122 67 122 
           C 70 122 74 108 78 96 
           C 81 86 85 78 90 78 
           C 94 78 98 84 98 92 
           C 98 108 89 135 89 178 Z" 
        className={colorClass}
        strokeWidth="1.2"
        fillRule="evenodd"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Hand cupping the center logo - symmetric mirror */}
      <path 
        d="M 111 178 
           L 137 178 
           C 137 150 152 125 166 100 
           C 177 80 182 64 175 54 
           C 171 46 162 48 157 58 
           C 153 68 145 90 138 112 
           C 137 118 135 122 133 122 
           C 130 122 126 108 122 96 
           C 119 86 115 78 110 78 
           C 106 78 102 84 102 92 
           C 102 108 111 135 111 178 Z" 
        className={colorClass}
        strokeWidth="1.2"
        fillRule="evenodd"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
