with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if '// { id:' in lines[i]:
        lines[i] = lines[i].replace('// { id:', '    { id:')
    if '           MOBILE BANK CHANNEL' in lines[i]:
        lines[i] = lines[i].replace('           MOBILE BANK CHANNEL', '')
    if '// )}' in lines[i]:
        lines[i] = lines[i].replace('// )}', ')}')

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.writelines(lines)
