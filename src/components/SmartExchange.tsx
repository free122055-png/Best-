import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Transaction, AppConfig } from '../types';

interface SmartExchangeProps {
  user: User;
  onBack: () => void;
  syncLiveProfile: () => Promise<void>;
  appConfig?: AppConfig;
}

export default function SmartExchange({ user, onBack, syncLiveProfile, appConfig }: SmartExchangeProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      <div className="bg-indigo-950 p-4 text-white flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-indigo-900 rounded-full">←</button>
        <h2 className="text-lg font-black">Smart Exchange BD</h2>
        <div className="w-10"></div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <p className="text-slate-600 text-sm">Escrow Exchange System coming soon...</p>
      </div>
    </div>
  );
}