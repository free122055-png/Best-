import React, { useState, useEffect } from 'react';
import { ensureAuth, db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, AppConfig } from './types';
import { loadAppConfig, DEFAULT_CONFIG } from './lib/config';
import AdminPanel from './components/AdminPanel';
import { Shield, Lock, Phone, Key, AlertCircle, RefreshCw } from 'lucide-react';

export default function AdminApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('amb_admin_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [darkMode, setDarkMode] = useState(true);
  const [appLanguage, setAppLanguage] = useState('bn');

  useEffect(() => {
    loadAppConfig().then(cfg => {
      if (cfg) setAppConfig({ ...DEFAULT_CONFIG, ...cfg });
    }).catch(err => console.warn("Failed to load app config in AdminApp:", err));
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || !pin) {
      setError('দয়া করে এডমিন মোবাইল নম্বর এবং পিন কোড দিন।');
      return;
    }

    setLoading(true);
    try {
      await ensureAuth();
      // Master admin fallback check or query user in Firestore
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Check if master admin credentials
      if ((cleanPhone === '01711000000' || cleanPhone === '01800000000' || cleanPhone === '01900000000' || cleanPhone.includes('admin')) && pin === '1234') {
        const adminUser: User = {
          uid: 'admin_master_100',
          name: 'BNB National Admin',
          phone: cleanPhone,
          memberId: 'BNB00000001',
          role: 'admin',
          balance: 999999999,
          mainBalance: 999999999,
          savings: 50000,
          status: 'active',
          pin: pin,
          dueLoan: 0,
          createdAt: new Date().toISOString()
        };
        setCurrentUser(adminUser);
        localStorage.setItem('amb_admin_user', JSON.stringify(adminUser));
        localStorage.setItem('amb_user_uid', adminUser.uid);
        localStorage.setItem('amb_admin_mode', 'true');
        setLoading(false);
        return;
      }

      // Query firestore for user with this phone
      const usersRef = collection(db, 'users');
      // For simplicity in client query
      const q = query(usersRef, where('phone', '==', cleanPhone), limit(1));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userData = snap.docs[0].data() as User;
        const userUid = snap.docs[0].id;
        if (userData.role !== 'admin' && userData.role !== 'sub_admin') {
          setError('এই নম্বরে কোনো এডমিন অ্যাকাউন্ট রেজিস্টার্ড নেই। এটি সাধারণ সদস্য অ্যাকাউন্ট।');
          setLoading(false);
          return;
        }
        if (userData.pin && String(userData.pin) !== String(pin)) {
          setError('ভুল পিন কোড দেওয়া হয়েছে। দয়া করে সঠিক পিন দিন।');
          setLoading(false);
          return;
        }

        const fullAdminUser: User = { ...userData, uid: userUid, role: 'admin' };
        setCurrentUser(fullAdminUser);
        localStorage.setItem('amb_admin_user', JSON.stringify(fullAdminUser));
        localStorage.setItem('amb_user_uid', userUid);
        localStorage.setItem('amb_admin_mode', 'true');
      } else {
        setError('এডমিন অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। অনুগ্রহ করে মাস্টার এডমিন নম্বর ব্যবহার করুন।');
      }
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError('লগইন ব্যর্থ হয়েছে: ' + (err.message || 'নেটওয়ার্ক সমস্যা'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('amb_admin_user');
    localStorage.removeItem('amb_admin_mode');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">BNB Admin Portal</h1>
            <p className="text-sm text-slate-400 mt-1">এক্সক্লুসিভ এডমিন ও ন্যাশনাল গেটওয়ে ম্যানেজমেন্ট সফটওয়্যার</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">এডমিন মোবাইল নম্বর</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="যেমন: 01711000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">সিক্রেট পিন কোড</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>যাচাই করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>এডমিন প্যানেলে প্রবেশ করুন</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              মাস্টার টেস্ট এক্সেস: <code className="text-emerald-400 font-mono">01711000000</code> / পিন: <code className="text-emerald-400 font-mono">1234</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminPanel
        currentUser={currentUser}
        onBack={handleLogout}
        appConfig={appConfig}
        onChangeConfig={(newConfig) => {
          setAppConfig(newConfig);
          localStorage.setItem('amb_app_config', JSON.stringify(newConfig));
        }}
        appLanguage={appLanguage}
        darkMode={darkMode}
      />
    </div>
  );
}

// Helper imports for firestore collection query in AdminApp
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
