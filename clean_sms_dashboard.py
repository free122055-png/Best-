with open('src/components/BNBSmsGatewayDashboard.tsx', 'r') as f:
    code = f.read()

# 1. Replace Top Green Header Banner with Clean Minimal Header Bar
old_header_banner = """      {/* 1. Header Banner - Official Deep Green (#0b6623) */}
      <div className="bg-[#0b6623] text-white p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-black uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>BNB bKash Payment Detection & Control Center</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>অটোমেটিক bKash SMS পেমেন্ট ভেরিফিকেশন সিস্টেম</span>
              <span className="text-xs bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full font-bold">
                Personal Account
              </span>
            </h2>
            <p className="text-emerald-100/90 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Android ফোনে আসা Personal bKash পেমেন্ট SMS স্বয়ংক্রিয়ভাবে শনাক্তকরণ, ডুপ্লিকেট প্রতিরোধ এবং সদস্যের পরিচয় নিশ্চিতকরণপূর্বক নিরাপদ ব্যালেন্স প্রক্রিয়াকরণ।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkSystemStatus}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>
        </div>

        {/* Real-time System Status Badges */}
        <div className="mt-4 pt-3 border-t border-emerald-700/60 flex flex-wrap items-center gap-3 text-xs">
          {/* Gateway Status Badge */}
          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full border border-white/10">
            <span className={`w-2 h-2 rounded-full ${firebaseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="font-bold text-white">Firebase:</span>
            <span className={firebaseStatus === 'connected' ? 'text-emerald-200 font-semibold' : 'text-rose-200 font-semibold'}>
              {firebaseStatus === 'connected' ? 'অনলাইন ও রিয়েলটাইম সংযুক্ত' : 'সংযোগ বিচ্ছিন্ন'}
            </span>
          </div>

          {/* Android SMS Listener Badge */}
          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full border border-white/10">
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-bold text-white">SMS Listener:</span>
            <span className="text-amber-200 font-semibold">
              {nativeStatus.isNative ? (nativeStatus.hasPermission ? 'Android Native সক্রিয়' : 'অনুমতি প্রয়োজন') : 'Webhook / Forwarder রেডি'}
            </span>
          </div>

          {/* Personal Account Security Notice */}
          <div className="flex items-center gap-1.5 bg-amber-400/20 text-amber-100 px-3 py-1 rounded-full border border-amber-300/30">
            <Lock className="w-3 h-3 text-amber-300" />
            <span className="font-medium text-[11px]">
              Personal Account নীতি: কোনো পেমেন্ট সরাসরি ব্যালেন্সে যোগ হবে না; সর্বদা Pending Verification-এ সুরক্ষিত থাকবে।
            </span>
          </div>
        </div>
      </div>"""

new_header_banner = """      {/* Minimal Header Bar */}
      <div className="bg-slate-900 text-white p-4 px-6 shadow-xs flex items-center justify-between font-sans border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm sm:text-base font-black tracking-tight text-white">bKash SMS পেমেন্ট ভেরিফিকেশন ও ট্রানজেকশন তথ্য</h2>
        </div>
        <button
          type="button"
          onClick={checkSystemStatus}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/15"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>"""

if old_header_banner in code:
    code = code.replace(old_header_banner, new_header_banner)
    print("Replaced header banner!")
else:
    print("Could not find exact old_header_banner")


# 2. Replace Tab 1 Contents (remove stat cards, webhook box, and test simulator box; render live payment detection table)
old_tab1_content = """        {/* =========================================================================
            TAB 1: PAYMENT DETECTION STATUS
           ========================================================================= */}
        {activeTab === 'detection_status' && (
          <div className="space-y-6">
            {/* Quick Metrics Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-slate-500 text-xs font-bold mb-1">মোট শনাক্তকৃত SMS</div>
                <div className="text-2xl font-black text-slate-800 font-mono">{allDetectedPayments.length}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-1">bKash পেমেন্ট রেকর্ড</div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
                <div className="text-amber-800 text-xs font-bold mb-1">Pending Verification</div>
                <div className="text-2xl font-black text-amber-700 font-mono">{pendingPayments.length}</div>
                <div className="text-[10px] text-amber-700 font-medium mt-1">যাচাইয়ের অপেক্ষায়</div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="text-emerald-800 text-xs font-bold mb-1">Verified Transactions</div>
                <div className="text-2xl font-black text-emerald-700 font-mono">{verifiedPayments.length}</div>
                <div className="text-[10px] text-emerald-700 font-medium mt-1">ব্যালেন্সে ক্রেডিট সম্পন্ন</div>
              </div>

              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-xs">
                <div className="text-rose-800 text-xs font-bold mb-1">Duplicate Blocked</div>
                <div className="text-2xl font-black text-rose-700 font-mono">{duplicatesCombined.length}</div>
                <div className="text-[10px] text-rose-600 font-medium mt-1">ডাবল এন্ট্রি প্রতিহত</div>
              </div>

              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 shadow-xs">
                <div className="text-slate-600 text-xs font-bold mb-1">Failed / Rejected</div>
                <div className="text-2xl font-black text-slate-700 font-mono">{failedPayments.length}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-1">বাতিলকৃত ট্রানজেকশন</div>
              </div>
            </div>

            {/* Android Webhook & Configuration Panel */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-[#0b6623]" />
                    <span>Android SMS রিসিভার ও Webhook সংযোগ</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    যে Android ফোনে bKash-এর পার্সোনাল সিম রয়েছে, সেই ফোনে নিচের Webhook বা নেটিভ অ্যাপ সেট করুন:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(webhookUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="px-4 py-2 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'URL কপি হয়েছে' : 'URL কপি করুন'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800 truncate">
                {webhookUrl || 'ওয়েবহুক ইউআরএল তৈরি হচ্ছে...'}
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>প্ল্যাটফর্ম ও ব্যাকগ্রাউন্ড SMS বাস্তবতা:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Web ব্রাউজার সরাসরি ফোনের ব্যাকগ্রাউন্ড SMS অ্যাক্সেস করতে পারে না (ব্রাউজার সিকিউরিটি স্যান্ডবক্স)। পেমেন্ট সিমযুক্ত ফোনে আমাদের অ্যান্ড্রয়েড APK (যার ভেতর BkashSmsReceiver এবং RECEIVE_SMS পারমিশন রয়েছে) অথবা ব্যাকগ্রাউন্ড SMS Forwarder APK চালু থাকতে হবে।
                </p>
              </div>
            </div>

            {/* Live bKash SMS Detection Simulator (Requirement 2 & 15) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                <Terminal className="w-4 h-4 text-[#0b6623]" />
                <span>🧪 bKash SMS রিয়েল-টাইম ডিটেকশন ও পার্সিং টেস্ট সিমুলেটর</span>
              </div>
              <p className="text-xs text-slate-500">
                পার্সোনাল bKash একাউন্টে টাকা আসার যেকোনো মেসেজ নিচে টেস্ট করে দেখতে পারেন। সিস্টেম স্বয়ংক্রিয়ভাবে TrxID ও Amount শনাক্ত করে Pending Verification তালিকায় সংরক্ষণ করবে এবং ডুপ্লিকেট TrxID আসলে তা প্রতিহত করবে:
              </p>

              <form onSubmit={handleSimulateSms} className="space-y-3.5">
                {/* Quick Real-world SMS Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">দ্রুত টেস্ট টেমপ্লেট:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'BK' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01811223344. Fee Tk 0.00. Balance Tk 25,450.00. TrxID ${randTrx} at 13/10/2026 14:00`;
                      setSimForm({
                        sender: 'bKash',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01811223344'
                      });
                    }}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-[#d12053] border border-pink-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🌸 বিকাশ (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'NG' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01722334455. Fee Tk 0.00. Balance: Tk 18,200.00. TxnID: ${randTrx} at 13/10/2026 14:15`;
                      setSimForm({
                        sender: '16167',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01722334455'
                      });
                    }}
                    className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#d96b00] border border-orange-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🍊 নগদ (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'RK' + Math.random().toString(36).substring(2, 10).toUpperCase();
                      const msg = `You have received Tk 1,500.00 from 01933445566. TxnId: ${randTrx}. Your balance is Tk 32,500.00.`;
                      setSimForm({
                        sender: '16216',
                        message: msg,
                        trxId: randTrx,
                        amount: '1500',
                        senderPhone: '01933445566'
                      });
                    }}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-[#8c3494] border border-purple-200 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                  >
                    🟣 রকেট (৳১,৫০০)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const randTrx = 'MFS' + Math.random().toString(36).substring(2, 9).toUpperCase();
                      setSimForm(prev => ({
                        ...prev,
                        trxId: randTrx,
                        message: prev.message.replace(/(?:TrxID|TxnID|TxnId|Trx\s*Id)[:\s]+[A-Za-z0-9]+/i, `TrxID ${randTrx}`)
                      }));
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0b6623] border border-emerald-200 rounded-lg text-[11px] font-black transition cursor-pointer"
                  >
                    🎲 নতুন TrxID তৈরি
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    MFS SMS টেক্সট (bKash / Nagad / Rocket):
                  </label>
                  <textarea
                    rows={2}
                    value={simForm.message}
                    onChange={(e) => {
                      const msg = e.target.value;
                      // Auto-extract TrxID, Amount and Phone for live preview
                      const trxMatch = msg.match(/(?:TrxID|trxID|TRXID|Trx\s*Id|TxnID|TxnId|TXNID|Txn\s*Id|Transaction\s*ID|Txn|Trx)[:\s]*([A-Za-z0-9]{8,15})/i);
                      const amtMatch = msg.match(/(?:(?:received|cash\s*in|deposit|amount|পরিমাণ)[:\s]*(?:Tk\.?|TK\.?|BDT|৳|টাকা)?|(?:Tk\.?|TK\.?|BDT|৳|টাকা))\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
                      const phoneMatch = msg.match(/(?:from|by|Sender|প্রেরক|হতে|থেকে)[:\s]*(\+?8801[3-9]\d{8,9}|01[3-9]\d{8,9})/i);
                      setSimForm({
                        ...simForm,
                        message: msg,
                        trxId: trxMatch ? trxMatch[1] : simForm.trxId,
                        amount: amtMatch ? amtMatch[1].replace(/,/g, '') : simForm.amount,
                        senderPhone: phoneMatch ? phoneMatch[1] : simForm.senderPhone
                      });
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:border-[#0b6623] focus:outline-none transition"
                    placeholder="You have received Tk 1,500.00 from 018... TrxID / TxnID..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">শনাক্তকৃত TrxID:</label>
                    <input
                      type="text"
                      value={simForm.trxId}
                      onChange={(e) => setSimForm({ ...simForm, trxId: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#0b6623]"
                      placeholder="TrxID"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">শনাক্তকৃত Amount (টাকা):</label>
                    <input
                      type="text"
                      value={simForm.amount}
                      onChange={(e) => setSimForm({ ...simForm, amount: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#0b6623]"
                      placeholder="1500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">প্রেরকের নম্বর (Sender Phone):</label>
                    <input
                      type="text"
                      value={simForm.senderPhone}
                      onChange={(e) => setSimForm({ ...simForm, senderPhone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      placeholder="01811223344"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-amber-700 font-medium">
                    💡 টেস্ট বাটনে চাপ দিলে Webhook-এ কল হয়ে ফায়ারবেসে রিয়েল ডাটা সেভ হবে।
                  </div>

                  <button
                    type="submit"
                    disabled={simLoading || !simForm.trxId || !simForm.amount}
                    className="px-5 py-2.5 bg-[#0b6623] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>টেস্ট পেমেন্ট SMS পাঠান</span>
                  </button>
                </div>
              </form>

              {/* Simulation Result Output */}
              {simResult && (
                <div className={`p-3.5 rounded-2xl border text-xs font-mono ${
                  simResult.status === 'duplicate_rejected'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : simResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {simResult.status === 'duplicate_rejected' ? (
                      <>
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>ডুপ্লিকেট TrxID প্রতিহত হয়েছে (Duplicate Prevention Working)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ফলাফল: {simResult.message || simResult.status}</span>
                      </>
                    )}
                  </div>
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap mt-1">
                    {JSON.stringify(simResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}"""

new_tab1_content = """        {/* =========================================================================
            TAB 1: PAYMENT DETECTION STATUS (CLEAN DIRECT LIST)
           ========================================================================= */}
        {activeTab === 'detection_status' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="TrxID, মোবাইল নম্বর বা সদস্য নাম দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#0b6623] transition font-sans"
                />
              </div>
              <div className="text-xs text-slate-500 font-bold shrink-0">
                মোট শনাক্তকৃত রেকর্ড: <span className="font-mono text-slate-800 font-black">{displayedPayments.length}</span> টি
              </div>
            </div>

            {displayedPayments.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-slate-700">কোনো শনাক্তকৃত পেমেন্ট রেকর্ড নেই</h4>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedPayments.map((payment: DetectedPayment) => (
                  <div
                    key={payment.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-[#0b6623] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {payment.trxId}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          📱 {payment.senderPhone || 'ফোন নম্বর নেই'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          🕒 {new Date(payment.detectedAt).toLocaleString('bn-BD')}
                        </span>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div className="text-base font-black text-slate-800 font-mono">
                          ৳{Number(payment.amount || 0).toLocaleString()}
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          payment.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : payment.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : payment.status === 'duplicate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {payment.status === 'verified' ? '✓ অনুমোদিত' : payment.status === 'rejected' ? '❌ বাতিল' : payment.status === 'duplicate' ? '⚠️ ডুপ্লিকেট' : '⏳ পন্ডিং'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 text-xs flex items-center justify-between">
                      <div className="truncate text-slate-600 font-mono text-[11px]">
                        "{payment.rawMessage || payment.message}"
                      </div>
                      {payment.matchedUserName && (
                        <div className="text-emerald-700 font-bold shrink-0 ml-2">
                          👤 {payment.matchedUserName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}"""

if old_tab1_content in code:
    code = code.replace(old_tab1_content, new_tab1_content)
    print("Replaced Tab 1 contents with clean list!")
else:
    print("Could not find exact old_tab1_content")

with open('src/components/BNBSmsGatewayDashboard.tsx', 'w') as f:
    f.write(code)

print("Cleaned BNBSmsGatewayDashboard.tsx successfully!")
