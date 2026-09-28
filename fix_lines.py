with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

lines[3884-1] = lines[3884-1].replace('           MOBILE BANK CHANNEL', '{/* MOBILE BANK CHANNEL */}')
lines[4205-1] = lines[4205-1].replace('     // Categories matching the visual layout of the reference image with rich details', '{/* Categories matching the visual layout of the reference image with rich details */}')

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.writelines(lines)
