import re

with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

def fix(idx, s, rep):
    lines[idx] = lines[idx].replace(s, rep)

fix(1484, 'user.balance = finalBal;  Optimistic balance update ⚡', 'user.balance = finalBal; // Optimistic balance update ⚡')
fix(1531, 'user.balance = finalBal;  Optimistic balance update ⚡', 'user.balance = finalBal; // Optimistic balance update ⚡')
fix(1577, '     Instant zero-delay response ⚡', '     // Instant zero-delay response ⚡')
fix(1637, '     Instant zero-delay response ⚡', '     // Instant zero-delay response ⚡')
fix(1675, '   Bill Providers static data list', '   // Bill Providers static data list')
fix(1703, '     Cable TV', '     // Cable TV')
fix(1884, '     Generate fallback card details in case states aren\'t saved yet', '     // Generate fallback card details in case states aren\'t saved yet')
fix(1921, '     Instant OTP read from user document OR fallback to portalNotifications', '     // Instant OTP read from user document OR fallback to portalNotifications')
fix(3720, '           FOREIGN BANK CHANNEL', '           // FOREIGN BANK CHANNEL')
fix(4210, '     Categories matching the visual layout of the reference image with rich details', '     // Categories matching the visual layout of the reference image with rich details')
fix(4280, '     Selected Category Object if on category sub-page', '     // Selected Category Object if on category sub-page')
fix(4283, '     Global search matching providers across all categories if user types in search box on home page', '     // Global search matching providers across all categories if user types in search box on home page')
fix(4292, '     Filtered providers for the active category sub-page', '     // Filtered providers for the active category sub-page')
fix(4785, '             Calculate running/post balance for each transaction', '             // Calculate running/post balance for each transaction')
fix(4786, '            let running = user.balance || 0;', '            let running = user.balance || 0; //')
fix(4809, '             Group by date', '             // Group by date')

# Fix the duplicate renderAddMoney
# line 4959: {activeTab === 'add_money' {activeTab === 'add_money' && renderAddMoney()}{activeTab === 'add_money' && renderAddMoney()} renderAddMoney()}
lines[4959] = "        {activeTab === 'add_money' && renderAddMoney()}\n"
# line 4960: {activeTab === 'auto_add_money' {activeTab === 'add_money' && renderAddMoney()}{activeTab === 'add_money' && renderAddMoney()} renderAutoAddMoney()}
lines[4960] = "        {activeTab === 'auto_add_money' && renderAutoAddMoney()}\n"

# Check if last line is };
if lines[-1].strip() == '};':
    pass # ok
else:
    # 5195 is the last line maybe?
    pass

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.writelines(lines)
