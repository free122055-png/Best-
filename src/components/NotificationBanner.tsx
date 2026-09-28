import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationBannerProps {
  notification: { title: string; body: string };
  onClose: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ notification, onClose }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-60 bg-white border border-slate-100 p-4 rounded-2xl shadow-xl flex items-start gap-4"
      >
        <div className="bg-emerald-50 p-2 rounded-full">
          <Bell className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm text-slate-800">{notification.title}</h4>
          <p className="text-xs text-slate-600 mt-0.5">{notification.body}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
