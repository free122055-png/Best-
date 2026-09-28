import re

with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
    lines = f.readlines()

def fix(s):
    return s.strip()

for i, line in enumerate(lines):
    stripped = line.strip()
    # List of known raw text lines inside JSX
    if stripped in [
        "Form is shown once operator is selected",
        "Generate QR data",
        "Wait a bit",
        "Check if this card belongs to me",
        "Set payment date as YYYY-MM-DD"
    ]:
        lines[i] = ""
    # Use a regex for lines starting with some known bad patterns
    if re.match(r'^\s*Form is shown once operator is selected', line):
        lines[i] = ""

with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
    f.writelines(lines)
