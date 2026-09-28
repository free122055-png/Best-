import React, { useEffect, useState, useRef } from 'react';

interface CleanSplashProps {
  onFinish: () => void;
}

export default function CleanSplash({ onFinish }: CleanSplashProps) {
  const [fading, setFading] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    // Prevent double invocation
    let isMounted = true;

    // Display official clean splash with exact logo, then smooth transition
    const timer = setTimeout(() => {
      if (!isMounted) return;
      setFading(true);
      setTimeout(() => {
        if (!isMounted) return;
        onFinishRef.current();
      }, 180);
    }, 1100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

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
        transition: 'opacity 0.18s ease-out',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <img
        src="/app_icon.png"
        alt="BNB Official Logo"
        referrerPolicy="no-referrer"
        style={{
          width: '180px',
          height: '180px',
          objectFit: 'contain',
          userSelect: 'none',
        }}
      />
    </div>
  );
}
