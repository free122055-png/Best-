import re

# 1. Update AdminBankSection.tsx
with open('src/components/admin/AdminBankSection.tsx', 'r') as f:
    code = f.read()

# Define grid services metadata list and component code
grid_manager_code = """
  // 12 Grid Services State
  const [gridIconsMap, setGridIconsMap] = useState<Record<string, string>>(appConfig.customGridIcons || {});
  const [gridTitlesMap, setGridTitlesMap] = useState<Record<string, string>>({
    cardSamityTitle: appConfig.globalTexts?.cardSamityTitle || 'BNB কোম্পানি ইনভেস্টর',
    cardSafeDealsTitle: appConfig.globalTexts?.cardSafeDealsTitle || 'BNB নিরাপদ লেনদেন',
    cardQardTitle: appConfig.globalTexts?.cardQardTitle || 'BNB কার্জ হাসানা',
    cardBankTitle: appConfig.globalTexts?.cardBankTitle || 'MY BNB লেনদেন',
    cardTelecomTitle: appConfig.globalTexts?.cardTelecomTitle || 'BNB টেলিকম',
    cardRationTitle: appConfig.globalTexts?.cardRationTitle || 'BNB রেশন কার্ড',
    cardSalaryTitle: appConfig.globalTexts?.cardSalaryTitle || 'BNB অটো সেলারি পে',
    cardSafiTitle: appConfig.globalTexts?.cardSafiTitle || 'al safi',
    cardAutoRechargeTitle: appConfig.globalTexts?.cardAutoRechargeTitle || 'BNB ডাটা রিচার্জ',
    cardBillPayTitle: appConfig.globalTexts?.cardBillPayTitle || 'BNB বিল পে',
    cardAgentTitle: appConfig.globalTexts?.cardAgentTitle || 'BNB এজেন্ট',
    cardAboutTitle: appConfig.globalTexts?.cardAboutTitle || 'BNB আমাদের লক্ষ্য',
  });
  const [savingGridConfig, setSavingGridConfig] = useState(false);

  const GRID_SERVICES_LIST = [
    { key: 'samity', titleKey: 'cardSamityTitle', defaultTitle: 'BNB কোম্পানি ইনভেস্টর' },
    { key: 'safedeals', titleKey: 'cardSafeDealsTitle', defaultTitle: 'BNB নিরাপদ লেনদেন' },
    { key: 'qard', titleKey: 'cardQardTitle', defaultTitle: 'BNB কার্জ হাসানা' },
    { key: 'bank', titleKey: 'cardBankTitle', defaultTitle: 'MY BNB লেনদেন' },
    { key: 'telecom', titleKey: 'cardTelecomTitle', defaultTitle: 'BNB টেলিকম' },
    { key: 'ration', titleKey: 'cardRationTitle', defaultTitle: 'BNB রেশন কার্ড' },
    { key: 'salary', titleKey: 'cardSalaryTitle', defaultTitle: 'BNB অটো সেলারি পে' },
    { key: 'safi', titleKey: 'cardSafiTitle', defaultTitle: 'al safi' },
    { key: 'auto_recharge', titleKey: 'cardAutoRechargeTitle', defaultTitle: 'BNB ডাটা রিচার্জ' },
    { key: 'bill_pay', titleKey: 'cardBillPayTitle', defaultTitle: 'BNB বিল পে' },
    { key: 'agent', titleKey: 'cardAgentTitle', defaultTitle: 'BNB এজেন্ট' },
    { key: 'about', titleKey: 'cardAboutTitle', defaultTitle: 'BNB আমাদের লক্ষ্য' },
  ];

  const handleCustomIconUpload = (serviceKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('দয়া করে কেবল ছবি (Image) ফাইল বেছে নিন।');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_DIM = 128;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/png');
            setGridIconsMap(prev => ({ ...prev, [serviceKey]: compressedUrl }));
          } else {
            setGridIconsMap(prev => ({ ...prev, [serviceKey]: dataUrl }));
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetCustomIcon = (serviceKey: string) => {
    setGridIconsMap(prev => {
      const copy = { ...prev };
      delete copy[serviceKey];
      return copy;
    });
  };

  const handleSaveGridCustomizations = async () => {
    setSavingGridConfig(true);
    try {
      const updatedConfig = {
        ...appConfig,
        customGridIcons: gridIconsMap,
        globalTexts: {
          ...appConfig.globalTexts,
          ...gridTitlesMap
        }
      };

      await setDoc(doc(db, 'system_settings', 'app_config'), updatedConfig, { merge: true });
      await setDoc(doc(db, 'app_config', 'main'), updatedConfig, { merge: true });
      if (onChangeConfig) onChangeConfig(updatedConfig);

      alert('ড্যাশবোর্ডের ১২টি সার্ভিস আইকন ও টাইটেল সফলভাবে সেভ হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('আইকন ও টাইটেল সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSavingGridConfig(false);
    }
  };
"""

# Insert state & handlers before return in AdminBankSection
idx_return = code.find('return (')
if idx_return != -1 and 'GRID_SERVICES_LIST' not in code:
    code = code[:idx_return] + grid_manager_code + '\n\n' + code[idx_return:]

# Now add UI markup for the 12 Services Manager right after global settings form
ui_section = """
            {/* 🖼️ ১২টি ড্যাশবোর্ড সার্ভিস আইকন ও টাইটেল পরিবর্তন ম্যানেজার */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-left space-y-5 shadow-xs">
              <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span className="text-lg">🎨</span>
                    <span>১২টি ড্যাশবোর্ড সার্ভিস আইকন ও কাস্টম টাইটেল ম্যানেজার</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    গ্যালারি থেকে আপনার পছন্দমত ছবি/লোগো সিলেক্ট করে সার্ভিস আইকন পরিবর্তন করুন এবং নিচে বাংলা টাইটেল টাইপ করুন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveGridCustomizations}
                  disabled={savingGridConfig}
                  className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-2"
                >
                  {savingGridConfig ? 'সেভ হচ্ছে...' : '✓ আইকন ও টাইটেল সেভ করুন'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {GRID_SERVICES_LIST.map((srv) => {
                  const customImg = gridIconsMap[srv.key];
                  const currentTitle = gridTitlesMap[srv.titleKey] || srv.defaultTitle;

                  return (
                    <div 
                      key={srv.key}
                      className="bg-slate-50/80 border border-slate-200/70 p-3.5 rounded-2xl flex flex-col justify-between space-y-3 relative hover:border-slate-300 transition-colors"
                    >
                      {/* Top Preview Badge */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                          {customImg ? (
                            <img src={customImg} alt={srv.key} className="w-full h-full object-contain rounded-xl" />
                          ) : (
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                              ডিফল্ট
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">সার্ভিস {srv.key}</p>
                          <p className="text-xs font-black text-slate-800 truncate">{currentTitle}</p>
                        </div>
                      </div>

                      {/* Title Edit Input */}
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase">সার্ভিসের নাম</label>
                        <input
                          type="text"
                          value={currentTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGridTitlesMap(prev => ({ ...prev, [srv.titleKey]: val }));
                          }}
                          className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Icon Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <label className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10.5px] font-black text-center cursor-pointer transition truncate">
                          🖼️ গ্যালারি
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCustomIconUpload(srv.key, e)}
                            className="hidden"
                          />
                        </label>
                        {customImg && (
                          <button
                            type="button"
                            onClick={() => handleResetCustomIcon(srv.key)}
                            title="ডিফল্ট আইকনে ফেরত যান"
                            className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-[10.5px] font-black transition cursor-pointer shrink-0"
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveGridCustomizations}
                  disabled={savingGridConfig}
                  className="py-3 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  {savingGridConfig ? 'সেভ হচ্ছে...' : '✓ আইকন ও টাইটেল পরিবর্তনগুলো সেভ করুন'}
                </button>
              </div>
            </div>
"""

idx_form_end = code.find('</form>', code.find('globalWelcomeTitle'))
if idx_form_end != -1 and '১২টি ড্যাশবোর্ড সার্ভিস আইকন' not in code:
    code = code[:idx_form_end+7] + '\n\n' + ui_section + '\n' + code[idx_form_end+7:]

with open('src/components/admin/AdminBankSection.tsx', 'w') as f:
    f.write(code)

print('Updated AdminBankSection.tsx with 12 Grid Manager successfully!')
