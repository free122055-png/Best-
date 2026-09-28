with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                      const isResetRequestedUser = (u: any) => Boolean(
                        u.appLockResetRequested === true ||
                        u.appLockResetStatus === 'pending' ||
                        u.forgotPinRequested === true ||
                        u.pinResetRequested === true ||
                        (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
                      );"""

replacement = """                      const isResetRequestedUser = (u: any) => Boolean(
                        u.appLockResetRequested === true ||
                        u.appLockResetStatus === 'pending' ||
                        u.forgotPinRequested === true ||
                        u.pinResetRequested === true ||
                        (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
                      );

                      const totalSwitchOffRefundAmount = users
                        .filter(isSwitchOffUser)
                        .reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);"""

if target in text:
    text = text.replace(target, replacement, 1)
    with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed totalSwitchOffRefundAmount definition in list scope!")
else:
    print("Could not find target string!")
