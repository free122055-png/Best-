import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Search, 
  Gift, 
  AlertTriangle, 
  Megaphone, 
  CheckCircle2, 
  Trash2, 
  CheckCheck, 
  Clock, 
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { UserNotification, User } from '../types';

interface NotificationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  userNotifications: UserNotification[];
  user: User;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications?: () => void;
}

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  isOpen,
  onClose,
  userNotifications,
  user,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'bonus' | 'deduction' | 'notice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<UserNotification | null>(null);

  // Categorize helper
  const isBonusNotif = (n: UserNotification) => {
    return (
      n.type === 'bonus' || 
      n.category === 'bonus' || 
      n.notifyType === 'credit' ||
      (n.title && (n.title.includes('বোনাস') || n.title.includes('জমা') || n.title.includes('কমিশন')))
    );
  };

  const isDeductionNotif = (n: UserNotification) => {
    return (
      n.type === 'fine' || 
      n.category === 'fine' || 
      n.category === 'deduction' || 
      n.notifyType === 'debit' ||
      (n.title && (n.title.includes('কর্তন') || n.title.includes('জরিমানা') || n.title.includes('চার্জ') || n.title.includes('ফি')))
    );
  };

  // Counts
  const counts = useMemo(() => {
    let unread = 0;
    let bonus = 0;
    let deduction = 0;
    let notice = 0;

    userNotifications.forEach(n => {
      if (!n.read) unread++;
      if (isBonusNotif(n)) bonus++;
      else if (isDeductionNotif(n)) deduction++;
      else notice++;
    });

    return { total: userNotifications.length, unread, bonus, deduction, notice };
  }, [userNotifications]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    return userNotifications.filter(n => {
      // 1. Tab filter
      if (activeTab === 'bonus' && !isBonusNotif(n)) return false;
      if (activeTab === 'deduction' && !isDeductionNotif(n)) return false;
      if (activeTab === 'notice' && (isBonusNotif(n) || isDeductionNotif(n))) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const bodyMatch = (n.body || n.message || '').toLowerCase().includes(q);
        const amtMatch = n.amount ? String(n.amount).includes(q) : false;
        return titleMatch || bodyMatch || amtMatch;
      }

      return true;
    });
  }, [userNotifications, activeTab, searchQuery]);

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'তারিখ পাওয়া যায়নি';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      // Format using English locale as per strict English numbers rule
      return new Intl.DateTimeFormat('en-US', options).format(d);
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#f8fafc] text-slate-800 w-screen h-screen overflow-hidden font-sans animate-in fade-in duration-200">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden relative">
        
        {/* Header Bar - Official Deep Green */}
        <div className="p-3.5 sm:p-4 bg-[#0b6623] text-white shadow-md flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs relative">
              <Bell className="w-5 h-5 text-white animate-bounce" />
              {counts.unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0b6623] shadow-sm font-mono">
                  {counts.unread > 9 ? '9+' : counts.unread}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white leading-none font-sans">
                  নোটিফিকেশন ও ইনবক্স
                </h2>
                <span className="bg-white/20 text-white font-black text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {counts.unread} অপঠিত
                </span>
              </div>
              <p className="text-[10px] text-emerald-100/90 mt-1 font-sans">
                সর্বমোট {counts.total}টি আপডেট বার্তা সংরক্ষিত রয়েছে
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar (Mark All as Read / Clear All) */}
        <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800/50 flex items-center justify-between gap-2 shrink-0 text-xs">
          <button
            type="button"
            onClick={onMarkAllAsRead}
            disabled={counts.unread === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition cursor-pointer ${
              counts.unread > 0 
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30' 
                : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>সব পঠিত করুন</span>
          </button>

          {onClearAllNotifications && counts.total > 0 && (
            <button
              type="button"
              onClick={onClearAllNotifications}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] bg-rose-600/15 text-rose-300 border border-rose-500/30 hover:bg-rose-600/25 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>সব মুছুন</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="px-3.5 pt-3 pb-2 bg-slate-950/40 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নোটিফিকেশনে খুঁজুন (যেমন: বোনাস, কর্তন, ৫০ টাকা)..."
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-3.5 py-2 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            {[
              { id: 'all', label: 'সকল', count: counts.total, icon: Bell, color: 'from-amber-500 to-rose-500' },
              { id: 'bonus', label: 'বোনাস', count: counts.bonus, icon: Gift, color: 'from-emerald-500 to-teal-500' },
              { id: 'deduction', label: 'কর্তন', count: counts.deduction, icon: AlertTriangle, color: 'from-rose-500 to-red-600' },
              { id: 'notice', label: 'আপডেট', count: counts.notice, icon: Megaphone, color: 'from-sky-500 to-indigo-500' }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black transition cursor-pointer border ${
                    isActive
                      ? `bg-gradient-to-r ${tab.color} text-slate-950 border-white/20 shadow-md scale-102`
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800/80 my-4">
              <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center text-slate-500 mb-3">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-black text-slate-300 font-sans">
                কোনো নোটিফিকেশন পাওয়া যায়নি
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs font-sans">
                {searchQuery 
                  ? 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো ইনবক্স বার্তা নেই।' 
                  : 'এই ক্যাটাগরিতে এই মুহূর্তে কোনো নোটিফিকেশন বা বার্তা সংরক্ষিত নেই।'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isBonus = isBonusNotif(notif);
              const isDeduction = isDeductionNotif(notif);
              const isUnread = !notif.read;

              return (
                <div
                  key={notif.id || notif.docId}
                  onClick={() => setSelectedNotif(notif)}
                  className={`group relative p-3.5 rounded-2xl transition cursor-pointer border ${
                    isUnread
                      ? 'bg-gradient-to-r from-slate-850 via-slate-800 to-slate-850 border-amber-500/40 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80 opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Unread Glowing Dot */}
                  {isUnread && (
                    <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                      <span className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Category Icon Badge */}
                    <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-xs ${
                      isBonus
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isDeduction
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    }`}>
                      {isBonus ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : isDeduction ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <Megaphone className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 pr-4">
                      {/* Top Row: Category tag & Time */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                          isBonus
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : isDeduction
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-sky-950 text-sky-300 border-sky-800'
                        }`}>
                          {isBonus ? '🎁 বোনাস' : isDeduction ? '⚠️ কর্তন / ফি' : '📢 নোটিশ'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>

                      {/* Notification Title */}
                      <h4 className={`text-xs sm:text-sm font-black leading-snug font-sans ${
                        isUnread ? 'text-amber-200' : 'text-slate-100'
                      }`}>
                        {notif.title || (isBonus ? '🎁 বোনাস জমা হয়েছে' : isDeduction ? '⚠️ টাকা কর্তন করা হয়েছে' : '📢 সিস্টেম নোটিফিকেশন')}
                      </h4>

                      {/* Main Amount if available */}
                      {notif.amount !== undefined && notif.amount !== null && Number(notif.amount) > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400">পরিমাণ:</span>
                          <span className={`text-xs sm:text-sm font-black font-mono ${
                            isBonus ? 'text-emerald-400' : isDeduction ? 'text-rose-400' : 'text-amber-300'
                          }`}>
                            {isBonus ? '+' : isDeduction ? '-' : ''} ৳ {Number(notif.amount).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Reason / Body */}
                      <p className="text-[11px] sm:text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed font-sans">
                        {notif.body || notif.message || 'কোনো বিস্তারিত বিবরণ দেয়া হয়নি।'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Bar Controls for Item */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 text-amber-400 group-hover:underline font-bold">
                      <span>বিস্তারিত দেখুন</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notif.id || notif.docId) {
                          onDeleteNotification(notif.id || notif.docId || '');
                        }
                      }}
                      className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 rounded-lg transition"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 shrink-0 text-center">
          <p className="text-[10px] text-slate-400 font-sans">
            🔒 BNB Business Network Bangladesh — রিয়েল-টাইম তথ্য ও নোটিফিকেশন সিস্টেম
          </p>
        </div>
      </div>

      {/* Selected Notification Full Details Modal */}
      <AnimatePresence>
        {selectedNotif && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md"
          >
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 relative overflow-hidden">
              {/* Header Icon */}
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                }`}>
                  {isBonusNotif(selectedNotif) ? (
                    <Gift className="w-6 h-6" />
                  ) : isDeductionNotif(selectedNotif) ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <Megaphone className="w-6 h-6" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Badge */}
              <div>
                <span className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2 border ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : 'bg-sky-950 text-sky-300 border-sky-800'
                }`}>
                  {isBonusNotif(selectedNotif) ? '🎁 বোনাস বার্তা' : isDeductionNotif(selectedNotif) ? '⚠️ টাকা কর্তন / ফি' : '📢 সিস্টেম আপডেট'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug font-sans">
                  {selectedNotif.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(selectedNotif.createdAt)}
                </p>
              </div>

              {/* Amount Box if present */}
              {selectedNotif.amount !== undefined && selectedNotif.amount !== null && (
                <div className={`p-3.5 rounded-2xl border text-center ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                    : 'bg-slate-800/50 border-slate-700 text-amber-300'
                }`}>
                  <span className="text-xs text-slate-400 font-bold block mb-0.5">লেনদেনের পরিমাণ</span>
                  <span className="text-2xl font-black font-mono">
                    {isBonusNotif(selectedNotif) ? '+' : isDeductionNotif(selectedNotif) ? '-' : ''} ৳ {Number(selectedNotif.amount).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Description Body */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                <span className="text-[10.5px] font-bold text-amber-400 uppercase tracking-wider block">
                  কারণ / বিবরণ (Reason & Description):
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedNotif.body || selectedNotif.message || 'কোনো বিবরণ দেয়া নেই।'}
                </p>
              </div>

              {/* Close / Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNotif.id || selectedNotif.docId) {
                      onDeleteNotification(selectedNotif.id || selectedNotif.docId || '');
                    }
                    setSelectedNotif(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>মুছে ফেলুন</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>বুঝে পেয়েছি (বন্ধ করুন)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
