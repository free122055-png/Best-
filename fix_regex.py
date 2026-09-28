import re

with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    content = f.read()

fixes = [
    ("      Fire background sync without keeping UI blocked", "      // Fire background sync without keeping UI blocked"),
    ("        Fast query memberId, phone, or virtual phone/memberId in parallel", "        // Fast query memberId, phone, or virtual phone/memberId in parallel"),
    ("        Update local memory and UI state after transaction succeeds 100%", "        // Update local memory and UI state after transaction succeeds 100%"),
    ("      Fast pre-validation before loading state", "      // Fast pre-validation before loading state"),
    ("          OTP already verified! Process transaction instantly ⚡", "          // OTP already verified! Process transaction instantly ⚡"),
    ("          Instant optimistic update ⚡", "          // Instant optimistic update ⚡"),
    ("          Reset form immediately", "          // Reset form immediately"),
    ("          Async non-blocking database persistence", "          // Async non-blocking database persistence"),
    ("        Step 1: Find Card Owner", "        // Step 1: Find Card Owner"),
    ("          Generate OTP & send instantly ⚡", "          // Generate OTP & send instantly ⚡"),
    ("          Instant background update to Card Owner user document", "          // Instant background update to Card Owner user document"),
    ("        If OTP lock is OFF, process payment directly", "        // If OTP lock is OFF, process payment directly"),
    ("      Calculate total required including charges", "      // Calculate total required including charges"),
    ("              Deposit directly into receiver's Samity", "              // Deposit directly into receiver's Samity"),
    ("              Standard wallet send money", "              // Standard wallet send money"),
    ("{activeTab === 'add_money' {activeTab === 'add_money' && renderAddMoney()}{activeTab === 'add_money' && renderAddMoney()} renderAddMoney()}", "{activeTab === 'add_money' && renderAddMoney()}"),
    ("{activeTab === 'auto_add_money' {activeTab === 'add_money' && renderAddMoney()}{activeTab === 'add_money' && renderAddMoney()} renderAutoAddMoney()}", "{activeTab === 'auto_add_money' && renderAutoAddMoney()}")
]

for old, new in fixes:
    content = content.replace(old, new)

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.write(content)
