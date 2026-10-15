import re

# 1. Update src/lib/config.ts
with open('src/lib/config.ts', 'r') as f:
    config_code = f.read()

# Add stripHeavyConfigFields helper
strip_helper = """
export function stripHeavyConfigFields(configObj: any): any {
  if (!configObj || typeof configObj !== 'object') return configObj;
  const { customGridIcons, sectionIcons, mandatoryNoticeResponses, ...clean } = configObj;
  return clean;
}
"""

if 'export function stripHeavyConfigFields' not in config_code:
    config_code = strip_helper + '\n' + config_code

# Replace loadAppConfig
old_load_app_config = """export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const iconsRef = doc(db, 'system_settings', 'section_icons');

    const [docSnap, iconsSnap] = await Promise.all([
      getDoc(configRef),
      getDoc(iconsRef).catch(() => null)
    ]);

    let data: any = {};
    if (docSnap.exists()) {
      data = docSnap.data() as any;
    }

    let iconsData: Record<string, string> = {};
    if (iconsSnap && iconsSnap.exists()) {
      iconsData = (iconsSnap.data() as Record<string, string>) || {};
    }

    // Migration / fallback: if legacy app_config still has sectionIcons, merge and clean it
    if (data.sectionIcons && typeof data.sectionIcons === 'object') {
      iconsData = { ...data.sectionIcons, ...iconsData };
      try {
        await updateDoc(configRef, { sectionIcons: deleteField() });
      } catch (e) {}
      delete data.sectionIcons;
    }

    if (!iconsData.samity) {
      iconsData.samity = "/samity_logo.svg";
    }
    data.sectionIcons = { ...(data.sectionIcons || {}), ...iconsData };
    data.customGridIcons = { ...(data.customGridIcons || {}), ...data.sectionIcons };"""

new_load_app_config = """export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const mainConfigRef = doc(db, 'app_config', 'main');
    const iconsRef = doc(db, 'system_settings', 'section_icons');
    const responsesRef = doc(db, 'system_settings', 'notice_responses');

    const [docSnap, mainSnap, iconsSnap] = await Promise.all([
      getDoc(configRef).catch(() => null),
      getDoc(mainConfigRef).catch(() => null),
      getDoc(iconsRef).catch(() => null)
    ]);

    let data: any = {};
    if (docSnap && docSnap.exists()) {
      data = docSnap.data() as any;
    } else if (mainSnap && mainSnap.exists()) {
      data = mainSnap.data() as any;
    }

    let iconsData: Record<string, string> = {};
    if (iconsSnap && iconsSnap.exists()) {
      iconsData = (iconsSnap.data() as Record<string, string>) || {};
    }

    // Migration: If legacy oversized customGridIcons/sectionIcons/mandatoryNoticeResponses exist in app_config, move & delete to keep document < 20 KB
    const legacyIcons = { ...(data.customGridIcons || {}), ...(data.sectionIcons || {}) };
    const legacyResponses = data.mandatoryNoticeResponses;

    if (Object.keys(legacyIcons).length > 0 || legacyResponses) {
      console.log("[Config Migration] Migrating heavy fields out of app_config to shrink document size below 1MB limit...");
      
      if (Object.keys(legacyIcons).length > 0) {
        iconsData = { ...legacyIcons, ...iconsData };
        await setDoc(iconsRef, iconsData, { merge: true }).catch(() => null);
      }

      if (legacyResponses) {
        await setDoc(responsesRef, legacyResponses, { merge: true }).catch(() => null);
      }

      const cleanupPayload = {
        customGridIcons: deleteField(),
        sectionIcons: deleteField(),
        mandatoryNoticeResponses: deleteField()
      };

      if (docSnap && docSnap.exists()) {
        await updateDoc(configRef, cleanupPayload).catch(() => null);
      }
      if (mainSnap && mainSnap.exists()) {
        await updateDoc(mainConfigRef, cleanupPayload).catch(() => null);
      }

      delete data.customGridIcons;
      delete data.sectionIcons;
      delete data.mandatoryNoticeResponses;
    }

    if (!iconsData.samity) {
      iconsData.samity = "/samity_logo.svg";
    }
    data.sectionIcons = iconsData;
    data.customGridIcons = iconsData;"""

if old_load_app_config in config_code:
    config_code = config_code.replace(old_load_app_config, new_load_app_config)

# Replace saveAppConfig
old_save_app_config = """export async function saveAppConfig(newConfig: AppConfig): Promise<void> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const sanitized = sanitizeConfig(newConfig);
    // Exclude sectionIcons from app_config to prevent hitting the 1MB Firestore document limit
    const { sectionIcons, ...configWithoutIcons } = sanitized;
    await setDoc(configRef, configWithoutIcons, { merge: true });

    // Persist sectionIcons to dedicated system_settings/section_icons document if provided
    if (sectionIcons && typeof sectionIcons === 'object' && Object.keys(sectionIcons).length > 0) {
      const iconsRef = doc(db, 'system_settings', 'section_icons');
      await setDoc(iconsRef, sectionIcons, { merge: true });
    }

    try {
      localStorage.setItem('amb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...sanitized }));
    } catch (e) {}
  } catch (err) {
    console.error("Failed to save DB config:", err);
    throw err;
  }
}"""

new_save_app_config = """export async function saveAppConfig(newConfig: AppConfig): Promise<void> {
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    const mainConfigRef = doc(db, 'app_config', 'main');
    const iconsRef = doc(db, 'system_settings', 'section_icons');
    
    const sanitized = sanitizeConfig(newConfig);
    
    // Save heavy icon maps to dedicated system_settings/section_icons document
    const iconsData = { ...(sanitized.sectionIcons || {}), ...(sanitized.customGridIcons || {}) };
    if (Object.keys(iconsData).length > 0) {
      await setDoc(iconsRef, iconsData, { merge: true }).catch(() => null);
    }

    // Strip heavy fields before writing to app_config to guarantee document size stays < 20 KB
    const lightConfig = stripHeavyConfigFields(sanitized);

    await Promise.all([
      setDoc(configRef, lightConfig, { merge: true }),
      setDoc(mainConfigRef, lightConfig, { merge: true }).catch(() => null)
    ]);

    try {
      localStorage.setItem('amb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...sanitized }));
    } catch (e) {}
  } catch (err) {
    console.error("Failed to save DB config:", err);
    throw err;
  }
}"""

if old_save_app_config in config_code:
    config_code = config_code.replace(old_save_app_config, new_save_app_config)

with open('src/lib/config.ts', 'w') as f:
    f.write(config_code)

print('Updated src/lib/config.ts successfully!')


# 2. Update AdminBankSection.tsx
with open('src/components/admin/AdminBankSection.tsx', 'r') as f:
    admin_code = f.read()

old_admin_save = """  const handleSaveGridCustomizations = async () => {
    setSavingGridConfig(true);
    try {
      const updatedConfig = {
        ...appConfig,
        customGridIcons: gridIconsMap,
        sectionIcons: {
          ...(appConfig.sectionIcons || {}),
          ...gridIconsMap
        },
        globalTexts: {
          ...appConfig.globalTexts,
          ...gridTitlesMap
        }
      };

      // Save to all Firestore config collections simultaneously
      await setDoc(doc(db, 'system_settings', 'app_config'), updatedConfig, { merge: true });
      await setDoc(doc(db, 'system_settings', 'section_icons'), gridIconsMap, { merge: true });
      await setDoc(doc(db, 'app_config', 'main'), updatedConfig, { merge: true });

      // Update local storage
      try {
        localStorage.setItem('amb_app_config', JSON.stringify(updatedConfig));
      } catch (e) {}

      if (onChangeConfig) onChangeConfig(updatedConfig);

      alert('ড্যাশবোর্ডের ১২টি সার্ভিস আইকন ও টাইটেল সফলভাবে ইউজার ড্যাশবোর্ডে লাইভ সেভ হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('আইকন ও টাইটেল সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSavingGridConfig(false);
    }
  };"""

new_admin_save = """  const handleSaveGridCustomizations = async () => {
    setSavingGridConfig(true);
    try {
      const updatedConfig = {
        ...appConfig,
        customGridIcons: gridIconsMap,
        sectionIcons: {
          ...(appConfig.sectionIcons || {}),
          ...gridIconsMap
        },
        globalTexts: {
          ...appConfig.globalTexts,
          ...gridTitlesMap
        }
      };

      // Use saveAppConfig helper to automatically split heavy fields and keep app_config < 20 KB
      await saveAppConfig(updatedConfig);

      if (onChangeConfig) onChangeConfig(updatedConfig);

      alert('ড্যাশবোর্ডের ১২টি সার্ভিস আইকন ও টাইটেল সফলভাবে ইউজার ড্যাশবোর্ডে লাইভ সেভ হয়েছে!');
    } catch (err: any) {
      console.error(err);
      alert('আইকন ও টাইটেল সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSavingGridConfig(false);
    }
  };"""

if old_admin_save in admin_code:
    admin_code = admin_code.replace(old_admin_save, new_admin_save)

with open('src/components/admin/AdminBankSection.tsx', 'w') as f:
    f.write(admin_code)

print('Updated AdminBankSection.tsx successfully!')

