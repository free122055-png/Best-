import os

replacements = {
    "Al Mayadin Bazar": "BNB Business Network Bangladesh",
    "Al Mayadin Wallet": "BNB Wallet",
    "Al Mayadin Pay": "BNB Pay",
    "আল মায়াদিন": "BNB বিজনেস নেটওয়ার্ক"
}

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
            replace_in_file(os.path.join(root, file))

# Also replace in server.ts
replace_in_file('server.ts')
