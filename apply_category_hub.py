import sys

with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update generalMemberFilterTab type declaration
old_decl = "const [generalMemberFilterTab, setGeneralMemberFilterTab] = useState<'all' | 'general' | 'samity' | 'investor' | 'sub_admin' | 'switch_off' | 'switch_on'>('all');"
new_decl = "const [generalMemberFilterTab, setGeneralMemberFilterTab] = useState<'all' | 'general' | 'samity' | 'investor' | 'sub_admin' | 'switch_off' | 'switch_on' | 'reset_requests'>('all');"

if old_decl in text:
    text = text.replace(old_decl, new_decl, 1)
    print("Updated generalMemberFilterTab type definition!")
else:
    print("Could not find old_decl, check line")

# 2. Define the new Unified Category Hub (8 sections in 4-per-row grid)
new_category_hub = """            {/* 🌟 8-Category Member Statistics & Control Hub (৪টি করে ২ সারিতে সাজানো ৮টি সেকশন) */}
            {(() => {
              const isSubAdminUser = (u: any) => Boolean(
                u.role === 'sub_admin' ||
                (Array.isArray(u.subAdminPermissions) && u.subAdminPermissions.length > 0) ||
                u.isSubAdmin === true
              );

              const isInvestorUser = (u: any) => Boolean(
                u.memberCategory === 'investor' ||
                u.memberGroup === 'investor' ||
                u.isInvestor === true ||
                u.role === 'investor' ||
                (Array.isArray(u.investments) && u.investments.length > 0) ||
                u.investorApproved === true
              );

              const isSamityMemberUser = (u: any) => Boolean(
                u.samityApproved === true ||
                u.samityStatus === 'approved' ||
                u.isSamityMember === true ||
                (Number(u.savings) > 0) ||
                u.memberCategory === 'shareholder' ||
                u.memberGroup === 'shareholder' ||
                u.memberGroup === 'samity'
              );

              const isSwitchOffUser = (u: any) => Boolean(
                u.samityAutoSavingsActive === false ||
                u.samityDeactivateStatus === 'self_opted_out' ||
                u.samitySwitchStatus === 'OFF'
              );

              const isSwitchOnUser = (u: any) => Boolean(
                (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
                isSamityMemberUser(u)
              );

              const isResetRequestedUser = (u: any) => Boolean(
                u.appLockResetRequested === true ||
                u.appLockResetStatus === 'pending' ||
                u.forgotPinRequested === true ||
                u.pinResetRequested === true ||
                (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
              );

              const subAdminUsers = users.filter(isSubAdminUser);
              const investorUsers = users.filter(u => isInvestorUser(u) && !isSubAdminUser(u));
              const samityShareholderUsers = users.filter(u => isSamityMemberUser(u) && !isInvestorUser(u) && !isSubAdminUser(u));
              const generalAppUsers = users.filter(u => !isSamityMemberUser(u) && !isInvestorUser(u) && !isSubAdminUser(u) && u.role !== 'admin');
              const switchOffUsers = users.filter(isSwitchOffUser);
              const switchOnUsers = users.filter(isSwitchOnUser);
              const appLockResetUsers = users.filter(isResetRequestedUser);
              const totalSwitchOffRefundAmount = switchOffUsers.reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);

              return (
                <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl text-white space-y-3.5 shadow-xl">
                  {/* Hub Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>📊 সদস্য ক্যাটাগরি ও রিকোয়েস্ট হাব (৮টি সেকশন)</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-white">
                        সদস্য ফিল্টারিং, সুইচ ট্র্যাকার ও পাসওয়ার্ড/পিন রিসেট হাব
                      </h3>
                      <p className="text-[10.5px] text-slate-400">
                        যেকোনো কার্ডে ক্লিক করলে সরাসরি নিচে সেই ক্যাটাগরির বিস্তারিত তালিকা ও অ্যাকশন বাটন ফিল্টার হবে।
                      </p>
                    </div>

                    {appLockResetUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab('reset_requests')}
                        className="bg-rose-950 hover:bg-rose-900 border border-rose-500/60 px-3 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition animate-pulse shrink-0"
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        <span className="text-xs font-black text-rose-200">
                          🔒 {appLockResetUsers.length}টি পাসওয়ার্ড/পিন রিসেট রিকোয়েস্ট!
                        </span>
                      </button>
                    )}
                  </div>

                  {/* 8 Sections in 4-per-row grid (Row 1: 4 Cards, Row 2: 4 Cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                    {/* 1. সর্বমোট সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('all')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'all'
                          ? 'bg-slate-800 border-slate-600 text-white shadow-md ring-2 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'all' ? 'text-emerald-300' : 'text-slate-400'
                        }`}>
                          🌐 সর্বমোট সদস্য
                        </span>
                        {generalMemberFilterTab === 'all' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-white font-mono">
                        {users.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-slate-400 truncate">
                        সকল নিবন্ধিত সদস্য
                      </p>
                    </button>

                    {/* 2. সমিতি / শেয়ার সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('samity')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'samity'
                          ? 'bg-emerald-950 border-emerald-500 text-white shadow-md ring-2 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-emerald-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'samity' ? 'text-emerald-300' : 'text-emerald-400'
                        }`}>
                          👥 সমিতি / শেয়ার
                        </span>
                        {generalMemberFilterTab === 'samity' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-emerald-300 font-mono">
                        {samityShareholderUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-emerald-400/80 truncate">
                        শেয়ার ও নিয়মিত সঞ্চয়ী
                      </p>
                    </button>

                    {/* 3. 🔴 সুইচ অফ সদস্য (রিফান্ড ফান্ড সহ) */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_off')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'switch_off'
                          ? 'bg-rose-950 border-rose-500 text-white shadow-md ring-2 ring-rose-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔴 সুইচ অফ
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-rose-200 font-mono">
                        {switchOffUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[8.5px] font-mono font-bold mt-1 text-amber-300 truncate">
                        রিফান্ড ৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}
                      </p>
                    </button>

                    {/* 4. 🟢 সুইচ অন সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_on')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'switch_on'
                          ? 'bg-teal-950 border-teal-500 text-white shadow-md ring-2 ring-teal-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-teal-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-teal-300">
                          🟢 সুইচ অন
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-teal-200 font-mono">
                        {switchOnUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-teal-400/80 truncate">
                        সক্রিয় নিয়মিত সঞ্চয়ী
                      </p>
                    </button>

                    {/* 5. 🌱 সাধারণ সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('general')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'general'
                          ? 'bg-sky-950 border-sky-500 text-white shadow-md ring-2 ring-sky-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-sky-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-sky-300">
                          🌱 সাধারণ সদস্য
                        </span>
                        {generalMemberFilterTab === 'general' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-sky-200 font-mono">
                        {generalAppUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-sky-400/80 truncate">
                        ফ্রি / বেসিক সদস্য
                      </p>
                    </button>

                    {/* 6. 💼 ইনভেস্টর সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('investor')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'investor'
                          ? 'bg-amber-950 border-amber-500 text-white shadow-md ring-2 ring-amber-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-amber-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-amber-300">
                          💼 ইনভেস্টর
                        </span>
                        {generalMemberFilterTab === 'investor' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-amber-200 font-mono">
                        {investorUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-amber-400/80 truncate">
                        কোম্পানি পার্টনার
                      </p>
                    </button>

                    {/* 7. 🛡️ সাব এডমিন */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('sub_admin')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'sub_admin'
                          ? 'bg-purple-950 border-purple-500 text-white shadow-md ring-2 ring-purple-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-purple-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-purple-300">
                          🛡️ সাব এডমিন
                        </span>
                        {generalMemberFilterTab === 'sub_admin' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-purple-200 font-mono">
                        {subAdminUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-purple-400/80 truncate">
                        অ্যাসাইনকৃত এডমিন
                      </p>
                    </button>

                    {/* 8. 🔒 পাসওয়ার্ড / পিন রিসেট */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('reset_requests')}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                        generalMemberFilterTab === 'reset_requests'
                          ? 'bg-rose-950 border-rose-400 text-white shadow-md ring-2 ring-rose-400'
                          : appLockResetUsers.length > 0
                          ? 'bg-rose-955/90 border-rose-500/60 text-rose-200 animate-pulse'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔒 পাসওয়ার্ড / পিন
                        </span>
                        {appLockResetUsers.length > 0 ? (
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        ) : (
                          <span className="text-[9px] text-slate-500">০</span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-xl font-black mt-1 leading-none text-rose-300 font-mono">
                        {appLockResetUsers.length} জন
                      </h3>
                      <p className="text-[7.5px] sm:text-[9px] font-bold mt-1 text-rose-400/90 truncate">
                        পাসওয়ার্ড/পিন রিকোয়েস্ট
                      </p>
                    </button>
                  </div>
                </div>
              );
            })()}"""

# Replace from start_str to end_str
start_str = '{/* Quick Statistics 5-Section Row */}'
end_str = '{/* ⏳ পেন্ডিং সমবায় সদস্য আবেদনপত্র দ্রুত নিয়ন্ত্রণ বক্স */}'

p1 = text.find(start_str)
p2 = text.find(end_str)

if p1 == -1 or p2 == -1:
    print('Error: Could not find markers p1 or p2', p1, p2)
    sys.exit(1)

# we replace text[p1:p2] with new_category_hub + '\n\n            '
text = text[:p1] + new_category_hub + '\n\n            ' + text[p2:]
print("Successfully replaced category hub and removed the old black board!")

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

