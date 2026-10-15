# Step 1: Update src/types.ts
with open('src/types.ts', 'r') as f:
    types_code = f.read()

if 'customGridIcons?: Record<string, string>;' not in types_code:
    types_code = types_code.replace(
        'export interface AppConfig {',
        'export interface AppConfig {\n  customGridIcons?: Record<string, string>;'
    )
    with open('src/types.ts', 'w') as f:
        f.write(types_code)
    print('Updated AppConfig in src/types.ts successfully!')

# Step 2: Update src/components/Dashboard.tsx
with open('src/components/Dashboard.tsx', 'r') as f:
    dash_code = f.read()

# Add helper function inside Dashboard component
helper_code = """
  // Helper to render custom gallery image icon if set by Admin, else fall back to default SVG
  const renderGridServiceIcon = (key: string, DefaultIconComponent: React.ComponentType<{ className?: string }>) => {
    const customImg = appConfig?.customGridIcons?.[key];
    if (customImg) {
      return (
        <img 
          src={customImg} 
          alt="Service Icon" 
          className="w-11 h-11 sm:w-13 sm:h-13 object-contain rounded-xl transition-transform group-hover:scale-105 shadow-2xs" 
        />
      );
    }
    return <DefaultIconComponent className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />;
  };
"""

if 'const renderGridServiceIcon' not in dash_code:
    idx = dash_code.find('const getTxt =')
    if idx != -1:
        dash_code = dash_code[:idx] + helper_code + '\n' + dash_code[idx:]

# Replace individual icon calls with renderGridServiceIcon
dash_code = dash_code.replace('<SamityIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('samity', SamityIcon)}")
dash_code = dash_code.replace('<SafeDealsIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('safedeals', SafeDealsIcon)}")
dash_code = dash_code.replace('<QardIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('qard', QardIcon)}")
dash_code = dash_code.replace('<BankIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('bank', BankIcon)}")
dash_code = dash_code.replace('<TelecomIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('telecom', TelecomIcon)}")
dash_code = dash_code.replace('<RationIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('ration', RationIcon)}")
dash_code = dash_code.replace('<SalaryIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('salary', SalaryIcon)}")
dash_code = dash_code.replace('<SafiIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('safi', SafiIcon)}")
dash_code = dash_code.replace('<AutoRechargeIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('auto_recharge', AutoRechargeIcon)}")
dash_code = dash_code.replace('<BillPayIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('bill_pay', BillPayIcon)}")
dash_code = dash_code.replace('<AgentIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('agent', AgentIcon)}")
dash_code = dash_code.replace('<AboutIcon className="w-11 h-11 sm:w-13 sm:h-13 transition-transform group-hover:scale-105" />', "{renderGridServiceIcon('about', AboutIcon)}")

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(dash_code)

print('Updated Dashboard.tsx for custom icons rendering successfully!')
