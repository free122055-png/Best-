import re

with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

def fix_line(num, original, replacement):
    idx = num - 1
    if original in lines[idx]:
        lines[idx] = lines[idx].replace(original, replacement)
    else:
        print(f"Failed to find '{original}' in line {num}: {lines[idx]}")

fix_line(542, '    Fire background sync with out keeping UI blocked', '    // Fire background sync with out keeping UI blocked')
fix_line(621, '       Sync background', '       // Sync background')
fix_line(760, '        Format the time for visual display e.g. 14:30', '        // Format the time for visual display e.g. 14:30')
fix_line(809, '      No pin provided', '      // No pin provided')
fix_line(825, '          Real saving logic here', '          // Real saving logic here')
fix_line(846, '          Generate QR data', '          // Generate QR data')
fix_line(876, '      Fallback for layout testing', '      // Fallback for layout testing')
fix_line(891, '      Fallback async loading', '      // Fallback async loading')
fix_line(952, '       Wait a bit', '       // Wait a bit')
fix_line(1017, '          Fallback successful', '          // Fallback successful')
fix_line(1027, '          Record the initial transaction logic in transactions collection', '          // Record the initial transaction logic in transactions collection')
fix_line(1053, '       Check if this card belongs to me', '       // Check if this card belongs to me')
fix_line(1179, '      Find require amount including 5tk charge', '      // Find require amount including 5tk charge')
fix_line(1268, '              Optimistically update', '              // Optimistically update')
fix_line(1332, '      Set payment date as YYYY-MM-DD', '      // Set payment date as YYYY-MM-DD')
fix_line(1435, '      user.balance = finalBal;  Optimistic balance update ⚡', '      user.balance = finalBal; // Optimistic balance update ⚡')
fix_line(1436, '      user.balance = finalBal;  Optimistic balance update ⚡', '      user.balance = finalBal; // Optimistic balance update ⚡')
fix_line(1679, '    { id: \'desko_prepaid\', name: \'DESKO Prepaid\', label: \'ডেসকো (প্রিপেইড)\', enLabel: \'DESKO (Prepaid)\', category: \'electricity\', iconColor: \'bg-orange-100 text-orange-600\' },', '    { id: \'desko_prepaid\', name: \'DESKO Prepaid\', label: \'ডেসকো (প্রিপেইড)\', enLabel: \'DESKO (Prepaid)\', category: \'electricity\', iconColor: \'bg-orange-100 text-orange-600\' },')
fix_line(1691, '    { id: \'karnaphuli_gas\', name: \'Karnaphuli Gas\', label: \'কর্ণফুলী গ্যাস\', enLabel: \'Karnaphuli Gas\', category: \'gas\', iconColor: \'bg-rose-100 text-rose-600\' },', '    { id: \'karnaphuli_gas\', name: \'Karnaphuli Gas\', label: \'কর্ণফুলী গ্যাস\', enLabel: \'Karnaphuli Gas\', category: \'gas\', iconColor: \'bg-rose-100 text-rose-600\' },')
fix_line(1696, '    { id: \'chittagong_wasa\', name: \'Chittagong WASA\', label: \'চট্টগ্রাম ওয়াসা পানি বিল\', enLabel: \'Chittagong WASA Water Bill\', category: \'water\', iconColor: \'bg-blue-100 text-blue-600\' },', '    { id: \'chittagong_wasa\', name: \'Chittagong WASA\', label: \'চট্টগ্রাম ওয়াসা পানি বিল\', enLabel: \'Chittagong WASA Water Bill\', category: \'water\', iconColor: \'bg-blue-100 text-blue-600\' },')
fix_line(1700, '    { id: \'carnival\', name: \'Carnival\', label: \'কার্নিভাল ইন্টারনেট\', enLabel: \'Carnival Internet\', category: \'internet\', iconColor: \'bg-purple-100 text-purple-600\' },', '    { id: \'carnival\', name: \'Carnival\', label: \'কার্নিভাল ইন্টারনেট\', enLabel: \'Carnival Internet\', category: \'internet\', iconColor: \'bg-purple-100 text-purple-600\' },')
fix_line(1708, '    { id: \'desko_postpaid\', name: \'DESKO Postpaid\', label: \'ডেসকো (পোস্টপেইড)\', enLabel: \'DESKO (Postpaid)\', category: \'electricity\', iconColor: \'bg-orange-100 text-orange-600\' },', '    { id: \'desko_postpaid\', name: \'DESKO Postpaid\', label: \'ডেসকো (পোস্টপেইড)\', enLabel: \'DESKO (Postpaid)\', category: \'electricity\', iconColor: \'bg-orange-100 text-orange-600\' },')
fix_line(3761, '           FOREIGN BANK CHANNEL', '           // FOREIGN BANK CHANNEL')
fix_line(4204, '     Categories matching the visual layout of the reference image with rich details', '     // Categories matching the visual layout of the reference image with rich details')

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.writelines(lines)
