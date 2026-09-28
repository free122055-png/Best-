with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's craft the exact replacement for the top of general tab
old_block_marker_start = "adminTab === 'general' && ("
p_start = text.find(old_block_marker_start)
p_end_marker = "            {/* Filter and Search Section for Directory */}"
p_end = text.find(p_end_marker)

if p_start == -1 or p_end == -1:
    print(f"Failed to find markers: start={p_start}, end={p_end}")
    exit(1)

new_block = """adminTab === 'general' && (
          <div className="space-y-2.5 animate-fade-in text-slate-800 font-sans text-left pb-96 sm:pb-[480px]">
            {/* 1. Header Title Banner with Quick Controls - Slim & High-Density */}
            <div className="bg-gradient-to-r from-teal-700 via-emerald-800 to-teal-900 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-white relative overflow-hidden shadow-xs border border-teal-600/60">
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-teal-500/20 text-teal-200 border border-teal-500/30 px-2 py-0.2 rounded-full text-[9.5px] font-bold">
                      👥 সদস্য ডিরেক্টরি ও নিয়ন্ত্রণ
                    </span>
                    <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                      সমিতি সদস্য ডিরেক্টরি খাতা ও নিয়ন্ত্রণ প্যানেল
                    </h2>
                  </div>
                  <p className="text-[10px] text-teal-100/90 truncate">
                    সকল সদস্যের তথ্য, চার ডিজিটের পিন, ওয়ালেট ব্যালেন্স ও ক্যাটাগরি সরাসরি সংশোধন করুন।
                  </p>
                </div>

                {/* 🚀 Header Quick Actions (Waiver & Policy) - Slim Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                  {(() => {
                    const now = new Date();
                    const curYear = now.getFullYear();
                    const curMonthDef = BENGALI_MONTH_DEFS[now.getMonth()];
                    const isCurExempt = isMonthExemptedInConfig(curYear, curMonthDef?.key || '08');
                    const curMonthCfg = getMonthExemptConfig(curYear, curMonthDef?.key || '08');
                    const exemptDay = curMonthCfg.exemptUntilDay || policyFormState?.penaltyExemptionUntilDay || (isCurExempt ? 31 : 9);
                    const dayLabel = exemptDay === 31 ? 'পুরো মাস' : `${exemptDay}ই পর্যন্ত`;

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPenaltyDay(exemptDay > 9 ? exemptDay : 15);
                          setQuickPenaltyNote(curMonthCfg.note || policyFormState?.penaltyExemptionNote || '');
                          setIsQuickPenaltyModalOpen(true);
                        }}
                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 border active:scale-95 ${
                          isCurExempt
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300/40'
                            : 'bg-teal-950/70 hover:bg-teal-900 text-amber-200 border-teal-500/60'
                        }`}
                        title="জরিমানা স্থগিতের তারিখ পরিবর্তন করুন"
                      >
                        <span>🛡️</span>
                        <span>{isCurExempt ? `🟢 ${dayLabel} জরিমানা স্থগিত` : `🔴 জরিমানা স্বাভাবিক (9ই)`}</span>
                        <span className="text-[9px] bg-black/20 px-1 py-0.2 rounded font-bold">⚙️</span>
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(true)}
                    className="flex-1 sm:flex-initial px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-[10.5px] font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-300/40 active:scale-95"
                    title="সমিতির নিয়ম-কানুন ও পলিসি ওপেন করুন"
                  >
                    <span>📜</span>
                    <span>নিয়ম-কানুন পলিসি</span>
                    <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded-full font-mono">এডিট</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. ⚙️ গ্লোবাল সদস্য তথ্য নিজস্ব আপডেট সুইচ (Member Profile Self-Edit Switch) - Slim Bar */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-emerald-50 border border-amber-200/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-left">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">⚙️</span>
                  <h3 className="text-[11px] sm:text-xs font-black text-slate-900">
                    সদস্যদের নিজ প্রোফাইল তথ্য সংশোধন পাওয়ার সুইচ
                  </h3>
                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                    cfgAllowProfileSelfEdit 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {cfgAllowProfileSelfEdit ? '🟢 অন (ON)' : '🔴 অফ (OFF)'}
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-slate-600 truncate">
                  {cfgAllowProfileSelfEdit 
                    ? 'অন থাকায় সদস্যরা প্রোফাইল থেকে নাম, এনআইডি, ঠিকানা, ছবি ও নমিনি নিজেরা পরিবর্তন করতে পারবে।'
                    : 'অফ থাকায় সদস্যরা নিজেরা কোনো তথ্য এডিট করতে পারবে না (শুধুমাত্র এডমিন এডিট করতে পারবে)।'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleProfileSelfEdit(!cfgAllowProfileSelfEdit)}
                className={`w-full sm:w-auto px-3 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer shrink-0 shadow-2xs flex items-center justify-center gap-1 ${
                  cfgAllowProfileSelfEdit
                    ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
                }`}
              >
                <span>{cfgAllowProfileSelfEdit ? '🔒 অফ করুন (Disable)' : '🔓 অন করুন (Enable)'}</span>
              </button>
            </div>

            {/* 3. 🌟 8-Category Member Statistics & Control Hub (১ লাইনে ৪টি করে মোট ৮টি সেকশন) - Slim Grid */}
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
                <div className="bg-slate-900 border border-slate-800 p-2 sm:p-2.5 rounded-xl text-white space-y-1.5 shadow-md">
                  {/* Hub Header - Slim 1-line */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <h3 className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
                        📊 সদস্য ক্যাটাগরি ও রিকোয়েস্ট হাব (১ লাইনে ৪টি করে ৮টি সেকশন)
                      </h3>
                    </div>

                    {appLockResetUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab('reset_requests')}
                        className="bg-rose-950 hover:bg-rose-900 border border-rose-500/60 px-2 py-0.5 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition animate-pulse shrink-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                        <span className="text-[10px] font-black text-rose-200">
                          🔒 {appLockResetUsers.length}টি রিসেট রিকোয়েস্ট!
                        </span>
                      </button>
                    )}
                  </div>

                  {/* 8 Sections STRICTLY in 4-per-row grid (Row 1: 4 Cards, Row 2: 4 Cards) */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                    {/* 1. সর্বমোট সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('all')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'all'
                          ? 'bg-slate-800 border-slate-500 text-white shadow-xs ring-1 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className={`text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'all' ? 'text-emerald-300' : 'text-slate-400'
                        }`}>
                          🌐 সর্বমোট সদস্য
                        </span>
                        {generalMemberFilterTab === 'all' && (
                          <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-white font-mono truncate">
                        {users.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-slate-400 truncate">
                        সকল নিবন্ধিত
                      </p>
                    </button>

                    {/* 2. সমিতি / শেয়ার সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('samity')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'samity'
                          ? 'bg-emerald-950 border-emerald-500 text-white shadow-xs ring-1 ring-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-emerald-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className={`text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate ${
                          generalMemberFilterTab === 'samity' ? 'text-emerald-300' : 'text-emerald-400'
                        }`}>
                          👥 সমিতি / শেয়ার
                        </span>
                        {generalMemberFilterTab === 'samity' && (
                          <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-emerald-300 font-mono truncate">
                        {samityShareholderUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-emerald-400/80 truncate">
                        শেয়ার ও সঞ্চয়ী
                      </p>
                    </button>

                    {/* 3. 🔴 সুইচ অফ সদস্য (রিফান্ড ফান্ড সহ) */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_off')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'switch_off'
                          ? 'bg-rose-950 border-rose-500 text-white shadow-xs ring-1 ring-rose-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔴 সুইচ অফ
                        </span>
                        <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-rose-200 font-mono truncate">
                        {switchOffUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-rose-400/80 truncate">
                        ৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')} রিফান্ড
                      </p>
                    </button>

                    {/* 4. 🟢 সুইচ অন সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('switch_on')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'switch_on'
                          ? 'bg-teal-950 border-teal-500 text-white shadow-xs ring-1 ring-teal-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-teal-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-teal-300">
                          🟢 সুইচ অন
                        </span>
                        <span className="w-1 h-1 rounded-full bg-teal-400 animate-pulse shrink-0" />
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-teal-200 font-mono truncate">
                        {switchOnUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-teal-400/80 truncate">
                        নিয়মিত সঞ্চয়ী
                      </p>
                    </button>

                    {/* 5. 🌱 সাধারণ সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('general')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'general'
                          ? 'bg-sky-950 border-sky-500 text-white shadow-xs ring-1 ring-sky-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-sky-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-sky-300">
                          🌱 সাধারণ সদস্য
                        </span>
                        {generalMemberFilterTab === 'general' && (
                          <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-sky-200 font-mono truncate">
                        {generalAppUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-sky-400/80 truncate">
                        ফ্রি/বেসিক
                      </p>
                    </button>

                    {/* 6. 💼 ইনভেস্টর সদস্য */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('investor')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'investor'
                          ? 'bg-amber-950 border-amber-500 text-white shadow-xs ring-1 ring-amber-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-amber-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-amber-300">
                          💼 ইনভেস্টর
                        </span>
                        {generalMemberFilterTab === 'investor' && (
                          <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-amber-200 font-mono truncate">
                        {investorUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-amber-400/80 truncate">
                        কোম্পানি পার্টনার
                      </p>
                    </button>

                    {/* 7. 🛡️ সাব এডমিন */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('sub_admin')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'sub_admin'
                          ? 'bg-purple-950 border-purple-500 text-white shadow-xs ring-1 ring-purple-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-purple-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-purple-300">
                          🛡️ সাব এডমিন
                        </span>
                        {generalMemberFilterTab === 'sub_admin' && (
                          <span className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-purple-200 font-mono truncate">
                        {subAdminUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-purple-400/80 truncate">
                        অ্যাসাইনড এডমিন
                      </p>
                    </button>

                    {/* 8. 🔒 পাসওয়ার্ড / পিন রিসেট */}
                    <button
                      type="button"
                      onClick={() => setGeneralMemberFilterTab('reset_requests')}
                      className={`p-1.5 sm:p-2 rounded-lg border text-left transition-all cursor-pointer min-w-0 flex flex-col justify-between ${
                        generalMemberFilterTab === 'reset_requests'
                          ? 'bg-rose-950 border-rose-400 text-white shadow-xs ring-1 ring-rose-400'
                          : appLockResetUsers.length > 0
                          ? 'bg-rose-950/90 border-rose-500/60 text-rose-200 animate-pulse'
                          : 'bg-slate-950/70 border-slate-800 hover:border-rose-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="text-[7px] sm:text-[8.5px] font-extrabold uppercase block tracking-tight truncate text-rose-300">
                          🔒 পাসওয়ার্ড/পিন
                        </span>
                        {appLockResetUsers.length > 0 ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                        ) : (
                          <span className="text-[8px] text-slate-500 shrink-0">০</span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-base font-black mt-0.5 leading-none text-rose-300 font-mono truncate">
                        {appLockResetUsers.length} জন
                      </h4>
                      <p className="text-[6.5px] sm:text-[7.5px] font-medium mt-0.5 text-rose-400/90 truncate">
                        রিসেট রিকোয়েস্ট
                      </p>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 4. ⏳ পেন্ডিং সমবায় সদস্য আবেদনপত্র দ্রুত নিয়ন্ত্রণ বক্স - Slim Box */}
            {(() => {
              const samityPendingUsers = users.filter(u => u.samityStatus === 'pending' || u.approved === false);
              const totalPendingCount = samityPendingUsers.length;
              if (totalPendingCount === 0) return null;

              return (
                <div className="bg-gradient-to-r from-teal-900/90 via-slate-900 to-teal-950 border border-teal-500/80 p-3 sm:p-3.5 rounded-2xl text-white space-y-2 shadow-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-teal-500/30 pb-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-teal-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                        ⏳ সদস্য অ্যাকাউন্ট ও আবেদন অপেক্ষমান ({totalPendingCount} জন)
                      </h3>
                      <p className="text-[10px] text-teal-100/80">
                        নতুন সদস্যদের মেম্বারশিপ আবেদন রিভিউয়ের অপেক্ষায় রয়েছে।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminTab('approvals')}
                      className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs shrink-0"
                    >
                      🚀 সকল আবেদন দেখুন
                    </button>
                  </div>

                  {/* Pending Users List */}
                  {samityPendingUsers.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                      {samityPendingUsers.slice(0, 6).map((pu, idx) => (
                        <div key={`${pu.uid}-${idx}`} className="bg-slate-900/80 border border-teal-500/30 p-2.5 rounded-xl flex flex-col justify-between gap-2">
                          <div className="space-y-0.5 text-left min-w-0">
                            <div className="flex justify-between items-center gap-1">
                              <h5 className="text-xs font-black text-white truncate">{pu.name}</h5>
                              <span className="text-[8.5px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded font-bold">
                                {pu.memberId || 'N/A'}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-300 font-mono">📱 {pu.phone}</p>
                          </div>
                          <div className="flex gap-1.5 border-t border-slate-800 pt-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveUserAccount(pu)}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer"
                            >
                              ✓ অনুমোদন
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectUserAccount(pu)}
                              className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-[10.5px] font-bold rounded-lg transition cursor-pointer"
                            >
                              ❌ বাতিল
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 5. Header controls for Manual Member Registration Toggle & Serial ID Resequence - Slim Bar */}
            <div className="bg-white border border-slate-150 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>📌 সদস্য সিরিয়াল ও রেজিষ্ট্রেশন কন্ট্রোল</span>
                </h4>
                <p className="text-[10px] text-slate-500 truncate">
                  সদস্যদের সিরিয়াল আইডি 1 থেকে পরপর (BNB00000001 - 1,00,000) সুবিন্যস্ত রাখুন বা নতুন সদস্য যোগ করুন।
                </p>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  disabled={isResequencing}
                  onClick={handleResequenceAllMemberIds}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1 disabled:opacity-50"
                  title="সকল সদস্যের সিরিয়াল নম্বর 1 থেকে পরপর ঠিক করুন"
                >
                  <RefreshCw className={`w-3 h-3 ${isResequencing ? 'animate-spin' : ''}`} />
                  {isResequencing ? 'ফিক্স হচ্ছে...' : '🔢 সিরিয়াল 1 থেকে ঠিক করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    showAddMemberForm
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                      : 'bg-[#00a884] hover:bg-[#009675] text-white shadow-xs active:scale-95'
                  }`}
                >
                  {showAddMemberForm ? '✕ ফর্ম বন্ধ' : '➕ নতুন সদস্য নিবন্ধন'}
                </button>
              </div>
            </div>

            {/* Collapsing New Member Registration Form */}
            {showAddMemberForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    👥 নতুন সমবায় সদস্য ম্যানুয়াল রেজিষ্ট্রেশন
                  </h3>
                  <p className="text-[10px] text-slate-500">মেম্বার আইডি, মোবাইল নম্বর, 4 ডিজিটের পিন ও প্রারম্ভিক শেয়ার সঞ্চয় দিয়ে সরাসরি যুক্ত করুন।</p>
                </div>

                {regSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-[#00a884] text-xs p-2.5 rounded-xl font-bold">
                    {regSuccess}
                  </div>
                )}
                {regError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-2.5 rounded-xl font-bold">
                    {regError}
                  </div>
                )}

                <form onSubmit={handleManualMemberRegistration} className="space-y-3">
                  {/* Row 1: Name, Phone, PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্যের নাম (বাংলায়/ইংরেজিতে)</label>
                      <input
                        type="text"
                        required
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="যেমন: মোঃ রাজিব আহমেদ"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">মোবাইল নাম্বার (11 ডিজিট)</label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={newMemberPhone}
                        onChange={(e) => setNewMemberPhone(e.target.value.replace(/\\D/g, ''))}
                        placeholder="017XXXXXXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">4 ডিজিটের সিকিউরিটি পিন</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={newMemberPin}
                        onChange={(e) => setNewMemberPin(e.target.value.replace(/\\D/g, ''))}
                        placeholder="XXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 text-center tracking-widest outline-none focus:border-[#00a884]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Member ID Normalization & Groups */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য আইডি (BNB ফরম্যাট)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value.toUpperCase())}
                          placeholder="BNB00000001"
                          className="flex-1 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-850 outline-none focus:border-[#00a884]"
                        />
                        <button
                          type="button"
                          onClick={autoGenerateMemberId}
                          className="px-2.5 bg-teal-50 hover:bg-teal-100 text-[#00a884] border border-teal-200 text-[11px] font-black rounded-xl transition cursor-pointer"
                        >
                          অটো
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">অ্যাকাউন্ট ক্যাটাগরি রোল</label>
                      <select
                        value={newRole}
                        onChange={(e: any) => setNewRole(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="user">USER (কো-অপারেটিভ সাধারণ সদস্য)</option>
                        <option value="admin">ADMIN (মাস্টার ডিরেক্টর/পরিচালক)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য গ্রুপ ক্যাটাগরি</label>
                      <select
                        value={newMemberGroup}
                        onChange={(e: any) => setNewMemberGroup(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="general">সাধারণ সদস্য (5,000 টাকা লোন ক্যাটাগরি)</option>
                        <option value="admin">ভিআইপি গ্রুপ (বিশেষ ক্যাটাগরি লোন)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Initial Balances */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">মেইন ওয়ালেট (৳)</label>
                      <input
                        type="number"
                        value={newMainBal}
                        onChange={(e) => setNewMainBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">টেলিকম ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newTelBal}
                        onChange={(e) => setNewTelBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">সুপার শপ ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newShopBal}
                        onChange={(e) => setNewShopBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">শেয়ার সঞ্চয়/DPS (৳)</label>
                      <input
                        type="number"
                        value={newSavings}
                        onChange={(e) => setNewSavings(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">বকেয়া ঋণ স্থিতি (৳)</label>
                      <input
                        type="number"
                        value={newDueLoan}
                        onChange={(e) => setNewDueLoan(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-red-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMemberForm(false);
                        setRegSuccess('');
                        setRegError('');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-lg transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#00a884] hover:bg-[#009675] text-white text-xs font-black rounded-lg shadow-xs transition cursor-pointer"
                    >
                      নিশ্চিত মেম্বারশিপ এড করুন
                    </button>
                  </div>
                </form>
              </div>
            )}
"""

text = text[:p_start] + new_block + text[p_end:]
with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied slim design & 4-column layout successfully!")
