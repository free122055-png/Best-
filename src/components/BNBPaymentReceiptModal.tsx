import React, { useRef, useState } from 'react';
import { 
  Copy, 
  Check, 
  X, 
  ArrowLeft,
  Clock
} from 'lucide-react';

export interface PaymentReceiptData {
  transactionId?: string;
  typeLabel?: string;
  amount: number;
  fee?: number;
  totalAmount?: number;
  status?: 'success' | 'pending' | 'completed' | 'failed' | 'rejected';
  
  // Beneficiary / Receiver / Member details
  beneficiaryName?: string;
  beneficiaryAccount?: string; // ID or Account No
  senderPhone?: string;
  phone?: string;
  userPhone?: string;
  
  // Bank details if applicable
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  branchName?: string;
  routingNumber?: string;
  routingNo?: string;
  
  // Extra details
  paymentMethod?: string;
  transactionDate?: string;
  createdAt?: string;
  description?: string;
  adminNotice?: string;
  foreignAmount?: number;
  netForeignAmount?: number;
  foreignCurrency?: string;
  exchangeRate?: number;
  bdtAmount?: number;
  remittanceIncentiveRate?: number;
  remittanceIncentiveAmount?: number;
  remittanceTransferFee?: number;
  totalRemittancePayout?: number;
  beneficiaryBankName?: string;
  beneficiaryAccountNo?: string;
  beneficiaryBranch?: string;
  beneficiaryDistrict?: string;
  beneficiaryPhone?: string;
  beneficiaryRelation?: string;
  grossAmount?: number;
  feeBdt?: number;
  remittanceFee?: number;
}

interface BNBPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PaymentReceiptData | null;
  appLogo?: string;
  onNewTransaction?: () => void;
  onViewHistory?: () => void;
}

export const BNBPaymentReceiptModal: React.FC<BNBPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  appLogo,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !data) return null;

  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed' || data.status === 'rejected';
  const isSuccess = data.status === 'success' || data.status === 'completed' || (!isPending && !isFailed);

  const amountNum = Number(data.amount || 0);
  const feeNum = Number(data.fee || 0);
  const totalNum = Number(data.totalAmount || (amountNum + feeNum));

  const amountFormatted = amountNum.toFixed(2);
  const feeFormatted = feeNum.toFixed(2);
  const totalFormatted = totalNum.toFixed(2);

  const displayPhone = data.senderPhone || data.phone || data.userPhone || '01600664081';
  const receiverName = data.beneficiaryName || data.accountName || 'Md rasel mia';
  const receiverId = data.beneficiaryAccount || 'BNB00000001';
  const txId = data.transactionId || 'DJDOVRAY8U';

  const rawDate = data.transactionDate || data.createdAt;
  const displayDate = rawDate 
    ? (new Date(rawDate).toString() !== 'Invalid Date' 
        ? new Date(rawDate).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }) 
        : rawDate)
    : new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

  const logoSrc = appLogo || '/logo.png';

  // Generate Serialized text for clipboard copy
  const generateSerializedReceiptText = () => {
    const statusText = isPending 
      ? 'অপেক্ষমাণ (Pending)' 
      : isSuccess 
        ? 'সফল (Success / Approved)' 
        : 'বাতিল (Rejected / Failed)';

    let lines: string[] = [
      '🧾 লেনদেন রসিদ (BNB Digital Network)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `গ্রাহক (Receiver): ${receiverName} (আইডি: ${receiverId})`,
      `মোবাইল নম্বর: ${displayPhone}`,
      `লেনদেন পরিমাণ (Amount): ৳${amountFormatted} BDT`,
      `সার্ভিস চার্জ (Charge): ${feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}`,
      `মোট কেটে নেওয়া হয়েছে: ৳${totalFormatted} BDT`,
      `ট্রানজেকশন আইডি (TxID): ${txId}`,
      `লেনদেন স্ট্যাটাস (Status): ${statusText}`,
      `তারিখ: ${displayDate}`,
      'BUSINESS NETWORK BANGLADESH (BNB) • ডিজিটাল লেনদেন সীমিত',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ];

    return lines.join('\n');
  };

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllText = () => {
    const textToCopy = generateSerializedReceiptText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_text');
    setTimeout(() => setCopiedField(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white p-3 sm:p-4 overflow-y-auto w-full h-full min-h-screen text-[#08502d] font-sans animate-fade-in">
      
      {/* Full white background container */}
      <div className="relative w-full max-w-md bg-white min-h-screen sm:min-h-0 overflow-hidden flex flex-col p-4 sm:p-5 my-auto space-y-3">
        
        {/* Top Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-[#08502d] flex items-center justify-center transition cursor-pointer border border-emerald-200"
          title="বন্ধ করুন"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* 1. Official Logo & Header Heading */}
        <div className="text-center pt-1 space-y-1.5">
          {/* Centered Official Logo */}
          <div className="flex justify-center pb-0.5">
            <img 
              src={logoSrc} 
              alt="BNB Official Logo" 
              className="w-28 h-28 sm:w-36 sm:h-36 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/app_icon.png';
              }}
            />
          </div>

          {/* Heading in green text */}
          <h2 className="text-xl sm:text-2xl font-black text-[#08502d] tracking-tight">
            {isPending 
              ? 'লেনদেন আবেদনটি জমা হয়েছে!' 
              : isFailed 
                ? 'লেনদেন আবেদনটি বাতিল হয়েছে!' 
                : 'লেনদেন সফলভাবে সম্পন্ন হয়েছে!'}
          </h2>

          {/* Date & Time Pill Badge */}
          <div className="flex justify-center my-1.5">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#045d36] text-white rounded-full text-xs font-bold font-mono shadow-xs">
              <Clock className="w-3.5 h-3.5 text-emerald-200" />
              <span>তারিখ: {displayDate}</span>
            </div>
          </div>
        </div>

        {/* 2. THE RECEIPT CONTAINER (Green outline box with all green texts) */}
        <div 
          ref={receiptRef}
          className="border-2 border-[#166534] rounded-2xl p-3.5 sm:p-4 bg-white space-y-2.5 text-xs sm:text-[13px] font-sans shadow-2xs"
        >
          {/* Row 1: Receiver */}
          <div className="flex justify-between items-center py-1 border-b border-emerald-100/60 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">গ্রাহক (Receiver):</span>
            <div className="font-black text-[#08502d] text-right flex items-center justify-end gap-1">
              <span>{receiverName}</span>
              {receiverId && (
                <span className="text-[#166534] font-bold text-xs">(আইডি: {receiverId})</span>
              )}
              <button
                type="button"
                onClick={() => handleCopy(`${receiverName} ${receiverId}`, 'receiver')}
                className="p-0.5 hover:bg-emerald-50 rounded text-[#166534] transition cursor-pointer"
                title="কপি করুন"
              >
                {copiedField === 'receiver' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Row 2: Mobile Number */}
          <div className="flex justify-between items-center py-1 border-b border-emerald-100/60 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">মোবাইল নম্বর:</span>
            <div className="font-mono font-black text-[#08502d] flex items-center gap-1">
              <span>{displayPhone}</span>
              <button
                type="button"
                onClick={() => handleCopy(displayPhone, 'phone')}
                className="p-0.5 hover:bg-emerald-50 rounded text-[#166534] transition cursor-pointer"
                title="কপি করুন"
              >
                {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Row 3: Amount */}
          <div className="flex justify-between items-center py-1 border-b border-emerald-100/60 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">লেনদেন পরিমাণ (Amount):</span>
            <span className="font-mono font-black text-[#08502d] text-sm">
              ৳{amountFormatted} BDT
            </span>
          </div>

          {/* Row 4: Service Charge */}
          <div className="flex justify-between items-center py-1 border-b border-emerald-100/60 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">সার্ভিস চার্জ (Charge):</span>
            <span className="font-extrabold text-[#166534]">
              {feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}
            </span>
          </div>

          {/* Row 5: Total Deducted */}
          <div className="flex justify-between items-center py-1 border-b border-emerald-100/60 gap-2">
            <span className="font-black text-[#08502d] whitespace-nowrap">মোট কেটে নেওয়া হয়েছে:</span>
            <span className="font-mono font-black text-[#08502d] text-sm">
              ৳{totalFormatted} BDT
            </span>
          </div>

          {/* Dashed Line */}
          <div className="border-b border-dashed border-[#166534] my-2" />

          {/* Row 6: TxID Green Pill Box */}
          <div className="flex justify-between items-center py-1 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">ট্রানজেকশন আইডি (TxID):</span>
            <div className="bg-[#e6f9f0] border border-[#166534] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[#166534] font-mono font-black text-xs sm:text-sm shadow-2xs">
              <span>{txId}</span>
              <button
                type="button"
                onClick={() => handleCopy(txId, 'txid')}
                className="p-0.5 hover:bg-[#c2f2dc] rounded text-[#166534] transition cursor-pointer"
                title="ট্রানজেকশন আইডি কপি করুন"
              >
                {copiedField === 'txid' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Row 7: Status Green Pill Box */}
          <div className="flex justify-between items-center py-1 gap-2">
            <span className="font-extrabold text-[#08502d] whitespace-nowrap">লেনদেন স্ট্যাটাস (Status):</span>
            <div className="bg-[#e6f9f0] border border-[#166534] rounded-full px-3 py-1 text-[#166534] font-black text-xs">
              {isFailed ? 'বাতিল (Failed)' : isPending ? 'অপেক্ষমাণ (Pending)' : 'সফল (Success)'}
            </div>
          </div>

          {/* Footer Seal inside Box */}
          <div className="pt-2 text-center border-t border-emerald-100 text-[9.5px] font-bold text-[#166534] uppercase tracking-wider">
            BUSINESS NETWORK BANGLADESH (BNB) • ডিজিটাল লেনদেন সীমিত
          </div>
        </div>

        {/* Toast Feedback */}
        {copiedField === 'all_text' && (
          <div className="bg-[#08502d] text-white text-xs font-bold py-2 px-3 rounded-xl text-center shadow-lg border border-emerald-700 animate-in fade-in zoom-in duration-150 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-300" />
            <span>✓ রসিদের সমস্ত তথ্য কপি করা হয়েছে!</span>
          </div>
        )}

        {/* 3. Solid Green Replica Action Buttons (Only 2 Main Buttons) */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {/* Left Button: পোড়ে ফিরে যান */}
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-2 rounded-xl bg-[#0d7a46] hover:bg-[#0a6338] active:scale-95 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>পোড়ে ফিরে যান</span>
          </button>

          {/* Right Button: লেখা কপি করুন */}
          <button
            type="button"
            onClick={handleCopyAllText}
            className="py-3 px-2 rounded-xl bg-[#0d7a46] hover:bg-[#0a6338] active:scale-95 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>লেখা কপি করুন</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default BNBPaymentReceiptModal;
