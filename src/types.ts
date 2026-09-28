export interface User {
  id?: string;
  uid: string;
  name: string;
  phone: string;
  normalizedPhone?: string;
  memberId: string;
  password?: string; // Account security password (entered on initial / fresh login)
  pin: string; // Stored PIN (e.g., 4-digit number)
  pinSet?: boolean;
  isPendingPin?: boolean;
  role: 'user' | 'admin' | 'sub_admin';
  subAdminPermissions?: string[]; // Array of permitted section IDs in Admin Panel
  balance: number; // Deposit-able wallet balance (Samity)
  mainBalance?: number; // Primary main balance
  lockedBalance?: number; // Escrow locked balance
  pendingBalance?: number; // Escrow pending balance
  telecomBalance?: number; // AMB Telecom balance
  superShopBalance?: number; // AMB Super Shop balance
  savings: number; // Accumulated savings
  dueLoan: number; // User's outstanding loan
  nid?: string;
  nidNumber?: string;
  userName?: string;
  birthReg?: string;
  fatherName?: string;
  motherName?: string;
  gender?: string;
  occupation?: string;
  profession?: string;
  alternatePhone?: string;
  emergencyPhone?: string;
  memberCategory?: 'regular' | 'investor' | 'shareholder';
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  nomineeNid?: string;
  createdByUid?: string;
  createdByMemberId?: string;
  createdByMemberName?: string;
  referrerMemberId?: string;
  dob?: string;
  division?: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  country?: string;
  village?: string;
  profilePic?: string;
  photoURL?: string;
  phoneChangeCount?: number;
  status?: 'active' | 'inactive';
  approved?: boolean; // Whether the user's account is verified and approved by admin
  membershipApproved?: boolean; // Whether member application is approved
  samityStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  samityApproved?: boolean;
  isSamityMember?: boolean;
  samityAppliedAt?: string;
  samityRejectReason?: string;
  createdAt: string;
  updatedAt?: any;
  isPermanent?: boolean; // Lifetime permanent account: never deleted, never lost
  permanentLifetimeAccount?: boolean; // Explicit flag indicating permanent existence
  lifetimeProtected?: boolean; // Protected from deletion or accidental removal
  cardLocked?: boolean; // Virtual Card Lock State
  hasSetProfile?: boolean; // User profile information has been set (locked for editing)
  nidFrontPic?: string;
  nidBackPic?: string;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  kycStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  memberGroup?: 'general' | 'admin' | 'need'; // Qard Group
  dpsBalance?: number; // Accumulated DPS balance
  profitsBalance?: number; // Shared/Accumulated Co-op Profits
  email?: string; // Optional email for admin logins
  monthlySavingsTarget?: number; // User's custom or selected monthly savings target (min 500)
  biometricsEnabled?: boolean; // Whether physical/virtual biometrics are enabled
  fingerprintType?: 'display' | 'side'; // Preferred fingerprint scanner layout
  biometricCredentialId?: string; // Stored Credential ID for WebAuthn authentication
  isDemo?: boolean; // Whether user is a Guest/Demo preview session
  shares?: number; // Accumulated equity shares (1,000 savings = 1 share)
  lastPaidMonth?: string; // Last month paid for auto-debit (YYYY-MM)
  samityPaidMonths?: string[]; // Array of paid month keys (e.g., ['jan', 'feb', ...]) or numbers
  referredBy?: string; // Member ID or phone who referred this user
  customTelecomPercent?: number; // Personalized telecom recharge commission percentage
  isVirtualSomitiTarget?: boolean;
  phoneNumber?: string;
  currentDeviceId?: string; // Device ID locked to this account
  deviceFingerprint?: string; // Hardware/Platform device fingerprint for App+Web session match
  activeDeviceTokens?: string[]; // Array of active device IDs / fingerprints authorized on this device
  deviceType?: 'app' | 'web' | 'both'; // Device platform type
  requestedDeviceId?: string; // New Device ID requested by the user
  deviceLockBypassed?: boolean; // Whether device lock is bypassed for this user
  deviceChangeRequested?: boolean; // Whether the user requested a device change approval
  deviceChangeRequestedAt?: string; // Timestamp when device change was requested
  isLoggedIn?: boolean; // Active logged in state for real-time zero device force logout
  forceLogoutAt?: string; // Force logout timestamp set by admin to force instant logout
  sessionLoggedInAt?: string; // Session login timestamp on the client side
  ambCardNumber?: string;
  ambAccountNumber?: string;
  ambCardHolderName?: string;
  ambCardExpiry?: string;
  ambCardCvv?: string;
  ambCardStatus?: 'active' | 'inactive';
  ambCardIssuedAt?: string;
  ambCardOtpLocked?: boolean;
  savedAmbCards?: SavedAmbCard[];
  latitude?: number;
  longitude?: number;
  fullAddress?: string;
  locationLastUpdated?: string;
  deviceStatus?: 'Online' | 'Offline' | string;
  samitySchemeActive?: boolean;
  samityAutoSavingsActive?: boolean;
  samityDeactivateStatus?: 'pending' | 'approved' | 'rejected' | 'released' | 'self_opted_out' | 'active' | string;
  samityDeactivateReason?: string;
  samityDeactivateRequestedAt?: string;
  samitySwitchStatus?: 'ON' | 'OFF';
  samityOptOutReason?: string;
  samityOptInReason?: string;
  samityOptOutDate?: string;
  samitySwitchLastUpdated?: string;
  canDisableAutoSavings?: boolean; // Admin permission to allow member to turn off auto savings
  allowAutoSavingsToggle?: boolean; // Alias for admin permission
  lastDecSettlementYear?: number; // Track December annual savings return year
  dueMonths?: number;
  lastCoopInstantLoanAt?: string; // Timestamp of last instant 50% coop loan
  lastCoopInstantLoanAmount?: number; // Amount of last instant loan
  lastCoopLoanPercentage?: number; // Percentage of savings taken (e.g. 1-25% or 25-50%)
  lastCoopInstantLoanRepaidAt?: string; // Timestamp when instant loan was fully repaid (cooldown starts from this date)
  lastAutoDeductedMonth?: string; // YYYY-MM string to track monthly auto-deduction
  instantLoanDurationMonths?: number; // Chosen duration (1, 2, or 3 months)
  instantLoanOriginalAmount?: number; // Original instant loan principle
  instantLoanTakenAt?: string; // ISO timestamp when instant loan was disbursed
  loanDuration?: number; // Qard loan duration (1 or 3 months)
  loanTakenAt?: string; // Qard loan taken timestamp
  lastQardDueReminderCycle?: string; // Qard reminder cycle tracker
  lastQardFineDate?: string; // Qard fine date tracker
  totalQardFine?: number; // Accumulated Qard late fine
  isAppLocked?: boolean; // 2nd Step custom Secret App Lock active status
  appLockCode?: string; // Custom 6-12 character/digit secret lock code
  appLockUpdatedAt?: string; // Timestamp of last app lock update
  appLockResetRequested?: boolean; // Whether user requested admin to unlock/reset app lock
  appLockResetRequestedAt?: string; // Timestamp of app lock reset request
  appLockResetStatus?: 'pending' | 'approved' | 'rejected'; // Admin approval status for app lock reset
  appLockResetReason?: string; // Optional message or note for unlock request
  agreedNoticeIds?: string[]; // Array of mandatory notice IDs the user consented to
  noticeResponses?: Record<string, { agreed: boolean; respondedAt: string; feedbackText?: string }>;
  activeCardOtp?: string;
  activeCardOtpAmount?: number;
  activeCardOtpRequester?: string;
  activeCardOtpTime?: string;
  group?: string;
  isDemoUser?: boolean;
  cashback?: number;
}

export interface BankAccount {
  id: string;
  name: string;
  acronym: string;
  branch?: string;
  routingNum?: string;
  holder: string;
  accNum: string;
  visaNum?: string;
  active: boolean;
  bgClass?: string;
  textClass?: string;
  logoBgClass?: string;
  isInternational?: boolean;
  isMobileBank?: boolean;
  sendMoneyActive?: boolean;
  qrCodeUrl?: string;
  iban?: string;
  swiftCode?: string;
  currency?: string;
  country?: string;
  customRate?: number;
  exchangeRate?: number;
  transferFee?: number;
}

export interface MandatoryNoticeSlide {
  id: string;
  badge?: string; // e.g. "নতুন নিয়ম"
  iconType?: 'rules' | 'security' | 'limits' | 'handshake' | 'announcement' | 'custom';
  customImageUrl?: string;
  title: string;
  description?: string;
  bulletPoints?: string[];
  footerNote?: string;
}

export interface MandatoryNoticeConsent {
  id: string; // unique notice ID e.g. "notice_rule_2026_v1"
  active: boolean;
  type: 'rules_consent' | 'poll_feedback' | 'announcement';
  categoryBadge: string; // e.g. "নতুন নিয়ম" বা "সদস্য মতামত"
  title: string; // e.g. "নতুন নিয়মে আপনার অনুমতি প্রয়োজন"
  introText: string; // e.g. "আমাদের সেবার মান উন্নয়ন এবং সদস্যদের নিরাপত্তা নিশ্চিত করতে কিছু নতুন নিয়ম ও আপডেট আনা হয়েছে। অনুমতি দেওয়ার আগে অনুগ্রহ করে সম্পূর্ণ পড়ুন।"
  startButtonText?: string; // e.g. "চলুন দেখি"
  startCaption?: string; // e.g. "আপনি না বলা পর্যন্ত এটি বারবার আসবে"
  slides: MandatoryNoticeSlide[];
  finalQuestion: string; // e.g. "আপনি কি উপরোক্ত নতুন নিয়ম ও শর্তাবলী মেনে নিতে সম্মত?"
  agreeButtonText: string; // e.g. "হ্যাঁ, আমি সম্মত"
  disagreeButtonText?: string; // e.g. "না, আমি সম্মত নই"
  allowFeedbackComment?: boolean; // if true, allows member to type optional feedback message
  feedbackPlaceholder?: string;
  successTitle?: string; // e.g. "ধন্যবাদ!"
  successMessage?: string; // e.g. "আপনি নতুন নিয়মে সম্মতি দিয়েছেন। এখন থেকে আপনি আমাদের সকল সেবা উপভোগ করতে পারবেন।"
  disagreeTitle?: string; // e.g. "আপনি সম্মত হননি"
  disagreeMessage?: string; // e.g. "আপনি নতুন নিয়মে সম্মতি না দেওয়ায় কিছু সেবা সীমিত থাকতে পারে। আপনি চাইলে পরে প্রোফাইল থেকে নিয়মগুলো পড়ে সম্মতি দিতে পারবেন।"
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface MandatoryNoticeMemberResponse {
  id?: string;
  docId?: string;
  noticeId: string;
  userId: string;
  userName: string;
  memberId: string;
  phone?: string;
  agreed: boolean;
  feedbackText?: string;
  respondedAt: string;
}

export interface DeviceReleaseRequest {
  id?: string;
  docId?: string;
  userId: string;
  userName: string;
  userPhone: string;
  memberId: string;
  reason: string;
  details?: string;
  requestedDeviceId?: string;
  lockedDeviceId?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNote?: string;
}

export interface ExchangeOrder {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhone: string;
  acceptorId?: string;
  acceptorName?: string;
  acceptorPhone?: string;
  status: 'pending' | 'accepted' | 'waiting_payment' | 'payment_sent' | 'payment_received' | 'second_payment_pending' | 'completed' | 'cancelled' | 'expired' | 'disputed';
  giveMethod: string;
  takeMethod: string;
  amount: number;
  rate: number;
  charge: number;
  createdAt: string;
  timerStartedAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  memberId: string;
  type: 'deposit' | 'add_money' | 'remittance' | 'loan_repayment' | 'loan_disbursment' | 'coop_loan_apply' | 'interest' | 'telecom_recharge' | 'telecom_add_balance' | 'shop_purchase' | 'utility' | 'fee_payment' | 'balance_transfer' | 'received_transfer' | 'withdraw' | 'transfer' | 'qard_donation' | 'qard_loan_request' | 'qard_loan_disbursment' | 'qard_loan_repayment' | 'money_exchange' | 'qard_withdrawal' | 'coop_savings_deposit' | 'samity_deposit' | string;
  typeLabel: string; // Bengali label of type
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'approved' | 'rejected' | 'completed' | 'on_hold' | 'cancelled' | string;
  description: string;
  createdAt: string;
  operator?: string;
  recipientNumber?: string;
  senderName?: string;
  providerName?: string;
  billCategory?: string;
  meterNumber?: string;
  date?: string;
  time?: string;
  adminNote?: string;
  userPhoto?: string;
  photoURL?: string;
  paymentMethod?: string;  // bKash, Nagad, Rocket, CellFin, DBBL Bank
  senderInfo?: string;     // Sender number or sender account name
  transactionId?: string;  // Transaction TXN ID
  screenshot?: string;     // Base64-encoded image proof of payment
  paymentDate?: string;    // Placed payment date (YYYY-MM-DD)
  receiptNo?: string;      // Auto generated receipt number, e.g. REC-1718290333
  receiverUid?: string;    // Receiver's UID for pending transfers
  receiverId?: string;     // Receiver's Member ID for pending transfers
  receiverName?: string;   // Receiver's display name
  transferSector?: 'telecom' | 'shop' | 'samity'; // Transfer sector choice
  docId?: string;          // Real Firestore document ID for updates/deletes
  loanDuration?: number;   // Duration of loan in months
  whatsappNumber?: string; // WhatsApp number for loan request
  monthlyRepayAmount?: number; // Repayment amount they wish to pay per month
  adminNotice?: string;    // Custom notice from admin (e.g. pending/reject reason)
  userComment?: string;    // User comment or feedback
  category?: string;       // Category marker (e.g. coop_instant_auto_loan)
  senderBankName?: string;
  rechargeCommission?: number; // Calculated commission during transaction submission
  rechargeCashback?: number; // Calculated cashback for specific amount rules
  balanceAfter?: number;   // Balance after transaction execution
  postBalance?: number;    // Balance snapshot alias
  balanceBefore?: number;  // Balance before transaction execution
  userPhone?: string;
  senderPhone?: string;
  senderNumber?: string;
  userMemberId?: string;
  receiptImage?: string;
  phone?: string;
  accountNumber?: string;
  phoneNumber?: string;
  trxId?: string;
  rejectReason?: string;
  processedAt?: string;
  approvedAt?: string;
  totalDeducted?: number;
  charge?: number;
  fee?: number;
  adminProfit?: number;
  companyProfit?: number;
  profitAmount?: number;
  profitNote?: string;
  foreignAmount?: number;
  foreignCurrency?: string;
  exchangeRate?: number;
  bdtAmount?: number;
  remittanceIncentiveRate?: number;
  remittanceIncentiveAmount?: number;
  remittanceFee?: number;
  remittanceTransferFee?: number;
  totalRemittancePayout?: number;
  beneficiaryBankName?: string;
  beneficiaryAccountNo?: string;
  beneficiaryName?: string;
  beneficiaryBranch?: string;
  beneficiaryDistrict?: string;
  beneficiaryPhone?: string;
  beneficiaryRelation?: string;
  approvedCashback?: number;
  extraCommission?: number;
  title?: string;
  receiverPhone?: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  section?: 'general' | 'telecom' | 'safe_deal' | 'samity' | 'bank' | 'shop';
  createdAt: string;
}

export interface AdminBroadcastLog {
  id: string;
  docId?: string;
  actionType: 'bonus' | 'fine' | 'notice';
  targetType: 'all' | 'single';
  targetUserName: string;
  targetUserPhone?: string;
  targetUserId?: string;
  amount: number;
  title: string;
  message: string;
  sentBy?: string;
  status?: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  docId?: string;
  title: string;
  operator: string; // GP, Robi, Airtel, Banglalink, Teletalk, Skitto, Brilliant, Alaap
  category: 'internet' | 'minute' | 'bundle';
  validity: string;
  price: number;
  regularPrice?: number;
  commission?: number; // Commission amount in ৳
  isHot: boolean;
  createdAt: string;
}

export interface BapReport {
  id: string;
  accusedName: string;
  accusedPhone: string;
  accusedPhoto?: string;
  type: 'fraud' | 'late_payment' | 'warning' | 'suspicious';
  details: string;
  proofScreenshot?: string;
  createdAt: string;
  reporterName: string;
  reporterId: string;
  groupName: string;
  status?: 'pending' | 'solved';
  editHistory?: { editedAt: string; previousDetails: string; editedBy: string }[];
  auditLogs?: string[];
}

export interface BapGroup {
  id: string;
  name: string;
  link: string;
  category: string;
  adminsInfo: string;
  memberCount: number;
  foundedDate: string;
  status: 'pending' | 'verified' | 'rejected';
  verificationId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface BapAdminRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  groupName: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ReceiptTypeConfig {
  themeColor?: 'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate';
  headerTitle?: string;
  badgeText?: string;
  noticeText?: string;
}

export interface ReceiptConfig {
  headerTitle?: string;
  companyName?: string;
  organizationDetails?: string;
  officialTagText?: string;
  adminSignatureName?: string;
  adminSignatureTitle?: string;
  footerVerificationText?: string;
  footerComputerGeneratedText?: string;
  typeConfigs?: {
    add_money?: ReceiptTypeConfig;
    send_money?: ReceiptTypeConfig;
    withdraw?: ReceiptTypeConfig;
    telecom_recharge?: ReceiptTypeConfig;
    shop_purchase?: ReceiptTypeConfig;
    deposit?: ReceiptTypeConfig;
    qard_loan?: ReceiptTypeConfig;
    [key: string]: ReceiptTypeConfig | undefined;
  };
}

export interface CompanyFundAccount {
  id: string;
  accountName: string; // e.g. "আমার একাউন্ট (আব্দুল্লাহ)", "বউয়ের একাউন্ট", "ভাইয়ের একাউন্ট", "ইসলামী ব্যাংক"
  accountType?: string; // e.g. "ব্যক্তিগত", "ব্যাংক", "বিকাশ", "নগদ", "রকেট", "ক্যাশ হাতে"
  accountDetails?: string; // e.g. "AC: 1234567890", "মোবাইল: 01700000000"
  amount: number;
  note?: string;
  updatedAt?: string;
}

export interface MasterFundAccount {
  id: string;
  accountName: string; // e.g. "উত্তরা ৩ কাঠা জমি বায়না", "ইসলামী ব্যাংক সঞ্চয়ী হিসাব", "২০ ভরি স্বর্ণ ক্রয়", "ব্যবসা ইনভেস্টমেন্ট"
  category: 'land' | 'gold' | 'bank' | 'business' | 'cash' | 'receivable' | 'mfs' | 'other';
  holderName?: string; // কার কাছে আছে / কার নামে / দায়িত্বপ্রাপ্ত ব্যক্তির নাম
  holderPhone?: string; // মোবাইল নম্বর
  accountNumber?: string; // দলিল নম্বর / ব্যাংক একাউন্ট / রসিদ নং
  location?: string; // অবস্থান / ঠিকানা
  amount: number; // টাকার পরিমাণ
  note?: string; // অতিরিক্ত বিবরণ / নোট
  updatedAt?: string;
}

export interface QardRuleItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  isWarning?: boolean;
}

export interface QardVerificationNotice {
  title: string;
  body: string;
  warningNote?: string;
}

export interface QardEligibilityConfig {
  requiredActiveDays: number;
  requiredAmbTxVolume: number;
  trackerTitle?: string;
  trackerSubtitle?: string;
}

export interface QardCoopInstantLoanConfig {
  enabled: boolean;
  percentage: number;
  maxDurationMonths: number;
  cooldownDays: number;
  title?: string;
  description?: string;
  takeStartDay?: number; // Start day of month for loan taking (default 1)
  takeEndDay?: number;   // End day of month for loan taking (default 31 - any day)
  autoDeductStartDay?: number; // Start day of month for auto deduction (default 1)
  autoDeductEndDay?: number;   // End day of month for auto deduction (default 31 - 30 days cycle)
  month1Ratio?: number; // 1st installment % for 3 months (default 33.34)
  month2Ratio?: number; // 2nd installment % for 3 months (default 33.33)
  month3Ratio?: number; // 3rd installment % for 3 months (default 33.33)
}

export interface QardGoldLoanConfig {
  enabled?: boolean;
  protectionMonths?: number; // default 3 (admin can increase or decrease!)
  protectionDays?: number; // default 90 (admin can increase or decrease!)
  equalMarketPrice?: boolean; // true = 100% equal market price (no extra +500)
  extraBenefit?: number; // 0
  noticeTitle?: string;
  noticeSubtitle?: string;
  rates?: {
    k24?: number;
    k22?: number;
    k21?: number;
    k18?: number;
    traditional?: number;
  };
  guidelines?: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
  }>;
}

export interface QardConfig {
  baseFund?: number;
  rulesTitle?: string;
  rulesSubtitle?: string;
  rulesList?: QardRuleItem[];
  verificationNotice?: QardVerificationNotice;
  eligibilityConfig?: QardEligibilityConfig;
  minLoanAmount?: number;
  maxLoanAmount?: number;
  maxDurationMonths?: number;
  coopInstantLoanConfig?: QardCoopInstantLoanConfig;
  goldLoanConfig?: QardGoldLoanConfig;
}

export interface SamityFineTier {
  id: string;
  fromDay: number;
  toDay: number;
  rangeLabel: string;
  fineText: string;
  fineAmount: number;
  bgClass?: string;
  isDaily?: boolean;
}

export interface MonthFineExemptionConfig {
  isExempted: boolean;
  exemptUntilDay?: number; // e.g. 15, 20, 31 (full month)
  note?: string;
}

export interface SamityPolicyConfig {
  policyTitle?: string;
  policySubTitle?: string;
  schemeStatusNote?: string;
  fixedAmountTitle?: string;
  fixedAmountNote?: string;
  penaltyTitle?: string;
  penaltyTiers?: SamityFineTier[];
  customRules?: string[];
  pausePenaltyUntil15th?: boolean;
  penaltyExemptionUntilDay?: number;
  penaltyExemptionNote?: string;
  defaultGracePeriodDays?: number; // default 9 (1-9th free)
  exemptedMonths?: Record<string, boolean>; // e.g. { "2026-08": true, "2026-09": true }
  exemptedMonthsConfig?: Record<string, MonthFineExemptionConfig>;
}

export type SamityInvestmentCategory = 'gold' | 'land' | 'agro' | 'business' | 'other';
export type SamityInvestmentStatus = 'active' | 'sold' | 'new';

export interface SamityInvestmentComment {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  comment: string;
  createdAt: string;
  editedAt?: string;
}

export interface SamityInvestment {
  id: string;
  title: string;
  category: SamityInvestmentCategory;
  categoryLabel?: string;
  status: SamityInvestmentStatus; // active = চলমান, sold = সফল বিক্রয় ও লাভ, new = নতুন শুরু
  description: string; // ফেসবুক পোস্টের মতো ক্যাপশন ও বিস্তারিত বর্ণনা
  imageUrl?: string;
  imageUrls?: string[];
  buyAmount: number; // ক্রয় মূল্য / ইনভেস্টের টাকা
  sellAmount?: number; // বিক্রয় মূল্য / বর্তমান বাজারদর
  profitAmount?: number; // অর্জিত মুনাফা / লাভ
  roiPercentage?: number; // লভ্যাংশ শতকরা হার (%)
  location?: string; // প্রজেক্ট লোকেশন / স্থান
  investmentDate?: string; // ইনভেস্টের তারিখ
  saleDate?: string; // বিক্রয়ের তারিখ
  durationText?: string; // মেয়াদকাল (যেমন: ৬ মাস, ১ বছর)
  likesCount?: number;
  likedBy?: string[]; // user UIDs
  likedUsers?: { uid: string; name: string; memberId?: string; photoURL?: string; reactedAt?: string }[];
  dislikesCount?: number;
  dislikedBy?: string[]; // user UIDs
  dislikedUsers?: { uid: string; name: string; memberId?: string; photoURL?: string; reactedAt?: string }[];
  viewsCount?: number;
  comments?: SamityInvestmentComment[];
  authorName?: string; // ডিফল্ট: "AMB ইনভেস্টমেন্ট বোর্ড / ম্যানেজমেন্ট"
  authorRole?: string; // ডিফল্ট: "সেন্ট্রাল ম্যানেজমেন্ট"
  authorAvatar?: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AppConfig {
  adminPin?: string; // Master admin PIN override
  allowProfileSelfEdit?: boolean; // Whether members are allowed to edit/update their own profile info
  emailMigrationPopupEnabled?: boolean; // Admin ON/OFF switch for old account recovery / email migration pop-up
  phoneChangeConfig?: {
    enabled?: boolean;
    freeDaysAfterRegistration?: number;
    freeAttempts?: number;
    feeIncrement?: number;
    maxFee?: number;
  };
  telecomReportResetAt?: string;
  manualApprovalEnabled?: boolean;
  autoApproveSomiti?: boolean;
  autoApproveSamity?: boolean;
  autoApproveDeviceLocks?: boolean;
  autoApprovePhoneChange?: boolean;
  autoApproveAgentRequests?: boolean;
  autoApproveSamityTxs?: boolean;
  allowManualAgentLocation?: boolean;
  historyRetentionDays?: number; // Configurable History Retention Period (e.g. 30, 90, 180, 365)
  sectionNotices?: Record<string, string>;
  receiptConfig?: ReceiptConfig;
  appName: string;
  personalMfsNumber: string;
  personalBankCard: string;
  supportPhone: string;
  telecomHelplinePhone?: string;
  telecomHelplineFacebook?: string;
  telecomHelplineNotice?: string;
  samityTerms: string;
  samityPolicyConfig?: SamityPolicyConfig;
  tickerText: string;
  noticeText?: string;
  initialCompanyFund?: number;
  samityTicker?: string;
  qardTicker?: string;
  qardConfig?: QardConfig;
  telecomTicker?: string;
  safiTicker?: string;
  escrowTicker?: string;
  rationTicker?: string;
  agentTicker?: string;
  courierTicker?: string;
  gatewayTicker?: string;
  exchangeRatePerThousand: number;
  exchangeRateSaudi?: number;
  // NEW FIELDS
  addMoneyBankCashbackPerThousand?: number;
  sendMoneyMobileBankFlatCharge?: number;
  sendMoneyMobileBankServiceChargePerThousand?: number;
  sendMoneyBankFlatCharge?: number;
  sendMoneyBankServiceChargePerThousand?: number;
  internationalExchangeRate?: number;
  remittanceFee?: number; // Remittance transfer fee / charge (e.g. 10 BDT or 15 BDT)
  companyReserveFund?: number; // Company Gross Starting Reserve Capital
  companyFundAccounts?: CompanyFundAccount[]; // Detailed account breakdown (e.g. spouse, brother, personal, bank)
  masterFundAccounts?: MasterFundAccount[]; // Master Fund detailed account breakdown
  manualFundAdjustments?: Record<string, number>; // Manual overrides/adjustments for company fund balance modules
  // END NEW FIELDS
  logoUrl?: string;
  appLogoUrl?: string;
  serviceStatus?: Record<string, boolean>;
  dashboardBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  qardBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  samityBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  telecomBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  moneyExchangeBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  rationBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  safiBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  agentBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  courierBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  rationMaxSelectLimit?: number;
  rationTitleText?: string;
  rationTotalItemsText?: string;
  escrowCoverUrl?: string;
  mobileRechargePercent?: number;
  alaapRechargePercent?: number;
  brilliantRechargePercent?: number;
  rechargeCashbackRules?: { id?: string; amount: number; cashback: number; operator?: string }[];
  telecomDefaultSlabs?: { amount: number; cashback: number }[];
  telecomOperatorCashbacks?: Record<string, { slab1: number; slab2: number; slab3: number; slab4: number }>;
  mfsBkashNumber?: string;
  mfsBkashActive?: boolean;
  mfsNagadNumber?: string;
  mfsNagadActive?: boolean;
  mfsRocketNumber?: string;
  mfsRocketActive?: boolean;
  mfsUpayNumber?: string;
  mfsUpayActive?: boolean;
  paymentBanks?: {
    id: string;
    name: string;
    acronym: string;
    branch: string;
    routingNum: string;
    holder: string;
    accNum: string;
    visaNum?: string;
    active: boolean;
    bgClass?: string;
    textClass?: string;
    logoBgClass?: string;
    isInternational?: boolean;
    isMobileBank?: boolean;
    sendMoneyActive?: boolean;
    qrCodeUrl?: string;
    iban?: string;
    swiftCode?: string;
    currency?: string;
    country?: string;
    customRate?: number;
    exchangeRate?: number;
    transferFee?: number;
  }[];
  ambToAmbFreeActive?: boolean;
  ambToAmbMinLimit?: number;
  ambToAmbMaxLimit?: number;
  billPayActive?: boolean;
  billPayFeePercent?: number;
  salaryPayActive?: boolean;
  salaryPayFee?: number;
  remittanceRates?: Record<string, number>;
  remittanceTransferFee?: number;
  remittanceCountryFees?: Record<string, number>;
  shopCategories?: { id: string; label: string; }[];
  telecomCategories?: { id: string; label: string; }[];
  telecomServicesConfig?: Record<string, {
    title: string;
    icon?: string;
    subtitle?: string;
    isActive?: boolean;
    cashbackPercent?: number;
  }>;
  moneyExchangeRatesConfig?: {
    enabled?: boolean;
    noticeText?: string;
    flatFee?: number;
    rates?: {
      countryCode: string;
      countryName: string;
      currencyCode: string;
      flagEmoji?: string;
      bdtRate: number;
      minAmount?: number;
      maxAmount?: number;
      cashback?: number;
    }[];
  };
  coopLoanInterestRate?: number;
  remittanceFeePercent?: number;
  globalTexts?: Record<string, string>;
  tickerTextEn?: string; // English translation ticker
  maintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceDescription?: string;
  maintenanceEstimatedTime?: string;
  maintenanceAnimationUrl?: string;
  maintenanceLogoUrl?: string;
  maintenanceBgUrl?: string;
  forceUpdateActive?: boolean;
  minAppVersion?: string;
  latestAppVersion?: string;
  downloadLink?: string;
  updateTitle?: string;
  updateDescription?: string;
  safiProductOverrides?: Record<string, { 
    price: number; 
    stock: string; 
    name?: string; 
    desc?: string; 
    brand?: string; 
    image?: string; 
    emoji?: string; 
  }>;
  sliders?: string[];
  oneSignalAppId?: string;
  oneSignalRestApiKey?: string;
  sectionIcons?: Record<string, string>;
  ambToAmbIconUrl?: string;
  softwareIntegrations?: Record<string, {
    sectionKey: string;
    softwareName: string;
    apiEndpoint: string;
    authToken?: string;
    webhookUrl?: string;
    requestMethod?: string;
    contentType?: string;
    customHeaders?: Record<string, string>;
    mappedFields?: Record<string, string>;
    isActive: boolean;
    lastUpdated?: string;
  }>;
  corporateGuide?: {
    rules: string;
    futurePlans: string;
    mission: string;
    feedback: string;
  };
  bannerHeightType?: 'thin' | 'medium' | 'thick' | 'custom' | '16:9' | '21:9' | '32:9';
  bannerHeightValue?: number; // Custom height in pixels (e.g. 100 to 400)
  bottomNavHeightType?: 'thin' | 'medium' | 'thick';
  bottomNavTabs?: string[]; // list of active tab keys (e.g. ['home', 'deposit', 'add_money', 'history', 'profile'])
  gridColsCount?: number; // 2, 3, 4, 5 columns
  gridIconSize?: 'small' | 'medium' | 'large' | 'custom';
  gridIconSizeValue?: number; // Icon size diameter in pixels
  mandatoryNotice?: MandatoryNoticeConsent;
  mandatoryNoticeResponses?: Record<string, {
    noticeId?: string;
    userId: string;
    userName: string;
    memberId: string;
    phone?: string;
    agreed: boolean;
    feedbackText?: string;
    respondedAt: string;
  }>;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  description: string;
  rating: number;
  minOrder: string;
  supplier: string;
  flag: string;
  shipTime: string;
  createdAt?: string;
  imageUrl?: string;
  oldPrice?: number;
  latitude?: number;
  longitude?: number;
  shopAddress?: string;
}

export interface UserNotification {
  id: string;
  docId?: string;
  userId: string;
  memberId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  isPersonal?: boolean;
  isAdminBroadcast?: boolean;
  isTransactionHistory?: boolean;
  category?: string;
  notifyType?: 'info' | 'credit' | 'debit';
  amount?: number;
  type?: 'bonus' | 'fine' | 'notice' | 'general';
}

export interface PaymentMethod {
  id: string;
  methodName: string; // e.g., 'bKash', 'Nagad', 'DBBL'
  accountName: string;
  accountNumber: string;
  type: 'mfs' | 'bank'; // Mobile Financial Service or Bank
  active: boolean;
}

export interface SavedAmbCard {
  id: string;
  name: string; // e.g. "ভাইয়ের কার্ড"
  cardNumber: string;
  expiry: string; // MM/YY
  cvv: string;
}

export const SAMITY_MONTHS = [
  { id: 'jan', monthNum: 1, name: 'জানুয়ারি', short: 'Jan' },
  { id: 'feb', monthNum: 2, name: 'ফেব্রুয়ারি', short: 'Feb' },
  { id: 'mar', monthNum: 3, name: 'মার্চ', short: 'Mar' },
  { id: 'apr', monthNum: 4, name: 'এপ্রিল', short: 'Apr' },
  { id: 'may', monthNum: 5, name: 'মে', short: 'May' },
  { id: 'jun', monthNum: 6, name: 'জুন', short: 'Jun' },
  { id: 'jul', monthNum: 7, name: 'জুলাই', short: 'Jul' },
  { id: 'aug', monthNum: 8, name: 'আগস্ট', short: 'Aug' },
  { id: 'sep', monthNum: 9, name: 'সেপ্টেম্বর', short: 'Sep' },
  { id: 'oct', monthNum: 10, name: 'অক্টোবর', short: 'Oct' },
  { id: 'nov', monthNum: 11, name: 'নভেম্বর', short: 'Nov' },
  { id: 'dec', monthNum: 12, name: 'ডিসেম্বর', short: 'Dec' },
];

export const SAMITY_YEARS = Array.from({ length: 2050 - 2026 + 1 }, (_, i) => 2026 + i);

export const getEffectivePaidMonthsList = (
  paidMonths: any = [],
  savingsAmount?: number,
  targetMonthlyRate?: number
): string[] => {
  let paidMonthsList: string[] = [];
  let userSavings: number | undefined = savingsAmount;
  let userRate: number | undefined = targetMonthlyRate;

  // Case 1: A User or member object was passed as the first parameter
  if (paidMonths && typeof paidMonths === 'object' && !Array.isArray(paidMonths)) {
    const u = paidMonths;
    if (Array.isArray(u.samityPaidMonths)) {
      paidMonthsList = u.samityPaidMonths;
    }
    if (userSavings === undefined) {
      userSavings = typeof u.savings === 'number' && !isNaN(u.savings)
        ? u.savings
        : (typeof u.dpsBalance === 'number' && !isNaN(u.dpsBalance)
            ? u.dpsBalance
            : Number(u.savings) || Number(u.dpsBalance) || 0);
    }
    if (userRate === undefined) {
      userRate = Number(u.monthlySavingsTarget) || 1000;
    }
  } else if (Array.isArray(paidMonths)) {
    paidMonthsList = paidMonths;
  } else if (typeof paidMonths === 'string' && paidMonths) {
    paidMonthsList = [paidMonths];
  }

  const uniqueSet = new Set<string>();

  // Add all explicit paid month keys from paidMonths array
  if (Array.isArray(paidMonthsList)) {
    paidMonthsList.forEach(key => {
      if (!key || typeof key !== 'string') return;
      const normalizedKey = key.trim().toLowerCase().replace('_', '-');
      if (normalizedKey.includes('-')) {
        uniqueSet.add(normalizedKey);
      } else {
        uniqueSet.add(`2026-${normalizedKey}`);
      }
    });
  }

  // Reconcile with actual deposited savings and monthly installment target rate
  // This guarantees that whatever amount of money is in the member's savings,
  // the exact proportional count of installment months are permanent and paid!
  const rate = Math.max(1, typeof userRate === 'number' && !isNaN(userRate) && userRate > 0 ? userRate : (Number(userRate) || 1000));
  const validSavings = Math.max(0, typeof userSavings === 'number' && !isNaN(userSavings) ? userSavings : (Number(userSavings) || 0));

  if (userSavings !== undefined || (typeof targetMonthlyRate === 'number' && targetMonthlyRate > 0)) {
    const expectedMonthsCount = Math.floor(validSavings / rate);

    // If array has fewer months than paid savings, synthesize chronological months from 2026 onwards
    if (uniqueSet.size < expectedMonthsCount) {
      for (const yr of SAMITY_YEARS) {
        for (const m of SAMITY_MONTHS) {
          if (uniqueSet.size >= expectedMonthsCount) break;
          const k = `${yr}-${m.id}`;
          uniqueSet.add(k);
        }
        if (uniqueSet.size >= expectedMonthsCount) break;
      }
    } else if (uniqueSet.size > expectedMonthsCount && expectedMonthsCount > 0) {
      // Sort chronologically and retain only verified count matching actual money deposited
      const sorted = Array.from(uniqueSet).sort((a, b) => {
        const [yrA, mIdA] = a.split('-');
        const [yrB, mIdB] = b.split('-');
        const yDiff = (Number(yrA) || 2026) - (Number(yrB) || 2026);
        if (yDiff !== 0) return yDiff;
        const idxA = SAMITY_MONTHS.findIndex(m => m.id === mIdA);
        const idxB = SAMITY_MONTHS.findIndex(m => m.id === mIdB);
        return idxA - idxB;
      });
      return sorted.slice(0, expectedMonthsCount);
    }
  }

  // Always return sorted chronologically for consistent UI rendering
  const sorted = Array.from(uniqueSet).sort((a, b) => {
    const [yrA, mIdA] = a.split('-');
    const [yrB, mIdB] = b.split('-');
    const yDiff = (Number(yrA) || 2026) - (Number(yrB) || 2026);
    if (yDiff !== 0) return yDiff;
    const idxA = SAMITY_MONTHS.findIndex(m => m.id === mIdA);
    const idxB = SAMITY_MONTHS.findIndex(m => m.id === mIdB);
    return idxA - idxB;
  });

  return sorted;
};

export const getUniquePaidMonthsCount = (
  paidMonths: string[] = [],
  savingsAmount?: number,
  targetMonthlyRate?: number
): number => {
  return getEffectivePaidMonthsList(paidMonths, savingsAmount, targetMonthlyRate).length;
};

export const normalizePaidMonthsArray = (
  paidMonths: string[] = [],
  savingsAmount?: number,
  targetMonthlyRate?: number
): string[] => {
  return getEffectivePaidMonthsList(paidMonths, savingsAmount, targetMonthlyRate);
};

export const getEffectiveBalance = (userObj: any): number => {
  if (!userObj) return 0;
  const numBalance = (userObj.balance !== undefined && userObj.balance !== null && userObj.balance !== '' && !isNaN(Number(userObj.balance)))
    ? Number(userObj.balance)
    : null;
  const numMainBalance = (userObj.mainBalance !== undefined && userObj.mainBalance !== null && userObj.mainBalance !== '' && !isNaN(Number(userObj.mainBalance)))
    ? Number(userObj.mainBalance)
    : null;

  if (numBalance !== null && numMainBalance !== null) {
    // If both exist, balance is the authoritative canonical field
    return numBalance;
  }
  if (numBalance !== null) return numBalance;
  if (numMainBalance !== null) return numMainBalance;
  return 0;
};

export interface PhoneChangeRequest {
  id: string;
  userId: string;
  userName: string;
  memberId?: string;
  currentPhone: string;
  newPhone: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

/**
 * Generates a short, easy-to-read AMB Transaction ID (maximum 5 or 6 characters total).
 * Rules: Exactly 1 or 2 letters at the beginning, followed by numbers.
 * Total characters: Strictly 5 or 6 characters (e.g., 'BN4829', 'B74921', 'BN8301', 'B5829').
 * Allows members to easily speak or read the number aloud over phone/support.
 */
export const generateAmbTrxId = (preferredPrefix?: string): string => {
  let prefix = (preferredPrefix || (Math.random() > 0.4 ? 'BN' : 'B')).toUpperCase().replace(/[^A-Z]/g, '');
  if (!prefix) prefix = 'BN';
  if (prefix.length > 2) prefix = prefix.slice(0, 2);

  // Total length: strictly 5 or 6 characters
  const totalLength = prefix.length === 1 ? (Math.random() > 0.5 ? 5 : 6) : 6;
  const numDigits = totalLength - prefix.length; // 4 digits for 2-letter prefix, 4 or 5 digits for 1-letter prefix

  const min = Math.pow(10, numDigits - 1);
  const max = Math.pow(10, numDigits) - 1;
  const randomDigits = Math.floor(min + Math.random() * (max - min + 1));
  return `${prefix}${randomDigits}`;
};

/**
 * Formats or cleans an internal AMB transaction number so that long internal IDs 
 * (such as timestamps or internal hashes) are neatly displayed as 5-6 characters (1-2 letters + numbers).
 * Note: External MFS TrxIDs provided by payment gateways (e.g. bKash 8K48AL7D9) are preserved as entered.
 */
export const formatShortTrxId = (rawId?: string): string => {
  if (!rawId) return generateAmbTrxId('BN');
  const str = String(rawId).trim().toUpperCase();

  // If already 5-6 chars with 1-2 letters and numbers, keep as-is (e.g., BN4821, B74921, B5829)
  if (/^[A-Z]{1,2}\d{3,5}$/.test(str)) {
    return str;
  }

  // If it has a known internal prefix with long timestamp like LID..., CARD..., TXN..., REC..., TX-..., ADD..., QRD...
  const internalMatch = str.match(/^(LID|CARD|TXN|REC|AMB|TX|ADD|QRD|SAM|TEL|SHOP|CORR)[\-_]?(\d+)/);
  if (internalMatch) {
    const letters = internalMatch[1].startsWith('B') ? 'BN' : internalMatch[1].slice(0, 2);
    const digits = internalMatch[2];
    const numDigits = 6 - letters.length;
    return `${letters}${digits.slice(-numDigits)}`;
  }

  // If it is pure digits longer than 6 digits (e.g. timestamp 1741420392)
  if (/^\d{7,}$/.test(str)) {
    return `BN${str.slice(-4)}`;
  }

  // If it is a typical MFS TrxID entered by user (like bKash 8K48AL7D9)
  return str;
};




