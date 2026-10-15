with open('src/components/AdminPanel.tsx', 'r') as f:
    code = f.read()

# Add saveAppConfig import
if 'saveAppConfig' not in code:
    code = code.replace(
        "import { apiUrl } from '../config/api';",
        "import { apiUrl } from '../config/api';\nimport { saveAppConfig, stripHeavyConfigFields } from '../lib/config';"
    )

# Replace setDoc(configRef, updatedConfig, ...) in handleSaveGlobalSettings
old_save = """      const configRef = doc(db, 'system_settings', 'app_config');
      await setDoc(configRef, updatedConfig, { merge: true });
      onChangeConfig(updatedConfig);"""

new_save = """      await saveAppConfig(updatedConfig);
      onChangeConfig(updatedConfig);"""

if old_save in code:
    code = code.replace(old_save, new_save)
    print("Replaced handleSaveGlobalSettings setDoc with saveAppConfig!")

with open('src/components/AdminPanel.tsx', 'w') as f:
    f.write(code)

print("Updated AdminPanel.tsx successfully!")
