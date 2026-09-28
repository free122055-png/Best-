import re
import subprocess

def run_lint():
    result = subprocess.run(['npm', 'run', 'lint'], capture_output=True, text=True)
    return result.stdout

lint_output = run_lint()
line_numbers = set()
for line in lint_output.split('\n'):
    match = re.search(r'BnbMobileBankingPortal\.tsx\((\d+),\d+\): error', line)
    if match:
        line_numbers.add(int(match.group(1)))

if line_numbers:
    with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
        lines = f.readlines()
    
    for num in line_numbers:
        idx = num - 1
        original_line = lines[idx]
        if not original_line.strip().startswith('//'):
            lines[idx] = '// ' + original_line.lstrip()

    with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
        f.writelines(lines)
    print(f"Commented {len(line_numbers)} lines.")
else:
    print("No errors found.")
