import re

with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update the 8-Category Hub Grid to strictly grid-cols-4 with compact slim styling
old_hub_pattern = """                  {/* 8 Sections in 4-per-row grid (Row 1: 4 Cards, Row 2: 4 Cards) */}
                  <div className=\"grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5\">"""

# Let's inspect the entire Hub block from lines 11300 to 11640
