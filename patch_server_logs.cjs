const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

const regex = /const txResult = await runTransaction\(db, async \(t\) => \{[\s\S]*?\}\);/g;

const match = server.match(regex);
if (match) {
    let replaced = match[0].replace(
        'const currentBalance = Number(userData.balance) || 0;',
        `const currentBalance = Number(userData.balance) || 0;
          console.log("--> [TRACE] Fetched User Doc:", userDocRef.path);
          console.log("--> [TRACE] Existing balance:", currentBalance);
          console.log("--> [TRACE] Existing mainBalance:", currentMainBalance);`
    ).replace(
        'const newBalance = currentBalance + depositAmount;',
        `const newBalance = currentBalance + depositAmount;
          console.log("--> [TRACE] Calculated newBalance:", newBalance);
          console.log("--> [TRACE] Calculated newMainBalance:", newMainBalance);`
    ).replace(
        't.update(userDocRef, {',
        `console.log("--> [TRACE] Calling t.update on User Doc with new values...");
          t.update(userDocRef, {`
    ).replace(
        't.set(txDocRef, {',
        `console.log("--> [TRACE] Calling t.set on txDocRef: " + txDocRef.path);
          t.set(txDocRef, {`
    ).replace(
        't.set(notifRef, {',
        `console.log("--> [TRACE] Calling t.set on notifRef: " + notifRef.path);
          t.set(notifRef, {`
    ).replace(
        'return { alreadyProcessed: false, newBalance };',
        `console.log("--> [TRACE] Transaction function completed. Returning data.");
          return { alreadyProcessed: false, newBalance };`
    ).replace(
        'const txSnap = await t.get(txDocRef);',
        `console.log("--> [TRACE] Inside runTransaction. Checking idempotency for:", txDocRef.path);
          const txSnap = await t.get(txDocRef);`
    ).replace(
        'return { alreadyProcessed: true }; // Escape transaction safely',
        `console.log("--> [TRACE] ALREADY PROCESSED! txSnap exists:", txSnap.id);
            return { alreadyProcessed: true }; // Escape transaction safely`
    ).replace(
        `const userDoc = await t.get(userDocRef);`,
        `console.log("--> [TRACE] Fetching user doc:", userDocRef.path);
          const userDoc = await t.get(userDocRef);`
    );

    server = server.replace(regex, replaced);

    // Also add top-level trace logs before the transaction
    const beforeRegex = /const userDocRef = doc\(db, 'users', userId\);/g;
    server = server.replace(beforeRegex, `console.log("--> [TRACE] Starting Verification Flow. UserID:", userId, "Amount:", amount, "Parsed DepositAmount:", depositAmount);
      const userDocRef = doc(db, 'users', userId);`);

    const commitSuccessRegex = /if \(txResult\.alreadyProcessed\) \{/g;
    server = server.replace(commitSuccessRegex, `console.log("--> [TRACE] runTransaction COMMITTED SUCCESSFULLY");
        if (txResult.alreadyProcessed) {`);

    fs.writeFileSync('server.ts', server);
    console.log("Patched server.ts with logging!");
} else {
    console.log("Could not find the runTransaction block in server.ts");
}
