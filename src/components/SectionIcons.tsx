import React from 'react';

// Primary Fintech Emerald Green (#00843D) matching Bangladesh top financial apps
const GREEN_FILL = "#00843D";
const GREEN_DARK = "#00622d";

interface IconProps {
  className?: string;
  size?: number;
}

const svgBaseProps = {
  viewBox: "0 0 64 64",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  shapeRendering: "geometricPrecision" as const,
  textRendering: "geometricPrecision" as const,
};

// 1. BNB কোম্পানি ইনভেস্টর (Investors / Samity Savings)
export const SamityIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Executive 3-People Investors Group around Oval Table with Coin Stacks */}
    {/* Center Leader */}
    <circle cx="32" cy="14" r="5" fill={GREEN_FILL} />
    <path d="M24 26C24 23.5 27.5 22 32 22C36.5 22 40 23.5 40 26V30H24V26Z" fill={GREEN_FILL} />
    
    {/* Left Investor */}
    <circle cx="16" cy="20" r="4" fill={GREEN_FILL} />
    <path d="M9 31C9 29 12 27.5 16 27.5C18.2 27.5 20.1 28 21.3 28.9L19.5 35H12.5L9 31Z" fill={GREEN_FILL} />
    
    {/* Right Investor */}
    <circle cx="48" cy="20" r="4" fill={GREEN_FILL} />
    <path d="M55 31C55 29 52 27.5 48 27.5C45.8 27.5 43.9 28 42.7 28.9L44.5 35H51.5L55 31Z" fill={GREEN_FILL} />

    {/* Oval Meeting Table */}
    <ellipse cx="32" cy="38" rx="26" ry="9" fill={GREEN_FILL} />
    <ellipse cx="32" cy="37" rx="23" ry="7" fill="#ffffff" />
    <ellipse cx="32" cy="37" rx="20" ry="5" fill={GREEN_FILL} opacity="0.1" />

    {/* Table Base */}
    <path d="M28 46H36V56H28V46Z" fill={GREEN_FILL} />
    <path d="M22 56H42V60H22V56Z" fill={GREEN_FILL} />

    {/* Taka Coin Stacks on Table */}
    <ellipse cx="26" cy="36" rx="4" ry="2" fill={GREEN_FILL} />
    <ellipse cx="26" cy="34" rx="4" ry="2" fill={GREEN_FILL} />
    <rect x="22" y="34" width="8" height="2" fill={GREEN_FILL} />
    
    <ellipse cx="38" cy="36" rx="4" ry="2" fill={GREEN_FILL} />
    <ellipse cx="38" cy="33" rx="4" ry="2" fill={GREEN_FILL} />
    <rect x="34" y="33" width="8" height="3" fill={GREEN_FILL} />

    {/* Center Taka Coin Badge */}
    <circle cx="32" cy="36" r="4" fill={GREEN_FILL} />
    <text x="32" y="39" textAnchor="middle" fontSize="6" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">৳</text>
  </svg>
);

// 2. BNB নিরাপদ লেনদেন (Safe Deals & Escrow Protection)
export const SafeDealsIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Shield Base */}
    <path d="M32 6L10 14V28C10 42 20 53 32 58C44 53 54 42 54 28V14L32 6Z" fill={GREEN_FILL} />
    <path d="M32 10L14 17V28C14 39.5 22.5 49 32 53.5C41.5 49 50 39.5 50 28V17L32 10Z" fill="#ffffff" />
    <path d="M32 13L17 20V28C17 37.5 24.5 45.5 32 49.5C39.5 45.5 47 37.5 47 28V20L32 13Z" fill={GREEN_FILL} opacity="0.1" />

    {/* Escrow Lock / Hands Holding Taka Coin */}
    <circle cx="32" cy="30" r="10" fill={GREEN_FILL} />
    <circle cx="32" cy="30" r="8" fill="#ffffff" />
    <text x="32" y="34.5" textAnchor="middle" fontSize="12" fontWeight="900" fill={GREEN_FILL} fontFamily="Arial, sans-serif">৳</text>

    {/* Protective Hands Cuffing the Coin */}
    <path d="M20 40C20 40 26 44 32 44C38 44 44 40 44 40" stroke={GREEN_FILL} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M22 22C25 19 28 18 32 18C36 18 39 19 42 22" stroke={GREEN_FILL} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// 3. BNB কার্জ হাসানা (Qard Hasana / Interest-free Loan)
export const QardIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
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

export const BankIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Outgoing Transaction Fast Arrow Top-Right */}
    <path d="M36 10H54V28L47 21L33 35L27 29L41 15L36 10Z" fill={GREEN_FILL} />

    {/* Modern Wallet */}
    <rect x="8" y="24" width="48" height="34" rx="6" fill={GREEN_FILL} />
    <rect x="12" y="28" width="40" height="26" rx="4" fill="#ffffff" />

    {/* Banknote emerging from wallet */}
    <rect x="16" y="20" width="32" height="12" rx="2" fill={GREEN_FILL} opacity="0.9" />
    <circle cx="32" cy="26" r="3" fill="#ffffff" />
    <text x="32" y="28" textAnchor="middle" fontSize="5" fontWeight="900" fill={GREEN_FILL} fontFamily="Arial, sans-serif">৳</text>

    {/* Wallet Clasp / Badge */}
    <path d="M42 35H56V47H42C38.7 47 36 44.3 36 41C36 37.7 38.7 35 42 35Z" fill={GREEN_FILL} />
    <circle cx="45" cy="41" r="3" fill="#ffffff" />
  </svg>
);

// 5. BNB টেলিকম (Telecom / Mobile & 5G Packs)
export const TelecomIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* 5G Wireless Tower */}
    <text x="32" y="12" textAnchor="middle" fontSize="11" fontWeight="900" fill={GREEN_FILL} fontFamily="Arial, sans-serif">5G</text>

    {/* Broadcast Signal Waves Left */}
    <path d="M21 16C15 22 15 32 21 38" stroke={GREEN_FILL} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M14 10C5 20 5 36 14 46" stroke={GREEN_FILL} strokeWidth="3.5" strokeLinecap="round" />

    {/* Broadcast Signal Waves Right */}
    <path d="M43 16C49 22 49 32 43 38" stroke={GREEN_FILL} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M50 10C59 20 59 36 50 46" stroke={GREEN_FILL} strokeWidth="3.5" strokeLinecap="round" />

    {/* Tower Mast */}
    <circle cx="32" cy="18" r="3" fill={GREEN_FILL} />
    <path d="M29 22L18 58H25L30 42H34L39 58H46L35 22H29Z" fill={GREEN_FILL} />
    <line x1="26" y1="33" x2="38" y2="33" stroke="#ffffff" strokeWidth="2.5" />
    <line x1="22" y1="45" x2="42" y2="45" stroke="#ffffff" strokeWidth="2.5" />
  </svg>
);

// 6. BNB রেশন কার্ড (Ration Card / Grocery Subsidy)
export const RationIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Groceries inside cart (oil bottle, bread, rice packet) */}
    <rect x="24" y="14" width="8" height="18" rx="2" fill={GREEN_FILL} />
    <rect x="34" y="10" width="10" height="22" rx="2" fill={GREEN_FILL} />
    <circle cx="48" cy="20" r="6" fill={GREEN_FILL} />

    {/* Shopping Cart Body */}
    <path d="M8 16H16L22 44H52L58 24H20" stroke={GREEN_FILL} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="26" y1="32" x2="54" y2="32" stroke={GREEN_FILL} strokeWidth="2.5" />
    <line x1="32" y1="24" x2="32" y2="44" stroke={GREEN_FILL} strokeWidth="2" />
    <line x1="42" y1="24" x2="42" y2="44" stroke={GREEN_FILL} strokeWidth="2" />

    {/* Cart Wheels */}
    <circle cx="26" cy="52" r="5" fill={GREEN_FILL} />
    <circle cx="26" cy="52" r="2" fill="#ffffff" />
    <circle cx="48" cy="52" r="5" fill={GREEN_FILL} />
    <circle cx="48" cy="52" r="2" fill="#ffffff" />
  </svg>
);

// 7. BNB আটা সেলারি পে (Salary Pay / P2P Remittance)
export const SalaryIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Left Person */}
    <circle cx="16" cy="18" r="6" fill={GREEN_FILL} />
    <path d="M8 36C8 30 11 28 16 28C21 28 24 30 24 36V54H18V42H14V54H8V36Z" fill={GREEN_FILL} />

    {/* Right Person */}
    <circle cx="48" cy="18" r="6" fill={GREEN_FILL} />
    <path d="M40 36C40 30 43 28 48 28C53 28 56 30 56 36V54H50V42H46V54H40V36Z" fill={GREEN_FILL} />

    {/* Handing over Taka Banknote */}
    <rect x="20" y="32" width="24" height="14" rx="3" fill={GREEN_FILL} />
    <rect x="22" y="34" width="20" height="10" rx="2" fill="#ffffff" />
    <circle cx="32" cy="39" r="3.5" fill={GREEN_FILL} />
    <text x="32" y="42" textAnchor="middle" fontSize="6" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">৳</text>
  </svg>
);

// 8. al safi (In-House Super Shop & Brand)
export const SafiIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Storefront Roof / Awning */}
    <path d="M10 16L54 16L58 26H6L10 16Z" fill={GREEN_FILL} />
    <path d="M6 26C9 30 14 30 17 26C20 30 25 30 28 26C31 30 36 30 39 26C42 30 47 30 50 26C53 30 58 30 60 26" stroke={GREEN_FILL} strokeWidth="3" strokeLinecap="round" />

    {/* Storefront Glass Frame */}
    <rect x="12" y="30" width="40" height="26" rx="3" fill={GREEN_FILL} />
    <rect x="16" y="34" width="32" height="18" rx="2" fill="#ffffff" />

    {/* Cart inside Store */}
    <path d="M22 38H26L29 48H39L42 41H28" stroke={GREEN_FILL} strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="31" cy="50" r="1.5" fill={GREEN_FILL} />
    <circle cx="37" cy="50" r="1.5" fill={GREEN_FILL} />

    {/* Premium Guarantee Seal Badge with Taka sign */}
    <circle cx="48" cy="46" r="8" fill={GREEN_FILL} stroke="#ffffff" strokeWidth="1.5" />
    <text x="48" y="49" textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">৳</text>
  </svg>
);

// 9. BNB ডাটা রিচার্জ (Data & Auto Mobile Recharge)
export const AutoRechargeIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Smartphone Frame */}
    <rect x="18" y="8" width="28" height="48" rx="5" fill={GREEN_FILL} />
    <rect x="21" y="13" width="22" height="38" rx="2" fill="#ffffff" />

    {/* Speaker slot & Home button */}
    <rect x="28" y="10" width="8" height="1.5" rx="1" fill="#ffffff" />
    <circle cx="32" cy="53" r="1.5" fill="#ffffff" />

    {/* Fast Recharge Lightning Bolt on Screen */}
    <path d="M33 17L25 31H32L31 43L39 29H32L33 17Z" fill={GREEN_FILL} />

    {/* Taka Coin Overlay Bottom-Right */}
    <circle cx="46" cy="44" r="9" fill={GREEN_FILL} stroke="#ffffff" strokeWidth="2" />
    <text x="46" y="48" textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">৳</text>
  </svg>
);

// 10. BNB বিল পে (Utility Bill Payment)
export const BillPayIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
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

export const AgentIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
  <svg 
    {...svgBaseProps}
    className={className} 
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Oval Base Platform */}
    <ellipse cx="32" cy="54" rx="22" ry="6" fill={GREEN_FILL} opacity="0.3" />

    {/* Large Geo Location Pin */}
    <path d="M32 6C20 6 12 15 12 28C12 42 32 56 32 56C32 56 52 42 52 28C52 15 44 6 32 6Z" fill={GREEN_FILL} />
    <circle cx="32" cy="24" r="10" fill="#ffffff" />

    {/* Agent Person Silhouette inside Pin */}
    <circle cx="32" cy="21" r="4" fill={GREEN_FILL} />
    <path d="M26 31C26 28 28.5 27 32 27C35.5 27 38 28 38 31V32H26V31Z" fill={GREEN_FILL} />
  </svg>
);

// 12. BNB আমাদের লক্ষ্য (Corporate Vision & Target)
export const AboutIcon: React.FC<IconProps> = ({ className = "w-12 h-12", size }) => (
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
