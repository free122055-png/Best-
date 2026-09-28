import React, { useState, useEffect } from 'react';
import { Settings, Power, MapPinned, User } from 'lucide-react';

interface AgentProfile {
  id: string;
  name: string;
  city: string;
  country: string;
  phone: string;
  whatsapp?: string;
  messenger?: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  shopMapLink?: string;
  locationNumber?: string;
  status?: 'Available' | 'Busy' | 'Offline';
  liveLocationEnabled?: boolean;
}

interface AgentDashboardPanelProps {
  myAgentProfile: AgentProfile;
  t: any;
  lang: 'bn' | 'en';
  isUpdatingLoc: boolean;
  isSavingAgentProfile: boolean;
  onUpdateStatus: (status: 'Available' | 'Busy' | 'Offline') => Promise<void>;
  onToggleLiveLocation: (enabled: boolean) => Promise<void>;
  onUpdateCoordinates: () => void;
  onSaveProfile: (profileData: any) => Promise<void>;
}

export default function AgentDashboardPanel({
  myAgentProfile,
  t,
  lang,
  isUpdatingLoc,
  isSavingAgentProfile,
  onUpdateStatus,
  onToggleLiveLocation,
  onUpdateCoordinates,
  onSaveProfile,
}: AgentDashboardPanelProps) {
  const [dashName, setDashName] = useState<string>('');
  const [dashCity, setDashCity] = useState<string>('');
  const [dashCountry, setDashCountry] = useState<string>('');
  const [dashPhone, setDashPhone] = useState<string>('');
  const [dashWhats, setDashWhats] = useState<string>('');
  const [dashMsg, setDashMsg] = useState<string>('');
  const [dashDist, setDashDist] = useState<string>('');
  const [dashThana, setDashThana] = useState<string>('');
  const [dashPost, setDashPost] = useState<string>('');
  const [dashShopMapLink, setDashShopMapLink] = useState<string>('');

  // Sync state values on load or update
  useEffect(() => {
    if (myAgentProfile) {
      setDashName(myAgentProfile.name || '');
      setDashCity(myAgentProfile.city || '');
      setDashCountry(myAgentProfile.country || '');
      setDashPhone(myAgentProfile.phone || '');
      setDashWhats(myAgentProfile.whatsapp || myAgentProfile.phone || '');
      setDashMsg(myAgentProfile.messenger || '');
      setDashDist(myAgentProfile.district || '');
      setDashThana(myAgentProfile.thana || '');
      setDashPost(myAgentProfile.postOffice || '');
      setDashShopMapLink(myAgentProfile.shopMapLink || '');
    }
  }, [myAgentProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name: dashName,
      city: dashCity,
      country: dashCountry,
      phone: dashPhone,
      whatsapp: dashWhats,
      messenger: dashMsg,
      district: dashDist,
      thana: dashThana,
      postOffice: dashPost,
      shopMapLink: dashShopMapLink,
    });
  };

  return (
    <div className="space-y-4 animate-fade-in text-left">
      <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-3xl text-white space-y-1.5 shadow-md">
        <h2 className="text-sm font-black text-white flex items-center gap-1.5">
          <Settings className="w-4.5 h-4.5 text-teal-300" />
          {t.agentDashTitle}
        </h2>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
          {lang === 'bn' 
            ? 'আপনার অন-ডিউটি স্ট্যাটাস পরিবর্তন করুন, নতুন লাইভ জিপিএস স্থানাঙ্ক ব্রডকাস্ট করুন এবং প্রোফাইল ডিটেইলস কাস্টমাইজ করুন।' 
            : 'Manage your active duty status, broadcast live GPS, and update profile coordinates directly.'}
        </p>
      </div>

      {/* Availability status selectors */}
      <div className="bg-white border border-slate-150 rounded-3xl p-4.5 shadow-3xs space-y-3.5">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Power className="w-4 h-4 text-emerald-500" />
          {t.agentDashStatusTitle}
        </h3>
        
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'Available', label: lang === 'bn' ? '🟢 সক্রিয় (Active)' : '🟢 Active', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
            { key: 'Busy', label: lang === 'bn' ? '🟡 ব্যস্ত (Busy)' : '🟡 Busy', color: 'bg-amber-50 text-amber-800 border-amber-300' },
            { key: 'Offline', label: lang === 'bn' ? '⚫ অফলাইন (Offline)' : '⚫ Offline', color: 'bg-slate-50 text-slate-600 border-slate-300' }
          ].map((opt, _idx) => (
            <button 
              key={`${opt.key}-${_idx}`}
              type="button"
              onClick={() => onUpdateStatus(opt.key as any)}
              className={`py-2 border rounded-xl text-[10px] font-black transition cursor-pointer text-center ${myAgentProfile.status === opt.key ? opt.color + ' ring-1 ring-offset-1 ring-emerald-500' : 'bg-white text-slate-500 border-slate-150'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live GPS Broadcast Switch & update coordinate button */}
      <div className="bg-white border border-slate-150 rounded-3xl p-4.5 shadow-3xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t.agentLiveLocTitle}</h3>
            <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed mt-0.5">{t.agentLiveLocDesc}</p>
          </div>
          <button 
            onClick={() => onToggleLiveLocation(!myAgentProfile.liveLocationEnabled)}
            className={`w-11 h-6 rounded-full p-1 transition cursor-pointer ${myAgentProfile.liveLocationEnabled ? 'bg-[#0D9488]' : 'bg-slate-200'}`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transition transform ${myAgentProfile.liveLocationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {myAgentProfile.liveLocationEnabled && (
          <button 
            type="button"
            onClick={onUpdateCoordinates}
            disabled={isUpdatingLoc}
            className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 disabled:bg-slate-50 text-sky-700 font-black rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
          >
            {isUpdatingLoc ? (
              <span className="w-4.5 h-4.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <MapPinned className="w-4 h-4 shrink-0" />
                <span>{t.updateLocationGPSBtn}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Profile update settings fields */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-150 rounded-3xl p-5 shadow-3xs space-y-4">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-500" />
          {t.profileUpdateTitle}
        </h3>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">এজেন্ট নাম</label>
            <input type="text" value={dashName} onChange={e => setDashName(e.target.value)} required className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">শহর</label>
              <input type="text" value={dashCity} onChange={e => setDashCity(e.target.value)} required className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium" />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">দেশ</label>
              <input type="text" value={dashCountry} onChange={e => setDashCountry(e.target.value)} required className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">মোবাইল নম্বর</label>
              <input type="tel" value={dashPhone} onChange={e => setDashPhone(e.target.value)} required className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800" />
            </div>
            <div>
              <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">হোয়াটসঅ্যাপ</label>
              <input type="tel" value={dashWhats} onChange={e => setDashWhats(e.target.value)} required className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800" />
            </div>
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-slate-500 uppercase mb-1">মেসেঞ্জার লিংক (ঐচ্ছিক)</label>
            <input type="url" value={dashMsg} onChange={e => setDashMsg(e.target.value)} placeholder="https://m.me/..." className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800" />
          </div>

          <div>
            <label className="block text-[9.5px] font-black text-teal-800 uppercase mb-1 flex items-center gap-1">
              <span>📍 দোকানের গুগল ম্যাপস লিংক বা জিপিএস কোঅর্ডিনেট (Google Maps URL)</span>
            </label>
            <input 
              type="text" 
              value={dashShopMapLink} 
              onChange={e => setDashShopMapLink(e.target.value)} 
              placeholder="https://maps.app.goo.gl/... বা 23.8103, 90.4125" 
              className="w-full px-3.5 py-2 bg-teal-50/50 border border-teal-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0D9488]" 
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl space-y-2.5">
            <p className="text-[9.5px] font-black text-indigo-750 uppercase tracking-wider">🏠 স্থায়ী ঠিকানা সেটিংসঃ</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[8px] text-slate-450 uppercase mb-0.5">গ্রাম/পোস্ট</label>
                <input type="text" value={dashPost} onChange={e => setDashPost(e.target.value)} className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-medium text-slate-800" />
              </div>
              <div>
                <label className="block text-[8px] text-slate-450 uppercase mb-0.5">থানা</label>
                <input type="text" value={dashThana} onChange={e => setDashThana(e.target.value)} className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-medium text-slate-800" />
              </div>
              <div>
                <label className="block text-[8px] text-slate-450 uppercase mb-0.5">জেলা</label>
                <input type="text" value={dashDist} onChange={e => setDashDist(e.target.value)} className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-medium text-slate-800" />
              </div>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSavingAgentProfile} 
          className="w-full py-3 bg-[#0D9488] hover:bg-[#0B7A70] disabled:bg-slate-300 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/15"
        >
          {isSavingAgentProfile ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>{t.saveProfileBtn}</span>
          )}
        </button>
      </form>
    </div>
  );
}
