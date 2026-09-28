with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's check where the card rendering starts
old_grid_start = """                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">"""

new_grid_start = """                      return (
                        <div className="space-y-3">
                          {/* 📢 Contextual Banner for Switch OFF (25 Dec Refund) */}
                          {generalMemberFilterTab === 'switch_off' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/90 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-amber-400 text-xl shrink-0">🛡️</span>
                                <div>
                                  <h4 className="font-black text-amber-300 text-xs sm:text-sm">
                                    ২৫শে ডিসেম্বর রিফান্ড ফান্ড পলিসি ও সুইচ অফ সদস্য তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    সুইচ অফ সদস্যদের জমাকৃত মোট <strong className="text-amber-300">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</strong> টাকা আগামী <strong>২৫শে ডিসেম্বর</strong> কোনো প্রকার ফি ছাড়াই স্ব-স্ব মেইন ওয়ালেটে স্বয়ংক্রিয়ভাবে রিফান্ড প্রদান করা হবে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-amber-500/40 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-amber-400 font-bold uppercase">মোট রিফান্ড তহবিলঃ</span>
                                <span className="text-sm font-black text-amber-300 font-mono">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</span>
                              </div>
                            </div>
                          )}

                          {/* 📢 Contextual Banner for Password/PIN Reset Requests */}
                          {generalMemberFilterTab === 'reset_requests' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border border-rose-500/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-rose-400 text-xl shrink-0">🔒</span>
                                <div>
                                  <h4 className="font-black text-rose-300 text-xs sm:text-sm">
                                    পাসওয়ার্ড / পিন ও অ্যাপ লক রিসেট রিকোয়েস্ট তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    যেসব সদস্য পাসওয়ার্ড বা পিন ভুলে গিয়ে অ্যাপ লক আনলকের রিকোয়েস্ট পাঠিয়েছেন তাদের তালিকা নিচে প্রদর্শিত হচ্ছে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-rose-500/50 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-rose-300 font-bold uppercase">অপেক্ষমান রিকোয়েস্টঃ</span>
                                <span className="text-sm font-black text-rose-200 font-mono">{filtered.length} জন</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">"""

if old_grid_start in text:
    text = text.replace(old_grid_start, new_grid_start, 1)
    print("Added contextual banners above member grid!")
else:
    print("Could not find old_grid_start")

# Now let's close the outer div for the member grid
old_grid_end = """                            );
                          })}
                        </div>
                      );"""

new_grid_end = """                            );
                          })}
                          </div>
                        </div>
                      );"""

if old_grid_end in text:
    text = text.replace(old_grid_end, new_grid_end, 1)
    print("Closed wrapper div for member grid!")
else:
    print("Could not find old_grid_end")

# Now add prominent reset request box inside member card
old_applock_box = """                                 {/* 🔐 সদস্য সিকিউরিটি ও লাস্ট গোপন অ্যাপ লক পাসওয়ার্ড বার */}"""

new_applock_box = """                                 {/* 🚨 পেন্ডিং পাসওয়ার্ড / পিন / অ্যাপ লক রিসেট বক্স */}
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

if old_applock_box in text:
    text = text.replace(old_applock_box, new_applock_box, 1)
    print("Added prominent reset action box inside member card!")
else:
    print("Could not find old_applock_box")

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
