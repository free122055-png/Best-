import React from 'react';
import { navigationManager } from '../lib/navigationManager';

interface UnifiedBackButtonProps {
  onClick?: () => void;
  label?: string;
  variant?: 'dark' | 'light' | 'emerald' | 'amber' | 'glass' | 'white';
  className?: string;
  title?: string;
}

/**
 * Standardized Unified Back Button (← ব্যাক) for all screens and sub-views in BNB App.
 * Matches exact UI style from Safi Premium Shop:
 * Pill container, bold '← ব্যাক' text, smooth active-scale animation, step-by-step back.
 */
export default function UnifiedBackButton({
  onClick,
  label = 'ব্যাক',
  variant = 'glass',
  className = '',
  title = 'পিছনে যান'
}: UnifiedBackButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      navigationManager.handleBack('button');
    }
  };

  let variantStyles = 'bg-white/10 hover:bg-white/20 text-white border-white/15 shadow-4xs';

  if (variant === 'dark') {
    variantStyles = 'bg-slate-800 hover:bg-slate-900 text-white border-slate-700/80 shadow-4xs';
  } else if (variant === 'light') {
    variantStyles = 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-4xs';
  } else if (variant === 'emerald') {
    variantStyles = 'bg-emerald-900/50 hover:bg-emerald-900/70 text-white border-emerald-400/30 shadow-4xs';
  } else if (variant === 'amber') {
    variantStyles = 'bg-amber-900/50 hover:bg-amber-900/70 text-white border-amber-400/30 shadow-4xs';
  } else if (variant === 'white') {
    variantStyles = 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/80 shadow-4xs';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={`inline-flex items-center justify-center gap-0.5 py-0.5 px-1.5 xs:px-2 -ml-0.5 sm:-ml-1 active:scale-90 transition-all rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-black cursor-pointer border select-none shrink-0 leading-tight ${variantStyles} ${className}`}
    >
      <span className="text-[11px] sm:text-xs leading-none font-bold">←</span>
      <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-tighter leading-none">{label}</span>
    </button>
  );
}
