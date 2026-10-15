import re

# 1. Update AdminBankSection.tsx
with open('src/components/admin/AdminBankSection.tsx', 'r') as f:
    admin_code = f.read()

old_save_grid = """  const handleSaveGridCustomizations = async () => {
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
  };"""

new_save_grid = """  const handleSaveGridCustomizations = async () => {
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

if old_save_grid in admin_code:
    admin_code = admin_code.replace(old_save_grid, new_save_grid)
    with open('src/components/admin/AdminBankSection.tsx', 'w') as f:
        f.write(admin_code)
    print('Updated handleSaveGridCustomizations in AdminBankSection.tsx!')
else:
    print('old_save_grid not matched exactly in AdminBankSection.tsx')


# 2. Update src/lib/config.ts
with open('src/lib/config.ts', 'r') as f:
    config_code = f.read()

old_load_config = """    if (!iconsData.samity) {
      iconsData.samity = "/samity_logo.svg";
    }
    data.sectionIcons = iconsData;"""

new_load_config = """    if (!iconsData.samity) {
      iconsData.samity = "/samity_logo.svg";
    }
    data.sectionIcons = { ...(data.sectionIcons || {}), ...iconsData };
    data.customGridIcons = { ...(data.customGridIcons || {}), ...data.sectionIcons };"""

if old_load_config in config_code:
    config_code = config_code.replace(old_load_config, new_load_config)
    with open('src/lib/config.ts', 'w') as f:
        f.write(config_code)
    print('Updated loadAppConfig in src/lib/config.ts!')
else:
    print('old_load_config not matched exactly in config.ts')


# 3. Update src/App.tsx real-time listeners
with open('src/App.tsx', 'r') as f:
    app_code = f.read()

old_app_snap = """        setAppConfig(prev => {
          const merged = {
            ...prev,
            ...data,
            // Keep sectionIcons from separate document or fallback to existing
            sectionIcons: { ...(prev.sectionIcons || {}), ...(data.sectionIcons || {}) }
          };"""

new_app_snap = """        setAppConfig(prev => {
          const merged = {
            ...prev,
            ...data,
            customGridIcons: { ...(prev.customGridIcons || {}), ...(data.customGridIcons || {}), ...(data.sectionIcons || {}) },
            sectionIcons: { ...(prev.sectionIcons || {}), ...(data.sectionIcons || {}), ...(data.customGridIcons || {}) }
          };"""

if old_app_snap in app_code:
    app_code = app_code.replace(old_app_snap, new_app_snap)

old_icons_snap = """        setAppConfig(prev => {
          const merged = {
            ...prev,
            sectionIcons: { ...(prev.sectionIcons || {}), ...iconsData }
          };"""

new_icons_snap = """        setAppConfig(prev => {
          const merged = {
            ...prev,
            customGridIcons: { ...(prev.customGridIcons || {}), ...iconsData },
            sectionIcons: { ...(prev.sectionIcons || {}), ...iconsData }
          };"""

if old_icons_snap in app_code:
    app_code = app_code.replace(old_icons_snap, new_icons_snap)

with open('src/App.tsx', 'w') as f:
    f.write(app_code)

print('Updated real-time appConfig listeners in src/App.tsx!')


# 4. Update Dashboard.tsx renderGridServiceIcon
with open('src/components/Dashboard.tsx', 'r') as f:
    dash_code = f.read()

old_render_icon = """  const renderGridServiceIcon = (key: string, DefaultIconComponent: React.ComponentType<{ className?: string }>) => {
    const customImg = appConfig?.customGridIcons?.[key];
    if (customImg) {
      return (
        <img 
          src={customImg} 
          alt="Service Icon" 
          className="w-11 h-11 sm:w-13 sm:h-13 object-contain rounded-xl transition-transform group-hover:scale-105 shadow-2xs" 
        />
      );
    }
    return <DefaultIconComponent className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />;
  };"""

new_render_icon = """  const renderGridServiceIcon = (key: string, DefaultIconComponent: React.ComponentType<{ className?: string }>) => {
    const customImg = appConfig?.customGridIcons?.[key] || appConfig?.sectionIcons?.[key];
    if (customImg && customImg !== '/samity_logo.svg') {
      return (
        <img 
          src={customImg} 
          alt="Service Icon" 
          className="w-11 h-11 sm:w-13 sm:h-13 object-contain rounded-xl transition-transform group-hover:scale-105 shadow-2xs" 
        />
      );
    }
    return <DefaultIconComponent className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />;
  };"""

if old_render_icon in dash_code:
    dash_code = dash_code.replace(old_render_icon, new_render_icon)
    with open('src/components/Dashboard.tsx', 'w') as f:
        f.write(dash_code)
    print('Updated renderGridServiceIcon in Dashboard.tsx!')

