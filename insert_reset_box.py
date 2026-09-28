with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '{/* 🔐 সদস্য সিকিউরিটি ও লাস্ট গোপন অ্যাপ লক পাসওয়ার্ড বার */}'

replacement = """{/* 🚨 পেন্ডিং পাসওয়ার্ড / পিন / অ্যাপ লক রিসেট বক্স */}
                                 {(u.appLockResetRequested || u.appLockResetStatus === 'pending' || u.forgotPinRequested || u.pinResetRequested) && (
                                   <div className="bg-gradient-to-r from-rose-950 to-slate-950 border-2 border-rose-500 rounded-xl p-2.5 text-white space-y-2 shadow-md">
                                     <div className="flex items-center justify-between">
                                       <span className="text-[10.5px] font-black text-rose-300 flex items-center gap-1.5">
                                         <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                         🔒 পাসওয়ার্ড / পিন ভুলে গেছেন (লক রিকোয়েস্ট)
                                       </span>
                                       {u.appLockResetRequestedAt && (
                                         <span className="text-[8.5px] text-slate-400 font-mono">
                                           🕒 {new Date(u.appLockResetRequestedAt).toLocaleTimeString('bn-BD')}
                                         </span>
                                       )}
                                     </div>
                                     <p className="text-[10px] text-rose-200/90 leading-tight">
                                       সদস্য পাসওয়ার্ড/পিন মনে নেই বলে রিকোয়েস্ট পাঠিয়েছেন। অনুমোদন দিলে অ্যাপ তাৎক্ষণিক আনলক হবে এবং পিন <strong className="text-amber-300">১২৩৪</strong> এ রিসেট হবে।
                                     </p>
                                     <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-900/60">
                                       <button
                                         type="button"
                                         onClick={() => handleApproveAppLockReset(u)}
                                         className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
                                       >
                                         <span>✓ অনুমোদন ও আনলক (পিন ১২৩৪)</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => handleRejectAppLockReset(u)}
                                         className="px-2 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10.5px] rounded-lg transition cursor-pointer border border-rose-700/60"
                                       >
                                         ❌ বাতিল
                                       </button>
                                       <a
                                         href={`tel:${u.phone}`}
                                         className="px-2.5 py-1.5 bg-sky-800 hover:bg-sky-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center gap-1"
                                       >
                                         <span>📞 কল</span>
                                       </a>
                                     </div>
                                   </div>
                                 )}

                                 {/* 🔐 সদস্য সিকিউরিটি ও লাস্ট গোপন অ্যাপ লক পাসওয়ার্ড বার */}"""

if target in text:
    text = text.replace(target, replacement, 1)
    print("Successfully added reset request box inside member card!")
    with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
else:
    print("Could not find target string!")
