with open('src/lib/config.ts', 'r') as f:
    code = f.read()

# Make loadAppConfig robust against oversized app_config documents without throwing
old_migration_block = """    // Migration: If legacy oversized customGridIcons/sectionIcons/mandatoryNoticeResponses exist in app_config, move & delete to keep document < 20 KB
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
    }"""

new_migration_block = """    // Migration: Safely strip heavy fields from local data object to prevent writing oversized payload back to Firestore
    delete data.customGridIcons;
    delete data.sectionIcons;
    delete data.mandatoryNoticeResponses;"""

if old_migration_block in code:
    code = code.replace(old_migration_block, new_migration_block)
    with open('src/lib/config.ts', 'w') as f:
        f.write(code)
    print("Successfully patched loadAppConfig migration block in config.ts!")
else:
    print("Could not find old_migration_block exactly.")
