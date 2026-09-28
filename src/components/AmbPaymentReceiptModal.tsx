import React, { useRef, useState } from 'react';
import { 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  X, 
  Send, 
  Camera, 
  ShieldCheck, 
  AlertCircle,
  MessageCircle,
  SendHorizontal,
  FileText,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import html2canvas from 'html2canvas';

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

interface AmbPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PaymentReceiptData | null;
  appLogo?: string;
  onNewTransaction?: () => void;
  onViewHistory?: () => void;
}

export const AmbPaymentReceiptModal: React.FC<AmbPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  appLogo,
  onNewTransaction
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showShareChooser, setShowShareChooser] = useState(false);

  if (!isOpen || !data) return null;

  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed' || data.status === 'rejected';
  const isSuccess = data.status === 'success' || data.status === 'completed' || (!isPending && !isFailed);

  const amountNum = Number(data.amount || 0);
  const feeNum = Number(data.fee || 0);
  const totalNum = Number(data.totalAmount || (amountNum + feeNum));

  const amountFormatted = amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const feeFormatted = feeNum.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const totalFormatted = totalNum.toLocaleString('en-US', { minimumFractionDigits: 2 });

  const displayPhone = data.senderPhone || data.phone || data.userPhone || 'N/A';
  const receiverName = data.beneficiaryName || data.accountName || 'AMB সদস্য';
  const receiverId = data.beneficiaryAccount || '';
  const txId = data.transactionId || 'SENDAMB-' + Math.floor(100000 + Math.random() * 900000);
  const typeLabel = data.typeLabel || data.paymentMethod || 'অ্যাড মানি (bKash)';

  const rawDate = data.transactionDate || data.createdAt;
  const displayDate = rawDate 
    ? (new Date(rawDate).toString() !== 'Invalid Date' 
        ? new Date(rawDate).toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
          }) 
        : rawDate)
    : new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });

  const isBankTx = !!(data.bankName || data.accountNumber || data.branch || (data.paymentMethod && data.paymentMethod.toLowerCase().includes('bank')));
  const bankName = data.bankName || data.paymentMethod || 'Dutch-Bangla Bank PLC. (DBBL)';
  const bankAccNo = data.accountNumber || data.beneficiaryAccount || '';
  const bankBranch = data.branch || data.branchName || 'প্রধান শাখা (Main Branch)';
  const routingNo = data.routingNumber || data.routingNo || '';

  // Generate 1-by-1 Serialized text for clipboard copy & instant messaging
  const generateSerializedReceiptText = () => {
    const statusText = isPending 
      ? 'অপেক্ষমান (Pending)' 
      : isSuccess 
        ? 'সফল (Success / Approved)' 
        : 'বাতিল (Rejected / Failed)';

    let lines: string[] = [
      '🧾 লেনদেন রসিদ (AMB Digital Network)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `1️⃣ লেনদেনের ধরন: ${typeLabel}`,
      `2️⃣ প্রাপক/সদস্য: ${receiverName}${receiverId ? ` (আইডি: ${receiverId})` : ''}`,
      `3️⃣ মোবাইল নম্বর: ${displayPhone}`
    ];

    let currentStep = 4;

    if (isBankTx && bankAccNo) {
      lines.push(`${currentStep}️⃣ ব্যাংক নাম: ${bankName}`);
      currentStep++;
      lines.push(`${currentStep}️⃣ অ্যাকাউন্ট নম্বর: ${bankAccNo}`);
      currentStep++;
      if (bankBranch) {
        lines.push(`${currentStep}️⃣ শাখা: ${bankBranch}`);
        currentStep++;
      }
      if (routingNo) {
        lines.push(`${currentStep}️⃣ রাউটিং নম্বর: ${routingNo}`);
        currentStep++;
      }
    }

    if (data.foreignAmount && data.foreignCurrency) {
      lines.push(`${currentStep}️⃣ প্রবাস কারেন্সি: ${data.foreignAmount} ${data.foreignCurrency} (রেট: ৳${Number(data.exchangeRate || 0).toFixed(2)})`);
      currentStep++;
    }

    if (data.remittanceIncentiveAmount && data.remittanceIncentiveAmount > 0) {
      lines.push(`${currentStep}️⃣ ২.৫% সরকারি প্রণোদনা: +৳${Number(data.remittanceIncentiveAmount).toFixed(2)} BDT`);
      currentStep++;
      lines.push(`${currentStep}️⃣ প্রাপক মোট পাবেন: ৳${Number(data.totalRemittancePayout || totalNum).toFixed(2)} BDT`);
      currentStep++;
    }

    lines.push(`${currentStep}️⃣ লেনদেন পরিমাণ: ৳${amountFormatted} BDT`);
    currentStep++;

    lines.push(`${currentStep}️⃣ সার্ভিস চার্জ: ${feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}`);
    currentStep++;

    lines.push(`${currentStep}️⃣ মোট কেটে নেওয়া হয়েছে: ৳${totalFormatted} BDT`);
    currentStep++;

    lines.push(`${currentStep}️⃣ ট্রানজেকশন আইডি (TxID): ${txId}`);
    currentStep++;

    lines.push(`${currentStep}️⃣ লেনদেনের তারিখ ও সময়: ${displayDate}`);
    currentStep++;

    lines.push(`${currentStep}️⃣ বর্তমান স্ট্যাটাস: ${statusText}`);
    currentStep++;

    lines.push(`${currentStep}️⃣ ডিজিটাল প্ল্যাটফর্ম: Al Mayadin Bazar (AMB)`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return lines.join('\n');
  };

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Requirement 4: Copy All Text 1-by-1 in serial format
  const handleCopyAllText = () => {
    const textToCopy = generateSerializedReceiptText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_text');
    setTimeout(() => setCopiedField(null), 3000);
  };

  // Requirement 4: Download Receipt as PNG Image to Gallery
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true
      });
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `AMB-Receipt-${txId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopiedField('download_success');
      setTimeout(() => setCopiedField(null), 3000);
    } catch (err) {
      console.error('Failed to capture receipt PNG image:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Requirement 3: Share receipt image & serialized text via WhatsApp, IMO, Web Share
  const handleShareReceipt = async () => {
    setSharing(true);
    const serializedText = generateSerializedReceiptText();

    try {
      // 1. Try native Web Share API with Image File if supported
      if (receiptRef.current && navigator.share) {
        try {
          const canvas = await html2canvas(receiptRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          });

          const blob = await new Promise<Blob | null>((resolve) => 
            canvas.toBlob(resolve, 'image/png', 0.95)
          );

          if (blob && navigator.canShare) {
            const file = new File([blob], `AMB-Receipt-${txId}.png`, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'AMB লেনদেন রসিদ',
                text: serializedText,
                files: [file]
              });
              setSharing(false);
              return;
            }
          }

          // Fallback to text sharing via Web Share
          await navigator.share({
            title: 'AMB লেনদেন রসিদ',
            text: serializedText
          });
          setSharing(false);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setSharing(false);
            return;
          }
        }
      }

      // 2. If Web Share is not available, open the sleek Share Sheet Chooser
      setShowShareChooser(true);
    } catch (e) {
      console.warn("Direct share not available, falling back to share chooser", e);
      setShowShareChooser(true);
    } finally {
      setSharing(false);
    }
  };

  const handleShareToWhatsApp = () => {
    const text = generateSerializedReceiptText();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    setShowShareChooser(false);
  };

  const handleShareToTelegram = () => {
    const text = generateSerializedReceiptText();
    const tgUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank');
    setShowShareChooser(false);
  };

  const handleShareToImoOrAny = () => {
    const text = generateSerializedReceiptText();
    navigator.clipboard.writeText(text);
    setCopiedField('all_text');
    setShowShareChooser(false);
    setTimeout(() => setCopiedField(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-start sm:justify-center bg-slate-950/85 backdrop-blur-md p-0 sm:p-4 overflow-y-auto w-full h-full min-h-screen text-slate-900 font-sans animate-fade-in">
      
      {/* Full-Screen Mobile Card / Centered Desktop Card */}
      <div className="relative w-full max-w-md bg-white min-h-screen sm:min-h-0 sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col p-4 sm:p-5 my-auto border border-slate-100 space-y-3">
        
        {/* Top Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shadow-xs border border-slate-200"
          title="বন্ধ করুন"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. Header Icon & Status Notification Banner */}
        <div className="text-center pt-2 space-y-2">
          {/* Circular Badge Icon (Warning / Check / Failed) */}
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            {isPending ? (
              <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-200/90 flex items-center justify-center shadow-inner relative animate-pulse">
                <AlertCircle className="w-8 h-8 text-amber-500" />
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : isFailed ? (
              <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-200 flex items-center justify-center shadow-inner relative">
                <X className="w-8 h-8 text-rose-500" />
                <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white rounded-full p-0.5 shadow-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center shadow-inner relative">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
          </div>

          {/* Heading */}
          <h2 className="text-lg sm:text-xl font-black text-[#993b00] tracking-tight">
            {isPending 
              ? 'লেনদেন আবেদনটি জমা হয়েছে!' 
              : isFailed 
                ? 'লেনদেন আবেদনটি বাতিল হয়েছে!' 
                : 'লেনদেন সফলভাবে সম্পন্ন হয়েছে!'}
          </h2>

          {/* Instruction Pill (Matching Screenshot) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50/90 border border-emerald-200 rounded-xl text-[11px] sm:text-xs font-bold text-emerald-800 shadow-2xs">
            <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>দয়া করে এই রসিদের একটি স্ক্রিনশট বা ছবি সংরক্ষণ করুন</span>
          </div>
        </div>

        {/* 2. THE RECEIPT CONTAINER (Captured for Download & Share) */}
        <div 
          ref={receiptRef}
          className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-4.5 shadow-xs space-y-3 relative text-slate-800 text-xs sm:text-[12.5px]"
        >
          {/* Receipt Top Badge & Timestamp */}
          <div className="text-center space-y-1 pb-1">
            <span className="inline-block px-3.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs sm:text-sm rounded-full shadow-2xs">
              {typeLabel}
            </span>
            <div className="text-slate-500 text-[11px] font-semibold font-mono">
              তারিখ: {displayDate}
            </div>
          </div>

          <div className="border-b border-dashed border-slate-200" />

          {/* Itemized Details List */}
          <div className="space-y-2 font-medium">
            
            {/* Receiver / Beneficiary Row */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium whitespace-nowrap">প্রাপক (Receiver):</span>
              <div className="font-extrabold text-slate-900 text-right flex items-center justify-end gap-1 flex-wrap">
                <span>{receiverName}</span>
                {receiverId && (
                  <span className="text-slate-500 font-normal text-[11px]">(আইডি: {receiverId})</span>
                )}
                {receiverId && (
                  <button
                    type="button"
                    onClick={() => handleCopy(receiverId, 'receiver_id')}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    title="আইডি কপি করুন"
                  >
                    {copiedField === 'receiver_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Number Row */}
            {displayPhone && displayPhone !== 'N/A' && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-medium whitespace-nowrap">মোবাইল নম্বর:</span>
                <div className="font-extrabold text-slate-900 flex items-center gap-1 font-mono">
                  <span>{displayPhone}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(displayPhone, 'phone')}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    title="মোবাইল নম্বর কপি করুন"
                  >
                    {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Optional Bank Transfer Information */}
            {isBankTx && bankAccNo && (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 font-medium whitespace-nowrap">ব্যাংক নাম:</span>
                  <span className="font-extrabold text-indigo-900 text-right">{bankName}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 font-medium whitespace-nowrap">অ্যাকাউন্ট নম্বর:</span>
                  <div className="font-black text-indigo-950 flex items-center gap-1 font-mono">
                    <span>{bankAccNo}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bankAccNo, 'bank_acc')}
                      className="p-1 hover:bg-indigo-50 rounded text-indigo-600 transition cursor-pointer"
                      title="অ্যাকাউন্ট নম্বর কপি করুন"
                    >
                      {copiedField === 'bank_acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {bankBranch && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium whitespace-nowrap">শাখা:</span>
                    <span className="font-bold text-slate-800 text-right">{bankBranch}</span>
                  </div>
                )}
                {routingNo && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium whitespace-nowrap">রাউটিং নং:</span>
                    <span className="font-mono font-bold text-slate-800">{routingNo}</span>
                  </div>
                )}
              </>
            )}

            {/* Optional Foreign Currency & Exchange Rate Info */}
            {data?.foreignAmount && data?.foreignCurrency && (
              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 space-y-1 my-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-amber-900 font-bold whitespace-nowrap text-xs flex items-center gap-1">
                    <span>✈️</span> প্রবাস কারেন্সি:
                  </span>
                  <span className="font-black text-amber-950 font-mono text-sm">
                    {data.foreignAmount} {data.foreignCurrency}
                  </span>
                </div>
                {data?.exchangeRate && (
                  <div className="flex justify-between items-center gap-2 text-[11px] text-amber-800 font-medium">
                    <span>এক্সচেঞ্জ রেট:</span>
                    <span className="font-mono font-bold">
                      ১ {data.foreignCurrency} = ৳{Number(data.exchangeRate).toFixed(2)} BDT
                    </span>
                  </div>
                )}
                {data?.remittanceIncentiveAmount && data.remittanceIncentiveAmount > 0 ? (
                  <div className="pt-1 mt-1 border-t border-amber-200/80 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-slate-700 font-bold">
                      <span>মূল রেমিট্যান্স টাকা:</span>
                      <span className="font-mono font-black">৳{(Number(data.bdtAmount) || (amountNum - data.remittanceIncentiveAmount)).toFixed(2)} BDT</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-700 font-extrabold">
                      <span className="flex items-center gap-1">
                        <span>🎁</span> সরকারি প্রণোদনা (২.৫%):
                      </span>
                      <span className="font-mono font-black bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-300">
                        + ৳{Number(data.remittanceIncentiveAmount).toFixed(2)} BDT
                      </span>
                    </div>
                    {data?.remittanceTransferFee ? (
                      <div className="flex justify-between items-center text-rose-700 font-extrabold">
                        <span className="flex items-center gap-1">
                          <span>🏷️</span> ট্রান্সফার ফি / সার্ভিস চার্জ:
                        </span>
                        <span className="font-mono font-black bg-rose-100/90 px-1.5 py-0.2 rounded border border-rose-300">
                          - ৳{Number(data.remittanceTransferFee).toFixed(2)} BDT
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center text-indigo-950 font-black pt-1 border-t border-amber-300/60 text-xs sm:text-sm">
                      <span className="flex items-center gap-1">
                        <span>🏛️</span> প্রাপক মোট পাবেন:
                      </span>
                      <span className="font-mono font-black text-emerald-800">
                        ৳{(Number(data.totalRemittancePayout) || amountNum).toFixed(2)} BDT
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Remittance Beneficiary Info if available */}
            {data?.beneficiaryBankName && (
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 space-y-1 text-xs">
                <div className="flex justify-between items-center text-indigo-900 font-bold">
                  <span>বাংলাদেশে প্রাপকের ব্যাংক:</span>
                  <span className="font-extrabold text-indigo-950">{data.beneficiaryBankName}</span>
                </div>
                {data.beneficiaryAccountNo && (
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>প্রাপকের হিসাব নং:</span>
                    <span className="font-mono font-bold text-slate-900">{data.beneficiaryAccountNo}</span>
                  </div>
                )}
                {data.beneficiaryPhone && (
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>প্রাপকের মোবাইল:</span>
                    <span className="font-mono font-bold text-slate-900">{data.beneficiaryPhone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Amount Row */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium whitespace-nowrap">লেনদেন পরিমাণ (Amount):</span>
              <span className="font-black text-slate-900 font-mono text-sm sm:text-base">
                ৳{amountFormatted} BDT
              </span>
            </div>

            {/* Service Charge Row */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium whitespace-nowrap">সার্ভিস চার্জ (Charge):</span>
              <span className="font-bold text-emerald-700">
                {feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}
              </span>
            </div>

            {/* Total Deducted Row */}
            <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-slate-700 font-bold whitespace-nowrap">মোট কেটে নেওয়া হয়েছে:</span>
              <span className="font-black text-slate-900 text-sm sm:text-base font-mono">
                ৳{totalFormatted} BDT
              </span>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-200" />

          {/* Transaction ID Box with One-Click Copy (Green Pill Matching Screenshot) */}
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">ট্রানজেকশন আইডি (TxID):</span>
            <div className="bg-[#e6f9f0] border border-[#a3e8cc] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[#065f46] font-mono font-black text-xs sm:text-sm shadow-2xs">
              <span>{txId}</span>
              <button
                type="button"
                onClick={() => handleCopy(txId, 'txid')}
                className="p-0.5 hover:bg-[#c2f2dc] rounded text-[#065f46] transition cursor-pointer"
                title="ট্রানজেকশন আইডি কপি করুন"
              >
                {copiedField === 'txid' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">লেনদেন স্ট্যাটাস (Status):</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
              isFailed 
                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                : isPending 
                  ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              <span>
                {isFailed 
                  ? 'বাতিল (Failed)' 
                  : isPending 
                    ? 'অপেক্ষমান (Pending)' 
                    : 'সফল (Success)'}
              </span>
            </span>
          </div>

          {/* Footer Brand Seal */}
          <div className="pt-2 text-center border-t border-slate-100">
            <div className="flex items-center justify-center space-x-1.5 text-[9.5px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              <span>BUSINESS NETWORK BANGLADESH (AMB)</span>
              <span>•</span>
              <span>ডিজিটাল লেনদেন সিস্টেম</span>
            </div>
          </div>
        </div>

        {/* 3. TOAST FEEDBACK NOTIFICATIONS */}
        {copiedField === 'all_text' && (
          <div className="bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded-xl text-center shadow-lg border border-slate-700 animate-in fade-in zoom-in duration-150 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>✓ সমস্ত লেনদেন তথ্য 1 বাই 1 সিরিয়ালে কপি করা হয়েছে!</span>
          </div>
        )}

        {copiedField === 'download_success' && (
          <div className="bg-emerald-800 text-white text-xs font-bold py-2 px-3 rounded-xl text-center shadow-lg border border-emerald-600 animate-in fade-in zoom-in duration-150 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-white" />
            <span>✓ রসিদের ছবি সফলভাবে গ্যালারিতে ডাউনলোড হয়েছে!</span>
          </div>
        )}

        {/* 4. ACTION BUTTONS */}
        <div className="space-y-2 pt-1">
          
          {/* Row 1: [ছবি ডাউনলোড] + [লেখা কপি করুন] (Requirement 4) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={downloading}
              className="py-2.5 px-3 rounded-xl bg-[#168a53] hover:bg-[#127043] active:scale-95 text-white text-xs sm:text-[13px] font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'ডাউনলোড হচ্ছে...' : 'ছবি ডাউনলোড'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAllText}
              className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs sm:text-[13px] font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Copy className="w-4 h-4 text-indigo-600" />
              <span>লেখা কপি করুন</span>
            </button>
          </div>

          {/* Row 2: [রসিদ শেয়ার করুন (WhatsApp / IMO / Share)] (Requirement 3: Replaces 'নতুন লেনদেন করুন') */}
          <button
            type="button"
            onClick={handleShareReceipt}
            disabled={sharing}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition shadow-md cursor-pointer border border-emerald-500/30"
          >
            <Share2 className="w-4 h-4 text-emerald-100" />
            <span>{sharing ? 'শেয়ার প্রস্তুত হচ্ছে...' : 'রসিদ শেয়ার করুন (WhatsApp / IMO / Share)'}</span>
          </button>

          {/* Bottom Quick Navigation / Dismiss Bar */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNewTransaction) onNewTransaction();
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline py-1 px-2 cursor-pointer flex items-center gap-1"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              <span>নতুন লেনদেন করতে চান?</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 font-bold hover:underline py-1 px-2 cursor-pointer"
            >
              বন্ধ করুন ✕
            </button>
          </div>

        </div>

        {/* 5. SHARE CHOOSER POPUP (For 1-click sharing to WhatsApp, IMO, Telegram, Socials) */}
        {showShareChooser && (
          <div className="fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in text-left">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 text-slate-900 font-black text-sm">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>রসিদ শেয়ার করার মাধ্যম সিলেক্ট করুন</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareChooser(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* WhatsApp Share Button */}
                <button
                  type="button"
                  onClick={handleShareToWhatsApp}
                  className="w-full p-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#128C7E] rounded-xl font-black text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">💬</span>
                    <span>হোয়াটসঅ্যাপে শেয়ার করুন (WhatsApp)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#128C7E]" />
                </button>

                {/* Telegram Share Button */}
                <button
                  type="button"
                  onClick={handleShareToTelegram}
                  className="w-full p-2.5 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] rounded-xl font-black text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">✈️</span>
                    <span>টেলিগ্রামে শেয়ার করুন (Telegram)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#0088cc]" />
                </button>

                {/* IMO / Messenger / Other Apps Copy Option */}
                <button
                  type="button"
                  onClick={handleShareToImoOrAny}
                  className="w-full p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-black text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📱</span>
                    <span>ইমু / মেসেঞ্জারের জন্য লেখা কপি করুন (IMO / Apps)</span>
                  </div>
                  <Copy className="w-3.5 h-3.5 text-indigo-700" />
                </button>
              </div>

              <div className="text-[11px] text-slate-500 text-center pt-1">
                লেখা কপি করে যেকোনো অ্যাপের চ্যাটবক্সে পেস্ট করে পাঠাতে পারবেন।
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AmbPaymentReceiptModal;
