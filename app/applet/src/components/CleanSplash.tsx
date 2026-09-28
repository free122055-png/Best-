import React, { useEffect, useState } from 'react';

interface CleanSplashProps {
  onFinish: () => void;
}

export default function CleanSplash({ onFinish }: CleanSplashProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // 1. Remove initial static index.html splash marker if present
    const initMarker = document.getElementById('app-initial-splash');
    if (initMarker) {
      initMarker.remove();
    }

    // 2. Display official clean splash for 1.2 seconds, then smoothly transition
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        onFinish();
      }, 200);
    }, 1200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        transition: 'opacity 0.2s ease-out',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <img
        src="/samity_logo.svg"
        alt="BNB Official Logo"
        style={{
          width: '160px',
          height: '160px',
          objectFit: 'contain',
          userSelect: 'none',
        }}
      />
    </div>
  );
}
