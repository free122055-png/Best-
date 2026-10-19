path = 'src/components/admin/AdminSamitySection.tsx'
with open(path, 'r') as f:
    lines = f.readlines()

# Set line 759 properly
cls_line = "                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 relative ${samityActiveSubTab === 'pending_applications' ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white shadow-md ring-2 ring-amber-400/50' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}\n"
lines[759] = cls_line

with open(path, 'w') as f:
    f.writelines(lines)

print('Successfully wrote line 759')
