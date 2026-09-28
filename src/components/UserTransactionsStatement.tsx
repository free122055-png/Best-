import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight, 
  Search, 
  Filter, 
  Smartphone, 
  ShoppingBag, 
  Coins, 
  Building2, 
  Gift, 
  AlertTriangle, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  User as UserIcon, 
  Wallet,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { User, Transaction, AppConfig, formatShortTrxId } from '../types';

interface UserTransactionsStatementProps {
  user: User;
  transactions: Transaction[];
  allUsers: User[];
  onSelectTransaction: (tx: Transaction) => void;
  appConfig?: AppConfig;
  t?: (key: string) => string;
}

export const UserTransactionsStatement: React.FC<UserTransactionsStatementProps> = ({
  user,
  transactions,
  allUsers,
  onSelectTransaction,
  appConfig,
  t = (s) => s
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'in' | 'out' | 'transfer' | 'add_money' | 'recharge' | 'savings' | 'loan' | 'shop'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'pending' | 'failed'>('all');

  // Map of users for fast lookups by UID, Phone, normalizedPhone, or MemberId
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    if (Array.isArray(allUsers)) {
      allUsers.forEach((u) => {
        if (u.uid) map.set(u.uid, u);
        if (u.id) map.set(u.id, u);
        if (u.phone) {
          map.set(u.phone, u);
          map.set(u.phone.replace(/\D/g, ''), u);
        }
        if ((u as any).phoneNumber) {
          map.set((u as any).phoneNumber, u);
          map.set((u as any).phoneNumber.replace(/\D/g, ''), u);
        }
        if (u.normalizedPhone) map.set(u.normalizedPhone, u);
        if (u.memberId) {
          map.set(u.memberId, u);
          map.set(u.memberId.toString(), u);
        }
      });
    }
    return map;
  }, [allUsers]);

  // Helper to determine if transaction is money-in (credit) or money-out (debit)
  const isCreditTx = (tx: Transaction): boolean => {
    const type = (tx.type || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const label = (tx.typeLabel || '').toLowerCase();

    // Explicit credit types
    if ([
      'add_money', 
      'received_transfer', 
      'interest', 
      'interest_added', 
      'qard_loan_disbursment', 
      'loan_disbursment',
      'cashback',
      'bonus',
      'refund'
    ].includes(type)) {
      return true;
    }

    // Deposit can be either wallet credit (Add money) or savings deposit
    if (type === 'deposit' || type === 'coop_savings_deposit') {
      if (desc.includes('প্রাপ্তি') || desc.includes('জমা প্রাপ্তি') || desc.includes('এড মানি') || desc.includes('মেইন ব্যালেন্স প্রাপ্তি') || label.includes('প্রাপ্তি')) {
        return true;
      }
      if (type === 'deposit' && !desc.includes('সঞ্চয়') && !desc.includes('কিস্তি') && !desc.includes('কর্তন')) {
        return true;
      }
      return false;
    }

    // Keyword detection
    if (desc.includes('প্রাপ্তি') || desc.includes('ক্যাশব্যাক') || desc.includes('বোনাস') || desc.includes('ক্রেডিট') || desc.includes('এড মানি সফল')) {
      return true;
    }
    if (label.includes('প্রাপ্তি') || label.includes('ক্যাশব্যাক') || label.includes('বোনাস') || label.includes('এড মানি')) {
      return true;
    }

    return false;
  };

  // Compute accurate running balance for all transactions
  const processedTransactions = useMemo(() => {
    // 1. Sort all transactions chronologically (oldest to newest)
    const sortedAsc = [...transactions].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    // 2. Start from current balance and compute backwards or compute forward
    // Forward approach from starting balance:
    // Better: compute backward from live user balance so latest tx always matches current balance!
    const sortedDesc = [...sortedAsc].reverse();
    let runningBalance = typeof user.balance === 'number' ? user.balance : (Number(user.balance) || 0);

    const listWithBalance = sortedDesc.map((tx) => {
      const isCredit = isCreditTx(tx);
      const effectiveAmount = Number(tx.totalDeducted || tx.amount) || 0;
      const txBalance = tx.balanceAfter !== undefined ? tx.balanceAfter : runningBalance;

      // Adjust running balance for next (older) transaction in sequence
      if (tx.status === 'success') {
        if (isCredit) {
          runningBalance = Math.max(0, runningBalance - effectiveAmount);
        } else {
          runningBalance = runningBalance + effectiveAmount;
        }
      }

      // Party resolution (Sender/Receiver/Service)
      let partyName = '';
      let partyPhone = '';
      let partyMemberId = '';
      let partyProfilePic: string | undefined = undefined;
      let serviceTitle = '';
      let categoryTag = '';
      let avatarTheme: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'indigo' | 'slate' = 'emerald';
      let iconType: 'send' | 'receive' | 'add_money' | 'telecom' | 'shop' | 'savings' | 'loan' | 'fine' | 'cashback' | 'withdraw' | 'general' = 'general';

      const type = (tx.type || '').toLowerCase();
      const desc = tx.description || '';
      const method = (tx.paymentMethod || '').toLowerCase();

      // Case 1: Send Money (Money Out)
      if (type === 'balance_transfer' || type === 'transfer') {
        iconType = 'send';
        avatarTheme = 'rose';
        categoryTag = 'সেন্ড মানি';
        serviceTitle = 'টাকা পাঠানো (Send Money)';

        // Look for receiver in allUsers
        let matchedUser: User | undefined = undefined;
        if (tx.receiverUid && userMap.has(tx.receiverUid)) matchedUser = userMap.get(tx.receiverUid);
        else if (tx.receiverId && userMap.has(tx.receiverId)) matchedUser = userMap.get(tx.receiverId);
        else if (tx.phone && userMap.has(tx.phone)) matchedUser = userMap.get(tx.phone);

        if (matchedUser) {
          partyName = matchedUser.name;
          partyPhone = matchedUser.phone || (matchedUser as any).phoneNumber || '';
          partyMemberId = matchedUser.memberId;
          partyProfilePic = matchedUser.profilePic;
        } else {
          partyName = tx.receiverName || '';
          partyPhone = tx.phone || '';
          partyMemberId = tx.receiverId || '';
          
          // Try to parse from description: e.g., "সদস্য মোঃ রুবেল (আইডি: 1045) কে ..."
          if (!partyName) {
            const nameMatch = desc.match(/সদস্য\s+([^(]+)\s+\(আইডি:\s*([^)]+)\)/);
            if (nameMatch) {
              partyName = nameMatch[1].trim();
              partyMemberId = nameMatch[2].trim();
            }
          }
        }

        if (!partyName) partyName = 'AMB সদস্য প্রাপক';
      }
      // Case 2: Receive Money (Money In)
      else if (type === 'received_transfer' || (type === 'deposit' && isCredit && (desc.includes('হতে') || desc.includes('প্রাপ্তি')))) {
        iconType = 'receive';
        avatarTheme = 'emerald';
        categoryTag = 'টাকা প্রাপ্তি';
        serviceTitle = 'টাকা গ্রহণ (Receive Money)';

        // Look for sender in allUsers
        let matchedUser: User | undefined = undefined;
        if (tx.senderInfo && userMap.has(tx.senderInfo)) matchedUser = userMap.get(tx.senderInfo);
        else if (tx.senderPhone && userMap.has(tx.senderPhone)) matchedUser = userMap.get(tx.senderPhone);
        else if (tx.phone && userMap.has(tx.phone)) matchedUser = userMap.get(tx.phone);

        if (matchedUser) {
          partyName = matchedUser.name;
          partyPhone = matchedUser.phone || (matchedUser as any).phoneNumber || '';
          partyMemberId = matchedUser.memberId;
          partyProfilePic = matchedUser.profilePic;
        } else {
          partyName = tx.userName || '';
          partyPhone = tx.senderInfo || tx.senderPhone || tx.phone || '';
          
          // Try parse from description: "সদস্য মোঃ রাসেল (আইডি: 1020) হতে ..."
          const nameMatch = desc.match(/সদস্য\s+([^(]+)\s+\(আইডি:\s*([^)]+)\)\s*হতে/);
          if (nameMatch) {
            partyName = nameMatch[1].trim();
            partyMemberId = nameMatch[2].trim();
          }
        }

        if (!partyName) partyName = 'AMB সদস্য প্রেরক';
      }
      // Case 3: Add Money (MFS / Bank)
      else if (type === 'add_money') {
        iconType = 'add_money';
        avatarTheme = 'purple';
        categoryTag = 'এড মানি';
        
        if (method.includes('bkash') || desc.includes('bKash') || desc.includes('বিকাশ')) {
          serviceTitle = 'bKash এড মানি';
          partyName = 'bKash পেমেন্ট গেটওয়ে';
        } else if (method.includes('nagad') || desc.includes('Nagad') || desc.includes('নগদ')) {
          serviceTitle = 'Nagad এড মানি';
          partyName = 'Nagad পেমেন্ট গেটওয়ে';
        } else if (method.includes('rocket') || desc.includes('Rocket') || desc.includes('রকেট')) {
          serviceTitle = 'Rocket এড মানি';
          partyName = 'Rocket পেমেন্ট গেটওয়ে';
        } else if (method.includes('bank') || desc.includes('Bank') || desc.includes('ব্যাংক')) {
          serviceTitle = 'ব্যাংক ডিপোজিট এড মানি';
          partyName = tx.paymentMethod || 'অনলাইন ব্যাংক ডিপোজিট';
        } else {
          serviceTitle = 'মোবাইল এড মানি';
          partyName = tx.paymentMethod || 'AMB এড মানি সিস্টেম';
        }
        partyPhone = tx.senderInfo || tx.phone || '';
      }
      // Case 4: Telecom Mobile Recharge
      else if (type === 'telecom_recharge' || type === 'telecom') {
        iconType = 'telecom';
        avatarTheme = 'blue';
        categoryTag = 'রিচার্জ';
        
        let opName = 'মোবাইল';
        if (desc.includes('গ্রামীণফোন') || desc.includes('GP') || desc.includes('Grameenphone')) opName = 'গ্রামীণফোন (GP)';
        else if (desc.includes('বাংলালিংক') || desc.includes('Banglalink') || desc.includes('BL')) opName = 'বাংলালিংক (BL)';
        else if (desc.includes('রবি') || desc.includes('Robi')) opName = 'রবি (Robi)';
        else if (desc.includes('এয়ারটেল') || desc.includes('Airtel')) opName = 'এয়ারটেল (Airtel)';
        else if (desc.includes('টেলিটক') || desc.includes('Teletalk')) opName = 'টেলিটক (Teletalk)';
        else if (desc.includes('স্কিটো') || desc.includes('Skitto')) opName = 'স্কিটো (Skitto)';

        serviceTitle = `মোবাইল রিচার্জ - ${opName}`;
        partyName = opName;
        partyPhone = tx.phone || tx.accountNumber || tx.senderInfo || '';
      }
      // Case 5: Super Shop Purchase
      else if (type === 'shop_purchase' || type === 'coop_shop') {
        iconType = 'shop';
        avatarTheme = 'amber';
        categoryTag = 'সুপার শপ';
        serviceTitle = 'AMB সুপার শপ অর্ডার';
        partyName = 'AMB সুপার শপ ও ডেলিভারি';
        partyPhone = tx.phone || '';
      }
      // Case 6: Samity Savings Deposit / DPS
      else if (type === 'coop_savings_deposit' || type === 'samity_deposit') {
        iconType = 'savings';
        avatarTheme = 'emerald';
        categoryTag = 'সমবায় সঞ্চয়';
        serviceTitle = 'AMB সমবায় সমিতি সঞ্চয় কিস্তি';
        partyName = 'সমবায় সঞ্চয় ফান্ড খতিয়ান';
        partyPhone = user.phone || '';
      }
      // Case 7: Qard Hasana Loan Disbursement (In) / Repayment (Out)
      else if (type === 'qard_loan_disbursment' || type === 'loan_disbursment') {
        iconType = 'loan';
        avatarTheme = 'emerald';
        categoryTag = 'কর্জ ঋণ গ্রহণ';
        serviceTitle = 'কর্জে হাসানা ঋণ মঞ্জুরি';
        partyName = 'AMB কর্জে হাসানা ফান্ড';
      } else if (type === 'loan_repayment' || type === 'qard_loan_repayment') {
        iconType = 'loan';
        avatarTheme = 'indigo';
        categoryTag = 'ঋণ কিস্তি পরিশোধ';
        serviceTitle = 'কর্জে হাসানা ঋণ কিস্তি পরিশোধ';
        partyName = 'AMB কর্জে হাসানা ফান্ড';
      } else if (type === 'qard_donation') {
        iconType = 'loan';
        avatarTheme = 'purple';
        categoryTag = 'কর্জ অনুদান';
        serviceTitle = 'কর্জে হাসানা ফান্ডে অনুদান';
        partyName = 'AMB কর্জে হাসানা ফান্ড';
      }
      // Case 8: Withdraw / Cash Out
      else if (type === 'withdraw' || type === 'cashout') {
        iconType = 'withdraw';
        avatarTheme = 'rose';
        categoryTag = 'ক্যাশআউট';
        serviceTitle = 'টাকা উত্তোলন (Withdraw)';
        partyName = tx.paymentMethod || 'এজেন্ট ক্যাশআউট পয়েন্ট';
        partyPhone = tx.senderInfo || tx.phone || '';
      }
      // Case 9: Penalty / Fine
      else if (desc.includes('জরিমানা') || desc.includes('লেট ফি') || desc.includes('পেনাল্টি')) {
        iconType = 'fine';
        avatarTheme = 'rose';
        categoryTag = 'বিলম্ব জরিমানা';
        serviceTitle = 'অটো জরিমানা ও বিলম্ব ফি কর্তন';
        partyName = 'AMB শৃঙ্খলা ফান্ড';
      }
      // Case 10: Cashback / Bonus
      else if (desc.includes('ক্যাশব্যাক') || desc.includes('বোনাস') || desc.includes('পুরস্কার')) {
        iconType = 'cashback';
        avatarTheme = 'purple';
        categoryTag = 'ক্যাশব্যাক বোনাস';
        serviceTitle = 'রিচার্জ ও লেনদেন ক্যাশব্যাক';
        partyName = 'AMB রিওয়ার্ড ওয়ালেট';
      }
      // Default
      else {
        serviceTitle = tx.typeLabel || 'AMB ওয়ালেট লেনদেন';
        partyName = tx.userName || 'AMB ডিজিটাল ওয়ালেট';
        partyPhone = tx.phone || '';
      }

      return {
        ...tx,
        isCredit,
        txBalance,
        partyName,
        partyPhone,
        partyMemberId,
        partyProfilePic,
        serviceTitle,
        categoryTag,
        avatarTheme,
        iconType
      };
    });

    return listWithBalance;
  }, [transactions, user.balance, userMap, user.phone]);

  // Filter and search
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter((tx) => {
      // 1. Status filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) {
        return false;
      }

      // 2. Category / Type filter
      if (filterType === 'in' && !tx.isCredit) return false;
      if (filterType === 'out' && tx.isCredit) return false;
      if (filterType === 'transfer' && tx.iconType !== 'send' && tx.iconType !== 'receive') return false;
      if (filterType === 'add_money' && tx.iconType !== 'add_money') return false;
      if (filterType === 'recharge' && tx.iconType !== 'telecom') return false;
      if (filterType === 'savings' && tx.iconType !== 'savings') return false;
      if (filterType === 'loan' && tx.iconType !== 'loan') return false;
      if (filterType === 'shop' && tx.iconType !== 'shop') return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (tx.serviceTitle || '').toLowerCase().includes(q);
        const matchParty = (tx.partyName || '').toLowerCase().includes(q);
        const matchPhone = (tx.partyPhone || '').toLowerCase().includes(q);
        const matchMemberId = (tx.partyMemberId || '').toLowerCase().includes(q);
        const matchTrxId = (tx.transactionId || tx.id || '').toLowerCase().includes(q);
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchTag = (tx.categoryTag || '').toLowerCase().includes(q);

        if (!matchTitle && !matchParty && !matchPhone && !matchMemberId && !matchTrxId && !matchDesc && !matchTag) {
          return false;
        }
      }

      return true;
    });
  }, [processedTransactions, filterType, statusFilter, searchQuery]);

  // Overall metrics
  const totalIn = useMemo(() => {
    return processedTransactions
      .filter((t) => t.status === 'success' && t.isCredit)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [processedTransactions]);

  const totalOut = useMemo(() => {
    return processedTransactions
      .filter((t) => t.status === 'success' && !t.isCredit)
      .reduce((sum, t) => sum + (Number(t.totalDeducted || t.amount) || 0), 0);
  }, [processedTransactions]);

  // Avatar Icon Renderer
  const renderAvatar = (tx: (typeof processedTransactions)[0]) => {
    // If user has a real profile pic
    if (tx.partyProfilePic && tx.partyProfilePic.startsWith('http')) {
      return (
        <div className="relative shrink-0">
          <img
            src={tx.partyProfilePic}
            alt={tx.partyName}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 shadow-xs ${
              tx.isCredit ? 'border-emerald-500/80 ring-2 ring-emerald-100' : 'border-rose-500/80 ring-2 ring-rose-100'
            }`}
          />
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-xs ${
              tx.isCredit ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {tx.isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          </div>
        </div>
      );
    }

    // Branded Service Badges / Themed Icon
    const themeColors: Record<string, { bg: string; text: string; ring: string; border: string }> = {
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100', border: 'border-emerald-200' },
      rose: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-100', border: 'border-rose-200' },
      blue: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-100', border: 'border-sky-200' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100', border: 'border-amber-200' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-100', border: 'border-purple-200' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-100', border: 'border-indigo-200' },
      slate: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200', border: 'border-slate-300' }
    };

    const color = themeColors[tx.avatarTheme] || themeColors.emerald;

    // Specific icon per type
    let IconComp = Wallet;
    if (tx.iconType === 'send') IconComp = ArrowUpRight;
    else if (tx.iconType === 'receive') IconComp = ArrowDownLeft;
    else if (tx.iconType === 'add_money') IconComp = Wallet;
    else if (tx.iconType === 'telecom') IconComp = Smartphone;
    else if (tx.iconType === 'shop') IconComp = ShoppingBag;
    else if (tx.iconType === 'savings') IconComp = Coins;
    else if (tx.iconType === 'loan') IconComp = Building2;
    else if (tx.iconType === 'fine') IconComp = AlertTriangle;
    else if (tx.iconType === 'cashback') IconComp = Gift;

    // If it's a person without a pic, display first letter of name in bold
    const firstChar = tx.partyName ? tx.partyName.trim().charAt(0) : '';

    return (
      <div className="relative shrink-0">
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border ${color.border} ${color.bg} ${color.text} shadow-xs ring-2 ${color.ring}`}
        >
          {tx.iconType === 'send' || tx.iconType === 'receive' ? (
            <span className="text-base sm:text-lg font-black">{firstChar || <UserIcon className="w-5 h-5" />}</span>
          ) : (
            <IconComp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          )}
        </div>
        <div
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-xs ${
            tx.isCredit ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {tx.isCredit ? <ArrowDownLeft className="w-3 h-3 stroke-[2.5]" /> : <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-150 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4 font-sans text-left"
    >
      {/* 1. Header & Live Account Statement Summary */}
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-850">আমার লেনদেন ও স্টেটমেন্ট খতিয়ান</h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                লাইভ সিঙ্ক
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              আপনার অ্যাকাউন্টের সকল লেনদেন, জমা-খরচ ও রসিদ হিস্টোরি
            </p>
          </div>
        </div>

        {/* Current Available Balance Capsule */}
        <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-xs">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <div className="text-right">
            <p className="text-[9px] text-slate-300 font-medium leading-none">বর্তমান ওয়ালেট ব্যালেন্স</p>
            <p className="text-xs sm:text-sm font-black font-mono text-emerald-400 leading-tight">
              ৳{(Number(user.balance) || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Three Metric Stat Badges (Total, In/Deposit, Out/Expense) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Metric 1: Total Count */}
        <div className="bg-slate-50 border border-slate-150 p-2.5 sm:p-3 rounded-2xl text-left space-y-0.5">
          <div className="flex items-center gap-1 text-slate-450 text-[10px] sm:text-xs font-bold">
            <Receipt className="w-3.5 h-3.5 text-slate-600" />
            <span>মোট লেনদেন</span>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-800 font-mono">
            {processedTransactions.length} <span className="text-[10px] font-medium text-slate-500">টি</span>
          </p>
        </div>

        {/* Metric 2: Total In / Credit */}
        <div className="bg-emerald-50/70 border border-emerald-150 p-2.5 sm:p-3 rounded-2xl text-left space-y-0.5">
          <div className="flex items-center gap-1 text-emerald-800 text-[10px] sm:text-xs font-bold">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>মোট জমা (+)</span>
          </div>
          <p className="text-xs sm:text-sm md:text-base font-black text-emerald-700 font-mono">
            +৳{totalIn.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Metric 3: Total Out / Debit */}
        <div className="bg-rose-50/70 border border-rose-150 p-2.5 sm:p-3 rounded-2xl text-left space-y-0.5">
          <div className="flex items-center gap-1 text-rose-800 text-[10px] sm:text-xs font-bold">
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            <span>মোট খরচ (-)</span>
          </div>
          <p className="text-xs sm:text-sm md:text-base font-black text-rose-700 font-mono">
            -৳{totalOut.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* 3. Search Bar & Status Filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, মোবাইল নম্বর, TrxID বা লেনদেনের বিবরণ খুঁজুন..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills (Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none no-scrollbar">
          {[
            { id: 'all', label: 'সকল লেনদেন', count: processedTransactions.length },
            { id: 'in', label: 'জমা / ইন (+)', count: processedTransactions.filter((t) => t.isCredit).length },
            { id: 'out', label: 'খরচ / আউট (-)', count: processedTransactions.filter((t) => !t.isCredit).length },
            { id: 'transfer', label: '💸 সেন্ড মানি', count: processedTransactions.filter((t) => t.iconType === 'send' || t.iconType === 'receive').length },
            { id: 'add_money', label: '💳 এড মানি', count: processedTransactions.filter((t) => t.iconType === 'add_money').length },
            { id: 'recharge', label: '📱 রিচার্জ', count: processedTransactions.filter((t) => t.iconType === 'telecom').length },
            { id: 'savings', label: '🪙 সমবায় সঞ্চয়', count: processedTransactions.filter((t) => t.iconType === 'savings').length },
            { id: 'loan', label: '🤝 কর্জে হাসানা', count: processedTransactions.filter((t) => t.iconType === 'loan').length },
            { id: 'shop', label: '🛍️ সুপার শপ', count: processedTransactions.filter((t) => t.iconType === 'shop').length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                filterType === tab.id
                  ? 'bg-emerald-800 text-white shadow-xs scale-102'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-650'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                  filterType === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Transactions List (bKash Style) */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-50/70 rounded-3xl border border-dashed border-slate-200 space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Receipt className="w-6 h-6" />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-bold">কোনো লেনদেনের তথ্য পাওয়া যায়নি</p>
          <p className="text-[11px] text-slate-400">
            {searchQuery ? 'আপনার অনুসন্ধানের সাথে মিল রেখে কোনো লেনদেন নেই।' : 'আপনার অ্যাকাউন্টে এখনো কোনো লেনদেন সম্পন্ন হয়নি।'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
          {filteredTransactions.map((tx, idx) => {
            let timeStr = '';
            let dateStr = '';
            try {
              const d = new Date(tx.createdAt);
              timeStr = d.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
              dateStr = d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch (e) {
              timeStr = tx.createdAt;
            }

            const cleanTrxId = tx.trxId ? String(tx.trxId).toUpperCase() : formatShortTrxId(tx.transactionId || tx.receiptNo || tx.id);

            return (
              <div
                key={`${tx.id}-${idx}`}
                onClick={() => onSelectTransaction(tx)}
                className="p-3.5 sm:p-4 bg-white hover:bg-slate-50/90 border border-slate-150 hover:border-emerald-300 transition-all duration-150 rounded-2xl sm:rounded-3xl shadow-2xs hover:shadow-sm cursor-pointer group relative"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Avatar & User / Service Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {renderAvatar(tx)}

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Name & Badge Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[200px] sm:max-w-xs group-hover:text-emerald-800 transition-colors">
                          {tx.partyName}
                        </h4>
                        
                        <span
                          className={`text-[9.5px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                            tx.status === 'success'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : tx.status === 'failed'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                          }`}
                        >
                          {tx.status === 'success' ? 'সফল' : tx.status === 'failed' ? 'বাতিল' : 'অপেক্ষমাণ'}
                        </span>
                      </div>

                      {/* Phone & ID or Service Subtitle */}
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-medium flex-wrap">
                        {tx.partyPhone && (
                          <span className="font-mono text-slate-700 font-bold">{tx.partyPhone}</span>
                        )}
                        {tx.partyMemberId && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-mono">আইডি: {tx.partyMemberId}</span>
                          </>
                        )}
                        {!tx.partyPhone && !tx.partyMemberId && (
                          <span className="text-slate-600 font-medium">{tx.serviceTitle}</span>
                        )}
                      </div>

                      {/* TrxID, Tag & Date */}
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-450 flex-wrap pt-0.5">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold text-[9.5px]">
                          {tx.categoryTag}
                        </span>
                        <span>•</span>
                        <span className="font-mono font-semibold text-slate-600">TrxID: {cleanTrxId}</span>
                        <span>•</span>
                        <span>{dateStr}, {timeStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Ending Balance */}
                  <div className="text-right shrink-0 space-y-1">
                    <div className="font-mono">
                      <span
                        className={`text-sm sm:text-base font-black tracking-tight ${
                          tx.isCredit ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.isCredit ? '+' : '-'} ৳{(Number(tx.totalDeducted || tx.amount) || 0).toLocaleString('bn-BD', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    {/* Calculated Balance After Transaction */}
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                      <span className="text-slate-400">ব্যালেন্স: </span>
                      <span className="font-bold text-slate-700 font-mono">
                        ৳{(Number(tx.txBalance) || 0).toLocaleString('bn-BD', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-0.5 text-[10px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>রসিদ দেখুন</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
export default UserTransactionsStatement;
