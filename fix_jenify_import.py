# 1. Fix Dashboard.tsx
with open('src/components/Dashboard.tsx', 'r') as f:
    dashboard_code = f.read()

dashboard_code = dashboard_code.replace("import { JenifyPaymentGateway } from './JenifyPaymentGateway';", "// JenifyPaymentGateway inlined below")

jenify_inline = """
interface JenifyPaymentGatewayProps {
  onConfirm: (amount: number, method: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export const JenifyPaymentGateway: React.FC<JenifyPaymentGatewayProps> = ({ onConfirm, onBack, isLoading }) => {
  const [amount, setAmount] = useState('');
  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];
  const handleNext = () => {
    if (Number(amount) >= 10) {
      onConfirm(Number(amount), 'automated');
    }
  };
  return (
    <div className="max-w-md mx-auto bg-white min-h-[400px] flex flex-col font-sans text-left">
      <div className="bg-[#1e293b] text-white p-6 pb-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 mx-auto">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5"> 
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-black tracking-tight">BNB <span className="text-emerald-400">Payment Gateway</span></span>
          </div>
        </div>
        <div className="text-center mt-2"> 
           <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">সুরক্ষিত পেমেন্ট গেটওয়ে</p>
           <h2 className="text-2xl font-black mt-1">টাকার পরিমাণ লিখুন</h2>
        </div>
      </div>
      <div className="flex-1 -mt-8 px-5 pb-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">জমার পরিমাণ (টাকা)</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-3xl font-black text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-center"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">৳</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className={`py-2.5 rounded-xl border-2 text-xs font-black transition-all ${
                  amount === amt.toString() 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 scale-105' 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                }`}
              >
                ৳{amt.toLocaleString()}
              </button>
            ))}
          </div>
          <button
            disabled={!amount || Number(amount) < 10 || isLoading}
            onClick={handleNext}
            className="w-full bg-gradient-to-r from-[#1e293b] to-[#334155] text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50 transition-transform active:scale-95 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>প্রসেসিং হচ্ছে...</span>
              </>
            ) : (
              <>
                পেমেন্ট নিশ্চিত করুন
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
"""

dashboard_code += jenify_inline

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(dashboard_code)

print('Inlined JenifyPaymentGateway in Dashboard.tsx successfully!')

# 2. Fix BNBMobileBankingPortal.tsx
with open('src/components/BNBMobileBankingPortal.tsx', 'r') as f:
    portal_code = f.read()

portal_code = portal_code.replace("import { JenifyPaymentGateway } from './JenifyPaymentGateway';", "// JenifyPaymentGateway imported or inlined")

with open('src/components/BNBMobileBankingPortal.tsx', 'w') as f:
    f.write(portal_code)

print('Cleaned BNBMobileBankingPortal.tsx import successfully!')
