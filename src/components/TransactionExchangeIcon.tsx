import React from 'react';

interface TransactionExchangeIconProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}

/**
 * Custom Transaction Icon matching the exact money exchange vector design:
 * Top horizontal right arrow, central detailed banknote with circular emblem,
 * and bottom horizontal left arrow.
 */
export const TransactionExchangeIcon: React.FC<TransactionExchangeIconProps> = ({
  className = 'w-5 h-5',
  size,
  strokeWidth = 4.5
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Top Arrow pointing Right */}
      <path
        d="M 16 23 H 58 V 13 L 85 28.5 L 58 44 V 34 H 16 Z"
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Middle Banknote Outer Frame */}
      <rect
        x="28"
        y="36"
        width="44"
        height="28"
        rx="2"
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Middle Banknote Notched Inner Border */}
      <path
        d="M 37 41 H 63 C 63 43.8 65.2 46 68 46 V 54 C 65.2 54 63 56.2 63 59 H 37 C 37 56.2 34.8 54 32 54 V 46 C 34.8 46 37 43.8 37 41 Z"
        strokeWidth={strokeWidth * 0.75}
        fill="none"
      />

      {/* Center Circle on Banknote */}
      <circle
        cx="50"
        cy="50"
        r="6.5"
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Bottom Arrow pointing Left */}
      <path
        d="M 84 77 H 42 V 87 L 15 71.5 L 42 56 V 66 H 84 Z"
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
};

export default TransactionExchangeIcon;
