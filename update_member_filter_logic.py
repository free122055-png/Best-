with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect where filtered is calculated
old_filter_code = """                      const filtered = users
                        .filter((u) => {
                          const isSubAdmin = isSubAdminUser(u);
                          const isInvestor = isInvestorUser(u);
                          const isSamity = isSamityMemberUser(u);
                          const isSwOff = isSwitchOffUser(u);
                          const isSwOn = isSwitchOnUser(u);

                          if (generalMemberFilterTab === 'switch_off' && !isSwOff) return false;
                          if (generalMemberFilterTab === 'switch_on' && !isSwOn) return false;
                          if (generalMemberFilterTab === 'sub_admin' && !isSubAdmin) return false;
                          if (generalMemberFilterTab === 'investor' && !isInvestor) return false;
                          if (generalMemberFilterTab === 'samity' && !isSamity) return false;
                          if (generalMemberFilterTab === 'general' && (isSamity || isInvestor || isSubAdmin || u.role === 'admin')) return false;"""

new_filter_code = """                      const isResetRequestedUser = (u: any) => Boolean(
                        u.appLockResetRequested === true ||
                        u.appLockResetStatus === 'pending' ||
                        u.forgotPinRequested === true ||
                        u.pinResetRequested === true ||
                        (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
                      );

                      const filtered = users
                        .filter((u) => {
                          const isSubAdmin = isSubAdminUser(u);
                          const isInvestor = isInvestorUser(u);
                          const isSamity = isSamityMemberUser(u);
                          const isSwOff = isSwitchOffUser(u);
                          const isSwOn = isSwitchOnUser(u);
                          const isResetReq = isResetRequestedUser(u);

                          if (generalMemberFilterTab === 'reset_requests' && !isResetReq) return false;
                          if (generalMemberFilterTab === 'switch_off' && !isSwOff) return false;
                          if (generalMemberFilterTab === 'switch_on' && !isSwOn) return false;
                          if (generalMemberFilterTab === 'sub_admin' && !isSubAdmin) return false;
                          if (generalMemberFilterTab === 'investor' && !isInvestor) return false;
                          if (generalMemberFilterTab === 'samity' && !isSamity) return false;
                          if (generalMemberFilterTab === 'general' && (isSamity || isInvestor || isSubAdmin || u.role === 'admin')) return false;"""

if old_filter_code in text:
    text = text.replace(old_filter_code, new_filter_code, 1)
    print("Updated member filtering logic successfully!")
else:
    print("Could not match old_filter_code, searching for snippet...")

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
