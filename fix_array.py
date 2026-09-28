with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

def fix_arr(num, bad, good):
    lines[num-1] = lines[num-1].replace(bad, good)

fix_arr(1677, '     Electricity', '     // Electricity')
fix_arr(1678, '// { id: \'palli_bidyut_prepaid\'', '    { id: \'palli_bidyut_prepaid\'')

fix_arr(1689, '     Gas', '     // Gas')
fix_arr(1690, '// { id: \'titas\'', '    { id: \'titas\'')

fix_arr(1694, '     Water', '     // Water')
fix_arr(1695, '// { id: \'dhaka_wasa\'', '    { id: \'dhaka_wasa\'')

fix_arr(1698, '     Internet', '     // Internet')
fix_arr(1699, '// { id: \'link3\'', '    { id: \'link3\'')

# Also fix the remaining syntax errors: 3884 and 4205
# Let's see what is on 3884.
