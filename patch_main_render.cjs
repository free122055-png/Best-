const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  };

            {/* Announcement Notice Marquee */}`;

const replacementStr = `  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800 font-sans">
      {/* 1. Header */}
      <header className="bg-[#005B43] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md h-[56px] shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Menu button */}
          <button 
            type="button"
            onClick={onOpenDrawer}
            className="p-1 hover:bg-white/10 rounded-full text-white transition cursor-pointer active:scale-95 flex items-center justify-center"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-col text-left font-sans">
            <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-extrabold leading-none">BNB Multipurpose</span>
            <span className="text-sm font-black tracking-tight mt-0.5 leading-none">কো-অপারেটিভ সোসাইটি</span>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-1.5 font-sans">
          {/* Lang switch */}
          <button 
            type="button"
            onClick={() => onLanguageChange && onLanguageChange(appLanguage === 'en' ? 'bn' : 'en')}
            className="px-2 py-0.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded text-[10px] font-black transition active:scale-95 cursor-pointer uppercase"
          >
            {appLanguage === 'en' ? 'বাং' : 'en'}
          </button>

          {/* Theme switch */}
          <button 
            type="button"
            onClick={onThemeToggle}
            className="p-1.5 hover:bg-white/10 rounded-full text-white transition cursor-pointer active:scale-95 flex items-center justify-center"
          >
            {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          {/* Notification Icon */}
          <button 
            type="button"
            onClick={() => setShowNotificationsModal(true)}
            className="p-1.5 hover:bg-white/10 rounded-full text-white transition relative cursor-pointer active:scale-95 flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
            {userNotifications.filter(n => !isNotificationRead(n)).length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Logout or admin button */}
          {(user?.role === 'admin' || user?.role === 'sub_admin') && (
            <button 
              type="button"
              onClick={onTriggerAdmin}
              className="px-2 py-1 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-600 transition font-black text-[10px] cursor-pointer"
            >
              ADMIN
            </button>
          )}
        </div>
      </header>

      <div className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4 px-4 py-2">
            {/* bKash-style Premium Interactive Balance Card */}
            <div className="bg-gradient-to-br from-[#005B43] to-[#004230] rounded-3xl p-5 text-white shadow-md relative overflow-hidden border border-[#003828] font-sans">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-emerald-250 tracking-wider">ডিজিটাল সমবায় ওয়ালেট</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-bold text-slate-100">{user?.name || 'সদস্য'} ({user?.memberId || 'BNB00000000'})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-emerald-800/60 border border-emerald-700/50 rounded-full text-[9px] font-black uppercase tracking-wider text-emerald-100">
                    {(user?.role === 'admin' || user?.role === 'sub_admin') ? 'অ্যাডমিন' : 'সদস্য'}
                  </span>
                </div>
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-white/10">
                <div className="space-y-1 text-left">
                  <p className="text-[10px] text-emerald-250 font-bold">মেইন ব্যালেন্স</p>
                  <p className="text-lg font-black font-mono">৳ {(liveUser?.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT</p>
                </div>
                <div className="space-y-1 text-left border-l border-white/10 pl-4">
                  <p className="text-[10px] text-emerald-250 font-bold">সঞ্চয় তহবিল</p>
                  <p className="text-lg font-black font-mono">৳ {(liveUser?.savings || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })} BDT</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5 text-[11px] text-emerald-150">
                <div className="flex items-center gap-1">
                  <span className="text-emerald-300">📞 রিচার্জঃ</span>
                  <span className="font-mono font-bold">৳ {(liveUser?.telecomBalance || 0).toLocaleString('bn-BD')}</span>
                </div>
                <div className="flex items-center gap-1 border-l border-white/10 pl-4">
                  <span className="text-emerald-350">🛒 শপঃ</span>
                  <span className="font-mono font-bold">৳ {(liveUser?.superShopBalance || 0).toLocaleString('bn-BD')}</span>
                </div>
              </div>
            </div>

            {/* Announcement Notice Marquee */}`;

const index = content.indexOf(targetStr);
if (index === -1) {
  console.error("Could not find targetStr!");
  process.exit(1);
}

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully inserted main render block, top header, and balance card!");
