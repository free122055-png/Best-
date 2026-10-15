with open('src/components/SectionIcons.tsx', 'r') as f:
    code = f.read()

# Replace QardIcon
qard_old_start = code.find('export const QardIcon:')
qard_old_end = code.find('export const BankIcon:', qard_old_start)

new_qard = """export const QardIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Radiant Background Aura */}
    <circle cx="32" cy="20" r="16" fill={GREEN_FILL} opacity="0.15" />

    {/* Central Taka Coin with Blessing */}
    <circle cx="32" cy="18" r="12" fill={GREEN_FILL} />
    <circle cx="32" cy="18" r="10" stroke="#ffffff" strokeWidth="1.5" />
    <text x="32" y="23" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">৳</text>

    {/* Loving Benevolent Cupped Hands holding the Coin */}
    <path d="M10 42C10 38 15 36 22 36C26 36 30 38 32 40L28 46C23 44 18 44 14 46L10 42Z" fill={GREEN_FILL} />
    <path d="M8 44C8 40 14 42 22 42L30 46L24 54C16 52 10 48 8 44Z" fill={GREEN_DARK} />
    <path d="M54 42C54 38 49 36 42 36C38 36 34 38 32 40L36 46C41 44 46 44 50 46L54 42Z" fill={GREEN_FILL} />
    <path d="M56 44C56 40 50 42 42 42L34 46L40 54C48 52 54 48 56 44Z" fill={GREEN_DARK} />

    {/* Heart Symbol of Charity/Care above coin */}
    <path d="M32 4C30.5 2 28 2 26.5 3.5C25 5 25 7.5 27 9.5L32 14.5L37 9.5C39 7.5 39 5 37.5 3.5C36 2 33.5 2 32 4Z" fill={GREEN_FILL} />
  </svg>
);

"""

if qard_old_start != -1 and qard_old_end != -1:
    code = code[:qard_old_start] + new_qard + code[qard_old_end:]

# Replace BillPayIcon
bill_old_start = code.find('export const BillPayIcon:')
bill_old_end = code.find('export const AgentIcon:', bill_old_start)

new_bill = """export const BillPayIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Bill Document Frame */}
    <rect x="14" y="8" width="36" height="48" rx="5" fill={GREEN_FILL} />
    <path d="M19 14H35" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M19 20H29" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    
    {/* Utility Badges Container inside Bill */}
    <rect x="18" y="26" width="28" height="22" rx="4" fill="#ffffff" />
    
    {/* Electricity Lightning Bolt */}
    <path d="M26 28L22 36H26L24 43L31 34H27L29 28H26Z" fill={GREEN_FILL} />
    
    {/* Water Drop */}
    <path d="M34 32C34 30 37 28 37 28C37 28 40 30 40 32C40 34 38.6 35.5 37 35.5C35.4 35.5 34 34 34 32Z" fill={GREEN_DARK} />
    
    {/* Gas Flame */}
    <path d="M41 38C40 39.5 40 42 42.5 43.5C44 43.5 45 42 45 40.5C45 39 43.5 38 42.5 37C42 37.5 41.5 37.8 41 38Z" fill={GREEN_FILL} />
    
    {/* Success Paid Badge Checkmark on top right */}
    <circle cx="44" cy="14" r="8" fill={GREEN_DARK} />
    <circle cx="44" cy="14" r="7" stroke="#ffffff" strokeWidth="1" />
    <path d="M40 14L43 17L48 11" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

"""

if bill_old_start != -1 and bill_old_end != -1:
    code = code[:bill_old_start] + new_bill + code[bill_old_end:]

# Replace AboutIcon
about_old_start = code.find('export const AboutIcon:')
about_old_end = len(code)

new_about = """export const AboutIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Target Stand / Base */}
    <path d="M18 58L26 42H38L46 58H18Z" fill={GREEN_DARK} opacity="0.85" />
    <rect x="29" y="38" width="6" height="12" fill={GREEN_FILL} />

    {/* Target Bullseye Board Outer Ring */}
    <circle cx="32" cy="24" r="20" fill={GREEN_FILL} />
    <circle cx="32" cy="24" r="15" fill="#ffffff" />
    <circle cx="32" cy="24" r="10" fill={GREEN_FILL} />
    <circle cx="32" cy="24" r="5" fill="#ffffff" />
    <circle cx="32" cy="24" r="2.5" fill={GREEN_DARK} />

    {/* Sharp Arrow hitting Center Bullseye */}
    <path d="M48 8L32 24" stroke={GREEN_DARK} strokeWidth="3.5" strokeLinecap="round" />
    <polygon points="32,24 37,21 35,27" fill={GREEN_DARK} />
    
    {/* Arrow Feathers */}
    <path d="M48 8L54 4M48 8L52 12M48 8L44 2" stroke={GREEN_DARK} strokeWidth="2.5" strokeLinecap="round" />

    {/* Sparkle Star of Success at Target Top */}
    <path d="M16 12L18 16L22 18L18 20L16 24L14 20L10 18L14 16Z" fill={GREEN_FILL} />
  </svg>
);
"""

if about_old_start != -1:
    code = code[:about_old_start] + new_about

with open('src/components/SectionIcons.tsx', 'w') as f:
    f.write(code)

print('Updated SectionIcons.tsx successfully!')
