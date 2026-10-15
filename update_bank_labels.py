import re

# 1. Update BNBMobileBankingPortal.tsx
with open('src/components/BNBMobileBankingPortal.tsx', 'r') as f:
    portal_code = f.read()

portal_code = portal_code.replace("BNB সমবায় ব্যাংক লিঃ", "MY BNB লেনদেন ও ফান্ড")
portal_code = portal_code.replace("BNB CO-OPERATIVE BANK", "MY BNB CO-OPERATIVE FUND")
portal_code = portal_code.replace("বিএনবি সমবায় ব্যাংক লিমিটেড", "মাই বিএনবি সমবায় লেনদেন ফান্ড")
portal_code = portal_code.replace("<h1 className=\"text-xs font-black text-white leading-none\">BNB সমবায় ব্যাংক</h1>", "<h1 className=\"text-xs font-black text-white leading-none\">MY BNB লেনদেন</h1>")
portal_code = portal_code.replace("<p className=\"text-[8px] text-white/60 leading-none mt-0.5\">মোবাইল ব্যাংকিং</p>", "<p className=\"text-[8px] text-white/60 leading-none mt-0.5\">মোবাইল ওয়ালেট ও ফান্ড</p>")
portal_code = portal_code.replace("মোবাইল ব্যাংকিং", "মোবাইল ওয়ালেট ও লেনদেন")
portal_code = portal_code.replace("ব্যাংকিং কিউআর কোড", "লেনদেন কিউআর কোড")

with open('src/components/BNBMobileBankingPortal.tsx', 'w') as f:
    f.write(portal_code)

print('Updated BNBMobileBankingPortal.tsx successfully!')

# 2. Update config.ts
with open('src/lib/config.ts', 'r') as f:
    config_code = f.read()

config_code = config_code.replace("সমবায় ডিজিটাল ব্যাংকিং নেটওয়ার্ক", "সমবায় ডিজিটাল লেনদেন নেটওয়ার্ক")
config_code = config_code.replace("cardBankTitle === \"BNB ব্যাংক\"", "cardBankTitle === \"MY BNB লেনদেন\"")

with open('src/lib/config.ts', 'w') as f:
    f.write(config_code)

print('Updated config.ts successfully!')

# 3. Update SafeDealsEscrowView.tsx
with open('src/components/SafeDealsEscrowView.tsx', 'r') as f:
    escrow_code = f.read()

escrow_code = escrow_code.replace("নিরাপদ বাতায়ন ও সমবায় ব্যাংকিং", "নিরাপদ বাতায়ন ও সমবায় লেনদেন")

with open('src/components/SafeDealsEscrowView.tsx', 'w') as f:
    f.write(escrow_code)

print('Updated SafeDealsEscrowView.tsx successfully!')

