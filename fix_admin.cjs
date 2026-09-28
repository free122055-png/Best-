const fs = require('fs');

let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
const lines = content.split('\n');

// Find where the truncation occurred
let cutIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('const secDonors = don')) {
    cutIndex = i;
    break;
  }
}

if (cutIndex === -1) {
  console.log('Could not find truncated line. Checking end of file:');
  console.log(lines.slice(lines.length - 10).join('\n'));
  process.exit(1);
}

console.log('Found truncated line at index:', cutIndex);
const validLines = lines.slice(0, cutIndex);

const remainingCode = `                          const secDonors = donorList.filter((d: any) => d.sector === sec.id || (sec.id === 'general' && (!d.sector || d.sector === 'general')));
                          const secTotal = secDonors.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
                          return (
                            <div key={sec.id} className={\`\${sec.bg} border \${sec.border} p-3 rounded-xl flex flex-col justify-between gap-2\`}>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{sec.emoji}</span>
                                <span className={\`text-xs font-black \${sec.text}\`}>{sec.title}</span>
                              </div>
                              <div>
                                <span className="text-base font-black font-mono text-slate-900 block">৳{secTotal.toLocaleString('bn-BD')}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{secDonors.length} টি অনুদান</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Detailed Table for drillDownModalData */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      📋 বিস্তারিত হিসাব বিবরণী ও লেনদেন খতিয়ান ({drillDownModalData.history ? drillDownModalData.history.length : 0} টি রেকর্ড)
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-black sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">সদস্য / উৎস</th>
                          <th className="p-3">মোবাইল / আইডি</th>
                          <th className="p-3">বিবরণ</th>
                          <th className="p-3">তারিখ ও সময়</th>
                          <th className="p-3 text-right">পরিমাণ (৳)</th>
                          <th className="p-3 text-center">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {(() => {
                          const list = (drillDownModalData.history || []).filter((h: any) => {
                            if (!drillSearchQuery.trim()) return true;
                            const q = drillSearchQuery.toLowerCase();
                            return (
                              (h.name || '').toLowerCase().includes(q) ||
                              (h.phone || '').includes(q) ||
                              (h.memberId || '').toLowerCase().includes(q) ||
                              (h.reason || h.note || h.description || '').toLowerCase().includes(q)
                            );
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="text-center py-10 text-slate-400 font-bold">
                                  কোনো রেকর্ড পাওয়া যায়নি
                                </td>
                              </tr>
                            );
                          }

                          return list.map((item: any, idx: number) => (
                            <tr key={\`\${item.id || idx}-\${idx}\`} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{item.name || item.userName || item.senderName || 'সাধারণ সদস্য'}</td>
                              <td className="p-3 font-mono text-slate-600">{item.phone || item.memberId || '—'}</td>
                              <td className="p-3 text-slate-700 max-w-xs truncate">{item.reason || item.description || item.note || item.type || '—'}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">
                                {item.date || (item.createdAt ? new Date(item.createdAt).toLocaleString('bn-BD') : '—')}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                                ৳{(Number(item.amount || item.balance || item.savings || 0)).toLocaleString('bn-BD')}
                              </td>
                              <td className="p-3 text-center">
                                <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold \${
                                  item.status === 'success' || item.status === 'approved' || !item.status
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }\`}>
                                  {item.status || 'সফল'}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-white shrink-0">
            <span className="text-xs text-slate-400 font-bold">
              মোট রেকর্ড: {(drillDownModalData.history || []).length} টি • পাই-টু-পাই সমন্বিত
            </span>
            <button
              type="button"
              onClick={() => setDrillDownModalData(null)}
              className="px-5 py-2 bg-[#00a884] hover:bg-[#009675] text-white font-black text-xs rounded-xl transition cursor-pointer shadow-md active:scale-95"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Manual Fund Adjustment Modal */}
      {showFundAdjustModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 text-left animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden font-sans">
            <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-black">ব্যালেন্স ও ফান্ড সমন্বয় (Tune / Edit)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFundAdjustModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 flex items-center justify-center transition cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">সমন্বয়ের ফান্ড খাত</label>
                <select
                  value={adjustFundKey}
                  onChange={(e) => setAdjustFundKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  {fundBalanceCards.map((fc) => (
                    <option key={fc.key} value={fc.key}>{fc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">কাস্টম ব্যালেন্স মান (টাকা ৳)</label>
                <input
                  type="number"
                  placeholder="যেমন: 50000"
                  value={adjustCustomValue}
                  onChange={(e) => setAdjustCustomValue(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                ℹ️ <strong>টিপস:</strong> আপনি যে মানটি দেবেন, ড্যাশবোর্ডে সেটি প্রদর্শিত হবে। স্বয়ংক্রিয় গণনায় ফিরতে চাইলে &apos;রিসেট করুন&apos; চাপুন।
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const newAdjustments = { ...(appConfig?.manualFundAdjustments || {}) };
                      delete newAdjustments[adjustFundKey];
                      await updateDoc(doc(db, 'app_config', 'global'), {
                        manualFundAdjustments: newAdjustments
                      });
                      requestAlert('সফল', 'স্বয়ংক্রিয় গণনায় সফলভাবে ফিরে আসা হয়েছে!');
                      setShowFundAdjustModal(false);
                    } catch (e: any) {
                      requestAlert('ত্রুটি', e.message || 'ব্যালেন্স রিসেট করতে সমস্যা হয়েছে');
                    }
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  🔄 অটো রিসেট
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFundAdjustModal(false)}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const num = parseFloat(adjustCustomValue);
                      if (isNaN(num)) {
                        requestAlert('ত্রুটি', 'দয়া করে একটি সঠিক টাকার পরিমাণ লিখুন!');
                        return;
                      }
                      try {
                        const newAdjustments = { ...(appConfig?.manualFundAdjustments || {}) };
                        newAdjustments[adjustFundKey] = num;
                        await updateDoc(doc(db, 'app_config', 'global'), {
                          manualFundAdjustments: newAdjustments
                        });
                        requestAlert('সফল', 'ফান্ড ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!');
                        setShowFundAdjustModal(false);
                      } catch (e: any) {
                        requestAlert('ত্রুটি', e.message || 'ব্যালেন্স সেভ করতে সমস্যা হয়েছে');
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    💾 সেভ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
`;

const finalContent = validLines.join('\n') + '\n' + remainingCode;
fs.writeFileSync('src/components/AdminPanel.tsx', finalContent, 'utf8');
console.log('Successfully completed AdminPanel.tsx! New line count:', finalContent.split('\n').length);
