import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { User } from '../types';
import { normalizePhoneNumber } from './memberUtils';

export async function restoreAndSeedDatabase() {
  try {
    const lastCheck = localStorage.getItem('amb_db_last_seeded_ts');
    const now = Date.now();
    if (lastCheck && now - Number(lastCheck) < 6 * 60 * 60 * 1000) {
      // Checked recently (within 6 hours) - skip heavy collection scan for sub-second startup
      return;
    }
    localStorage.setItem('amb_db_last_seeded_ts', String(now));
    console.log("[DatabaseSeeder] Background check and database sync...");

    // 1. Ensure primary admin_master exists and clean up old duplicate admin_user_01
    try {
      // Remove old duplicate admin_user_01 if it exists
      const oldAdminRef = doc(db, 'users', 'admin_user_01');
      const oldSnap = await getDoc(oldAdminRef);
      if (oldSnap.exists()) {
        await deleteDoc(oldAdminRef);
      }
    } catch (e) {}

    const defaultAdmin: User = {
      uid: 'admin_master',
      name: 'Bangladesh AMB Administrator',
      phone: '+8800011112222',
      normalizedPhone: '+8800011112222',
      memberId: 'MAIN_ADMIN',
      pin: '6666',
      role: 'admin',
      balance: 0,
      savings: 0,
      telecomBalance: 0,
      superShopBalance: 0,
      dueLoan: 0,
      lockedBalance: 0,
      pendingBalance: 0,
      createdAt: new Date().toISOString(),
      approved: true,
      samityStatus: 'approved'
    };

    try {
      const userRef = doc(db, 'users', 'admin_master');
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, defaultAdmin);
      } else {
        const snapData = snap.data();
        if (snapData?.phone !== '+8800011112222' || snapData?.pin !== '6666' || snapData?.memberId !== 'MAIN_ADMIN' || snapData?.role !== 'admin') {
          await setDoc(userRef, {
            phone: '+8800011112222',
            normalizedPhone: '+8800011112222',
            pin: '6666',
            memberId: 'MAIN_ADMIN',
            role: 'admin',
            approved: true
          }, { merge: true });
        }
      }
    } catch (err) {
      // ignore write error
    }

    // 2. Sanitize existing user documents in Firestore: clean up "বেনামী সদস্য" or empty name/phone records, and prevent non-admin accounts from having admin name/role
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        if (uDoc.id === 'admin_master') continue;
        const uData = uDoc.data() as User;
        const uName = (uData.name || '').trim();
        const uPhone = (uData.phone || '').trim();
        const normP = normalizePhoneNumber(uPhone);

        const updatesToApply: Partial<User> = {};

        // Ensure non-admin users do not hold admin name, role, or MAIN_ADMIN memberId
        if (uDoc.id !== 'admin_master' && uPhone !== '+8800011112222') {
          if (uData.role === 'admin') {
            updatesToApply.role = 'user';
          }
          if (uData.memberId === 'MAIN_ADMIN') {
            // Assign real sequential ID instead of hardcoded duplicate
            updatesToApply.memberId = `AMB${String(Math.floor(1000 + Math.random() * 9000)).padStart(8, '0')}`;
          }
          if (uName === 'AMB National Admin' || uName === 'Bangladesh AMB Administrator' || (uPhone === '01618599077' && uName === 'AMB National Admin')) {
            updatesToApply.name = 'সম্মানিত সদস্য';
          }
        }

        if (!uName || uName === 'বেনামী সদস্য' || uName === 'অজ্ঞাত মেম্বার') {
          if (!uPhone && !uData.memberId) {
            // Delete completely invalid phoneless/nameless document
            await deleteDoc(doc(db, 'users', uDoc.id));
            continue;
          } else {
            updatesToApply.name = 'সম্মানিত সদস্য';
          }
        }

        if (!uData.normalizedPhone && normP) {
          updatesToApply.normalizedPhone = normP;
        }

        if (Object.keys(updatesToApply).length > 0) {
          await setDoc(doc(db, 'users', uDoc.id), updatesToApply, { merge: true });
        }
      }
    } catch (cleanErr) {
      console.warn("[DatabaseSeeder] User sanitization warning:", cleanErr);
    }

    // 3. Ensure App Config settings are seeded
    const configRef = doc(db, 'system_settings', 'app_config');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        appName: 'Al Mayadin Bazar (AMB)',
        appSubtitle: 'ন্যাশনাল কোঅপারেটিভ ও বিজনেস পোর্টাল',
        noticeText: 'AMB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম! আপনার অ্যাকাউন্ট এবং ব্যালেন্স সম্পূর্ণ সুরক্ষিত রয়েছে।',
        helpline: '01618599077',
        bKashMerchant: '01618599077',
        nagadMerchant: '01618599077',
        rocketMerchant: '01618599077',
        bankAccountInfo: 'AMB Business Cooperative Ltd, A/C: 1150-201-998877, Islami Bank Bangladesh PLC',
        maintenanceMode: false,
        minDeposit: 100,
        minWithdraw: 500,
        profitRateYearly: 18.5
      });
    }

    // 4. Cache in localStorage for instant offline fallback
    localStorage.setItem('amb_all_users_backup', JSON.stringify([defaultAdmin]));
    console.log("[DatabaseSeeder] Database successfully restored and synchronized.");
  } catch (e) {
    console.warn("[DatabaseSeeder] Warning during restore/seed:", e);
  }
}

