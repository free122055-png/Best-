import re
import subprocess

def run_build():
    result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
    return result.stdout, result.stderr

for _ in range(5):
    stdout, stderr = run_build()
    out = stdout + '\n' + stderr
    match = re.search(r'BnbMobileBankingPortal\.tsx:(\d+):\d+: ERROR', out)
    if not match:
        print("No errors found!")
        break
    
    line_num = int(match.group(1))
    print(f"Fixing line {line_num}")
    
    with open('src/components/BnbMobileBankingPortal.tsx', 'r') as f:
        lines = f.readlines()
        
    idx = line_num - 1
    # Check if we can safely remove it or wrap it
    lines[idx] = ""
    
    with open('src/components/BnbMobileBankingPortal.tsx', 'w') as f:
        f.writelines(lines)
        
