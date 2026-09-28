import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, SkipForward } from 'lucide-react';
import { AMBLogo } from './AMBLogo';

interface SplashVideoProps {
  onComplete: () => void;
}

interface Particle {
  id: number;
  x: number; // percentage left
  y: number; // percentage top
  size: number; // px
  color: 'white' | 'red';
  duration: number; // seconds
  delay: number; // seconds
}

export default function SplashVideo({ onComplete }: SplashVideoProps) {
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1); // 1: Compass scan, 2: Logo emergence, 3: Text fade-in, 4: Complete/Ready
  const [particles, setParticles] = useState<Particle[]>([]);

  // Seed particles for the cinematic background
  useEffect(() => {
    const list: Particle[] = [];
    const colors: ('white' | 'red')[] = ['white', 'white', 'white', 'red', 'white', 'red', 'white', 'white', 'red', 'white'];
    for (let i = 0; i < 25; i++) {
      list.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2, // 2px to 6px
        color: colors[i % colors.length],
        duration: Math.random() * 8 + 6, // 6s to 14s
        delay: Math.random() * -8, // staggered start
      });
    }
    setParticles(list);
  }, []);

  // Progression of cinematic intro phases
  useEffect(() => {
    // Phase 1: Rotating compass radar screen (0 - 1.5s)
    // Phase 2: Logo scale-up emergence (1.5s - 2.5s)
    const logoTimer = setTimeout(() => {
      setPhase(2);
    }, 1200);

    // Phase 3: Brand Text details fade-in & startup bar starts (2.5s - 5s)
    const textTimer = setTimeout(() => {
      setPhase(3);
    }, 2400);

    // Complete/dismiss animation automatically
    const completeTimer = setTimeout(() => {
      setPhase(4);
      onComplete();
    }, 5500);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(textTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Loading progress bar simulation
  useEffect(() => {
    if (phase >= 3) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          const increment = Math.random() * 4 + 2;
          return Math.min(100, prev + increment);
        });
      }, 80);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <div 
      onClick={onComplete}
      className="fixed inset-0 bg-black flex flex-col items-center justify-center z-90 select-none cursor-pointer overflow-hidden font-sans"
      id="splash-video-container"
    >
      {/* Dynamic inline styles to prevent HMR and support custom cinematic animations smoothly */}
      <style>{`
        @keyframes custom-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes float-dust {
          0% {
            transform: translateY(120vh) translateX(0);
            opacity: 0;
          }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% {
            transform: translateY(-20vh) translateX(15px);
            opacity: 0;
          }
        }
        @keyframes logo-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.2)); }
          50% { transform: scale(1.02); filter: drop-shadow(0 0 25px rgba(16, 185, 129, 0.45)); }
        }
        .animate-reverse-spin {
          animation: reverse-spin 12s linear infinite;
        }
        .animate-custom-spin {
          animation: custom-spin 8s linear infinite;
        }
        .animate-float-dust {
          animation: float-dust var(--duration) linear infinite;
        }
        .animate-logo-pulse {
          animation: logo-pulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Cinematic Starry/Particle Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-80 overflow-hidden">
        {particles.map((p, idx) => (
          <div
            key={`${p.id}-${idx}`}
            className={`absolute rounded-full animate-float-dust ${
              p.color === 'red' 
                ? 'bg-rose-600/35 shadow-[0_0_8px_rgba(225,29,72,0.4)] blur-[1px]' 
                : 'bg-white/40 shadow-[0_0_5px_rgba(255,255,255,0.3)] blur-xs'
            }`}
            style={{
              left: `${p.x}%`,
              bottom: `-20px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--duration': `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties}
          />
        ))}
        {/* Ambient Nebula Glows */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-950/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-950/10 rounded-full blur-[100px]" />
      </div>

      {/* Main Animation Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-sm w-full h-[500px] text-center px-6">
        
        {/* Stage 1 & 2: Radial Ticking Radar / Outer Rings */}
        <div className="relative w-48 h-48 flex items-center justify-center mb-8">
          
          {/* Compass Dial Tick Ring (spinning backwards) */}
          <div className="absolute inset-0 border border-white/5 rounded-full animate-reverse-spin flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full opacity-20">
              <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" fill="none" strokeDasharray="3, 12" />
              <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="0.5" fill="none" strokeDasharray="1, 4" />
            </svg>
          </div>

          {/* Dotted Connection Rings */}
          <div className="absolute w-[184px] h-[184px] border-2 border-dashed border-emerald-500/20 rounded-full animate-custom-spin" />
          <div className="absolute w-[164px] h-[164px] border border-dotted border-white/10 rounded-full animate-reverse-spin" />

          {/* Core Radar Sweep Indicator (only shows in Phase 1) */}
          {phase === 1 && (
            <div className="absolute w-40 h-40 rounded-full border border-teal-500/30 flex items-center justify-center animate-custom-spin">
              <div className="w-full h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/20 to-transparent absolute top-1/2 left-1/2 -translate-y-1/2 origin-left" style={{ width: '50%' }} />
              {/* Inner loading ring segment */}
              <svg className="w-24 h-24 animate-reverse-spin" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="60, 200" strokeLinecap="round" className="opacity-80" />
              </svg>
            </div>
          )}

          {/* Embedded AMB Business Level Logo (Fades & Scales up at Phase 2) */}
          <div 
            className={`absolute transition-all duration-1000 ease-out flex items-center justify-center ${
              phase >= 2 
                ? 'opacity-100 scale-100 animate-logo-pulse' 
                : 'opacity-0 scale-50 pointer-events-none'
            }`}
          >
            <div className="w-36 h-36 bg-black/60 rounded-full border border-white/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] p-5.5 flex items-center justify-center">
              <AMBLogo variant="white" className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* Phase 3 Text Info & Startup Bar Details */}
        <div 
          className={`transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
            phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
          } w-full space-y-4`}
        >
          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold tracking-[0.16em] text-white">
              AMB BUSINESS NETWORK
            </h1>
            <p className="text-emerald-400 font-bold uppercase text-[11px] tracking-[0.3em] font-mono leading-none">
              Bangladesh
            </p>
          </div>

          {/* Startup Loading Bar Progress container */}
          <div className="mx-auto w-56 pt-2">
            <div className="relative h-1.5 w-full bg-slate-900 border border-white/10 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
              {/* The actual progress animation indicator */}
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-2.5 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
              <span className="animate-pulse">সুরক্ষিত কানেকশন লোড হচ্ছে...</span>
              <span className="text-emerald-450">{Math.floor(progress)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top action layout overlay */}
      <div className="absolute top-5 right-5 z-95">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className="px-3.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 hover:border-emerald-700 text-white font-extrabold text-[10px] rounded-full backdrop-blur-md flex items-center gap-1 transition-all cursor-pointer active:scale-95"
        >
          <span>এড়িয়ে যান</span>
          <SkipForward className="w-3 h-3 animate-pulse" />
        </button>
      </div>

      {/* Transparent Bottom Tap to enter feedback */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-slate-500 text-[10px] uppercase tracking-[0.2em] font-extrabold animate-pulse">
        ট্যাপ করে প্রবেশ করুন • TAP TO ENTER
      </div>
    </div>
  );
}
