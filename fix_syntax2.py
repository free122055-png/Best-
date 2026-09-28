with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '     Electricity' in line:
        lines[i] = '    // Electricity\n'
    if '     Gas' in line:
        lines[i] = '    // Gas\n'
    if '     Water' in line:
        lines[i] = '    // Water\n'
    if '     Internet' in line:
        lines[i] = '    // Internet\n'
    if '     Cable TV' in line:
        lines[i] = '    // Cable TV\n'
    if '    { id: \'palli_bidyut_prepaid\'' in line and not line.strip().endswith(','):
        lines[i] = "    { id: 'palli_bidyut_prepaid', name: 'Palli Bidyut Prepaid', label: 'পল্লী বিদ্যুৎ (প্রিপেইড)', enLabel: 'Palli Bidyut (Prepaid)', category: 'electricity', iconColor: 'bg-pink-100 text-pink-600' },\n"
    if '    { id: \'titas\'' in line and not line.strip().endswith(','):
        lines[i] = "    { id: 'titas', name: 'Titas Gas', label: 'তিতাস গ্যাস বিল', enLabel: 'Titas Gas Bill', category: 'gas', iconColor: 'bg-rose-100 text-rose-600' },\n"
    if '    { id: \'dhaka_wasa\'' in line and not line.strip().endswith(','):
        lines[i] = "    { id: 'dhaka_wasa', name: 'Dhaka WASA', label: 'ঢাকা ওয়াসা পানি বিল', enLabel: 'Dhaka WASA Water Bill', category: 'water', iconColor: 'bg-blue-100 text-blue-600' },\n"
    if '    { id: \'link3\'' in line and not line.strip().endswith(','):
        lines[i] = "    { id: 'link3', name: 'Link3', label: 'Link3 ইন্টারনেট বিল', enLabel: 'Link3 Internet Bill', category: 'internet', iconColor: 'bg-purple-100 text-purple-600' },\n"
    if '    { id: \'akash_dth\'' in line and not line.strip().endswith(','):
        lines[i] = "    { id: 'akash_dth', name: 'Akash DTH', label: 'আকাশ DTH ক্যাবল বিল', enLabel: 'Akash DTH Cable Bill', category: 'tv', iconColor: 'bg-fuchsia-100 text-fuchsia-600' },\n"

# For 3885 and 4205, we need to locate them properly
lines[3885-1] = lines[3885-1].replace('{/* MOBILE BANK CHANNEL */}', '')
# If line 4205 is ')}', maybe it should be ')}' or just '}' or maybe ')'
# Let's fix line 4205.
