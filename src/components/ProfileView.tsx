import React, { useState, useEffect, useRef } from 'react';
import { User, PhoneChangeRequest, AppConfig } from '../types';
import { 
  maskSecretPhone, 
  normalizePhoneNumber, 
  hasCompletedSamityProfile, 
  getMembershipCategory 
} from '../lib/memberUtils';
import { 
  User as UserIcon, 
  Phone, 
  CreditCard, 
  Calendar, 
  Briefcase, 
  MapPin, 
  ShieldCheck, 
  Camera, 
  Edit3, 
  Check, 
  X,
  AlertCircle,
  Copy,
  Send,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Sparkles,
  PhoneCall,
  Crown,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface ProfileViewProps {
  user: User;
  onUpdate: () => void;
  onTriggerAdmin?: () => void;
  appConfig?: AppConfig | null;
}

const PRESET_AVATARS = [
  { id: 'av1', emoji: '👨‍💼', label: 'কর্পোরেট ডিরেক্টর', bg: 'bg-indigo-100 border-indigo-250 text-indigo-700' },
  { id: 'av2', emoji: '👩‍💼', label: 'এক্সিকিউটিভ ওম্যান', bg: 'bg-rose-100 border-rose-250 text-rose-700' },
  { id: 'av3', emoji: '👨‍💻', label: 'আইটি কো-অর্ডিনেটর', bg: 'bg-teal-100 border-teal-250 text-teal-700 font-bold' },
  { id: 'av4', emoji: '🧑‍🌾', label: 'কৃষি উদ্যোক্তা', bg: 'bg-amber-100 border-amber-250 text-amber-700' },
  { id: 'av5', emoji: '👩‍🏫', label: 'সমবায় ট্রেইনার', bg: 'bg-emerald-100 border-emerald-250 text-emerald-700' },
  { id: 'av6', emoji: '✨', label: 'ভিআইপি মেম্বার', bg: 'bg-cyan-100 border-cyan-250 text-cyan-700' },
];

export default function ProfileView({ user, onUpdate, onTriggerAdmin, appConfig }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form edit states
  const [name, setName] = useState(user.name || user.userName || '');
  const [fatherName, setFatherName] = useState(user.fatherName || '');
  const [motherName, setMotherName] = useState(user.motherName || '');
  const [nid, setNid] = useState(user.nid || user.nidNumber || '');
  const [dob, setDob] = useState(user.dob || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergencyPhone || user.alternatePhone || '');
  const [profession, setProfession] = useState(user.profession || user.occupation || '');
  const [nomineeName, setNomineeName] = useState(user.nomineeName || '');
  const [nomineePhone, setNomineePhone] = useState(user.nomineePhone || '');
  const [division, setDivision] = useState(user.division || '');
  const [district, setDistrict] = useState(user.district || '');
  const [thana, setThana] = useState(user.thana || '');
  const [postOffice, setPostOffice] = useState(user.postOffice || '');
  const [profilePic, setProfilePic] = useState(user.profilePic || 'av3');
  const [customPicUrl, setCustomPicUrl] = useState(user.profilePic?.startsWith('http') ? user.profilePic : '');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Phone Change Request States
  const [showPhoneChangeModal, setShowPhoneChangeModal] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [phoneReasonInput, setPhoneReasonInput] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneModalMsg, setPhoneModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myPhoneRequests, setMyPhoneRequests] = useState<PhoneChangeRequest[]>([]);

  // Shareholder & Investor Upgrade Application Modals
  const [showShareholderModal, setShowShareholderModal] = useState(false);
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [modalSavingsTarget, setModalSavingsTarget] = useState<number>(1000);
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
  const [upgradeModalMsg, setUpgradeModalMsg] = useState<string | null>(null);

  // ----------------------------------------------------
  // Interactive Image Cropper Modal States (WhatsApp-style)
  // ----------------------------------------------------
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [cropImageRaw, setCropImageRaw] = useState<string | null>(null);
  const [cropImgDims, setCropImgDims] = useState<{ w: number; h: number }>({ w: 300, h: 300 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialTouchDist, setInitialTouchDist] = useState<number | null>(null);
  const [initialTouchZoom, setInitialTouchZoom] = useState<number>(1);
  const [savingCroppedPic, setSavingCroppedPic] = useState(false);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  // Membership Category & Verification Info
  const memberCategoryMeta = getMembershipCategory(user);
  const isProfileComplete = hasCompletedSamityProfile(user);
  const isVerifiedMember = Boolean(
    isProfileComplete && 
    user.status !== 'inactive' &&
    (user.isSamityMember || user.samityStatus === 'approved' || user.samityApproved || user.role === 'admin' || user.isDemo || user.hasSetProfile)
  );

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'phone_change_requests'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as PhoneChangeRequest[];
      setMyPhoneRequests(list);
    }, (err) => {
      console.error('Error listening to phone change requests:', err);
    });
    return () => unsub();
  }, [user?.uid]);

  const pendingPhoneReq = myPhoneRequests.find(r => r.status === 'pending');
  const approvedReqCount = myPhoneRequests.filter(r => r.status === 'approved').length;
  const prevCount = user.phoneChangeCount !== undefined ? (user.phoneChangeCount || 0) : approvedReqCount;

  const phoneCfg = appConfig?.phoneChangeConfig || {
    enabled: true,
    freeDaysAfterRegistration: 5,
    freeAttempts: 1,
    feeIncrement: 10,
    maxFee: 50
  };

  const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
  const elapsedDays = diffMs / (1000 * 60 * 60 * 24);
  const freeRegistrationDays = phoneCfg.freeDaysAfterRegistration ?? 5;
  const isWithinRegistrationFreeWindow = elapsedDays <= freeRegistrationDays;

  const getPhoneChangeFeeDetails = (count: number) => {
    if (isWithinRegistrationFreeWindow) {
      const remainingDays = Math.max(0, Math.ceil(freeRegistrationDays - elapsedDays));
      return {
        isInstantFree: true,
        fee: 0,
        badgeText: `✨ অ্যাকাউন্ট খোলার প্রথম ${freeRegistrationDays} দিন ইনস্ট্যান্ট ফ্রি অফার (৳0)`,
        noticeText: `আপনার অ্যাকাউন্ট তৈরির বয়স ${Math.floor(elapsedDays)} দিন (5 দিনের ফ্রি সুবিধার আর ${remainingDays} দিন বাকি)। এখন পরিবর্তন করলে কোনো ফি লাগবে না এবং কোনো এডমিন অনুমোদন ছাড়াই নম্বর সঙ্গে সঙ্গে আপডেট হয়ে যাবে!`,
        successMessage: `🎉 অ্যাকাউন্ট তৈরির ${freeRegistrationDays} দিনের মধ্যে ফ্রিতে ইনস্ট্যান্ট পরিবর্তনের সুবিধা থাকায় আপনার মোবাইল নম্বরটি কোনো এডমিন অনুমোদন ছাড়াই সঙ্গে সঙ্গে আপডেট করা হয়েছে!`
      };
    }

    const feeIncrement = phoneCfg.feeIncrement ?? 10;
    const maxFee = phoneCfg.maxFee ?? 50;
    const fee = Math.min(maxFee, Math.max(10, (count + 1) * feeIncrement));
    return {
      isInstantFree: false,
      fee,
      badgeText: `📋 এডমিন অনুমোদন সাপেক্ষে নম্বর পরিবর্তন সার্ভিস চার্জ (৳${fee}):`,
      noticeText: `আপনার অ্যাকাউন্ট খোলার পর ${freeRegistrationDays} দিন পার হয়ে গেছে। এখন মোবাইল নম্বর পরিবর্তনের জন্য ৳${fee} টাকা সার্ভিস চার্জ লাগবে এবং এডমিন অনুমোদনের পর নম্বর পরিবর্তন হবে। (আপনার বর্তমান ব্যালেন্স: ৳${(user.balance || 0).toFixed(2)})`,
      successMessage: `আবেদন সফলভাবে সাবমিট হয়েছে! সার্ভিস চার্জ ৳${fee} টাকা কাটা হয়েছে। এডমিন অনুমোদন দিলে নম্বরটি দ্রুত আপডেট হয়ে যাবে।`
    };
  };

  const currentFeeDetails = getPhoneChangeFeeDetails(prevCount);

  const handleSubmitPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneCfg.enabled === false) {
      setPhoneModalMsg({ type: 'error', text: '⚠️ মোবাইল নম্বর পরিবর্তনের সেবাটি বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। এডমিনের সাথে যোগাযোগ করুন।' });
      return;
    }
    const cleanPhone = newPhoneInput.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      setPhoneModalMsg({ type: 'error', text: 'অনুগ্রহ করে 11 ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 01700000000)' });
      return;
    }
    const currentClean = (user.phone || '').replace(/\D/g, '');
    if (cleanPhone === currentClean) {
      setPhoneModalMsg({ type: 'error', text: 'নতুন মোবাইল নম্বরটি বর্তমান নম্বরের মতোই। অন্য একটি নতুন নম্বর লিখুন।' });
      return;
    }

    const PHONE_CHANGE_FEE = currentFeeDetails.fee;
    const isInstantFree = currentFeeDetails.isInstantFree;
    const currentBalance = Number(user.balance || 0);

    if (PHONE_CHANGE_FEE > 0 && currentBalance < PHONE_CHANGE_FEE) {
      setPhoneModalMsg({ 
        type: 'error', 
        text: `⚠️ আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই। মোবাইল নম্বর পরিবর্তনের আবেদন করতে ৳${PHONE_CHANGE_FEE} চার্জ প্রয়োজন। আপনার বর্তমান ব্যালেন্স: ৳${currentBalance.toFixed(2)}` 
      });
      return;
    }

    setPhoneSubmitting(true);
    setPhoneModalMsg(null);
    try {
      if (isInstantFree) {
        const userRef = doc(db, 'users', user.uid);
        const normalized = normalizePhoneNumber(cleanPhone);
        await updateDoc(userRef, {
          phone: cleanPhone,
          mobileNumber: cleanPhone,
          normalizedPhone: normalized,
          phoneChangeCount: increment(1),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '📱 মোবাইল নম্বর ইনস্ট্যান্ট আপডেট সম্পন্ন',
          message: `অ্যাকাউন্ট সৃষ্টির প্রথম ${freeRegistrationDays} দিনের ফ্রিতে ইনস্ট্যান্ট আপডেটের সুবিধার আওতায় আপনার মোবাইল নম্বর পরিবর্তন করে ${cleanPhone} করা হয়েছে।`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });

        setPhoneModalMsg({
          type: 'success',
          text: `🎉 অ্যাকাউন্ট খোলার ${freeRegistrationDays} দিনের মধ্যে হওয়ায় আপনার মোবাইল নম্বরটি এডমিন অনুমোদন ছাড়াই ইনস্ট্যান্ট পরিবর্তন করে ${cleanPhone} করা হয়েছে!`
        });
        setNewPhoneInput('');
        setPhoneReasonInput('');
        if (onUpdate) onUpdate();
        return;
      }

      const newBalance = PHONE_CHANGE_FEE > 0 ? Math.max(0, currentBalance - PHONE_CHANGE_FEE) : currentBalance;

      if (PHONE_CHANGE_FEE > 0) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          balance: newBalance,
          mainBalance: newBalance,
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || 'সদস্য',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          type: 'debit',
          category: 'fee',
          amount: PHONE_CHANGE_FEE,
          title: 'মোবাইল নম্বর পরিবর্তন চার্জ',
          description: `নতুন মোবাইল নম্বর (${cleanPhone}) এর আবেদন চার্জ বাবদ ৳${PHONE_CHANGE_FEE} কাটা হয়েছে (${prevCount + 1}ম বার পরিবর্তন)।`,
          status: 'approved',
          createdAt: new Date().toISOString()
        });

        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '📱 মোবাইল নম্বর পরিবর্তন চার্জ কর্তন',
          message: `মোবাইল নম্বর পরিবর্তনের আবেদনের জন্য আপনার মূল ব্যালেন্স থেকে ৳${PHONE_CHANGE_FEE} চার্জ কাটা হয়েছে। অবশিষ্ট ব্যালেন্স: ৳${newBalance.toFixed(2)}`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      try {
        await addDoc(collection(db, 'admin_notifications'), {
          type: 'phone_change_request',
          title: '📱 নতুন মোবাইল নম্বর পরিবর্তনের আবেদন',
          message: `${user.name} (${user.memberId || user.phone}) নম্বর পরিবর্তন আবেদন করেছে (${user.phone} ➔ ${cleanPhone})। ফি: ৳${PHONE_CHANGE_FEE}।`,
          userId: user.uid,
          userName: user.name || 'সদস্য',
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (eNotif) {
        console.warn("Admin notification warning:", eNotif);
      }

      await addDoc(collection(db, 'phone_change_requests'), {
        userId: user.uid,
        userName: user.name || 'সদস্য',
        memberId: user.memberId || '',
        currentPhone: user.phone || '',
        newPhone: cleanPhone,
        reason: phoneReasonInput.trim(),
        feePaid: PHONE_CHANGE_FEE,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      setPhoneModalMsg({ 
        type: 'success', 
        text: currentFeeDetails.successMessage
      });
      setNewPhoneInput('');
      setPhoneReasonInput('');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setPhoneModalMsg({ type: 'error', text: 'আবেদন পাঠাতে ব্যর্থ হয়েছে: ' + (err?.message || err) });
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // Synchronize local states when the user prop updates in the background (only when NOT editing)
  useEffect(() => {
    if (!isEditing && user) {
      setName(user.name || user.userName || '');
      setFatherName(user.fatherName || '');
      setMotherName(user.motherName || '');
      setNid(user.nid || user.nidNumber || '');
      setDob(user.dob || '');
      setEmergencyPhone(user.emergencyPhone || user.alternatePhone || '');
      setProfession(user.profession || user.occupation || '');
      setNomineeName(user.nomineeName || '');
      setNomineePhone(user.nomineePhone || '');
      setDivision(user.division || '');
      setDistrict(user.district || '');
      setThana(user.thana || '');
      setPostOffice(user.postOffice || '');
      if (user.profilePic) {
        setProfilePic(user.profilePic);
        setCustomPicUrl(user.profilePic.startsWith('http') ? user.profilePic : '');
      }
    }
  }, [user, isEditing]);

  const handleStartEditing = () => {
    if (user) {
      setName(user.name || user.userName || '');
      setFatherName(user.fatherName || '');
      setMotherName(user.motherName || '');
      setNid(user.nid || user.nidNumber || '');
      setDob(user.dob || '');
      setEmergencyPhone(user.emergencyPhone || user.alternatePhone || '');
      setProfession(user.profession || user.occupation || '');
      setNomineeName(user.nomineeName || '');
      setNomineePhone(user.nomineePhone || '');
      setDivision(user.division || '');
      setDistrict(user.district || '');
      setThana(user.thana || '');
      setPostOffice(user.postOffice || '');
      if (user.profilePic) {
        setProfilePic(user.profilePic);
        setCustomPicUrl(user.profilePic.startsWith('http') ? user.profilePic : '');
      }
    }
    setIsEditing(true);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const isSelfEditAllowed = appConfig?.allowProfileSelfEdit !== false;
    if (!isSelfEditAllowed && user.role !== 'admin') {
      setErrorMsg('দুঃখিত, এডমিন প্যানেল থেকে বর্তমানে সদস্যদের নিজ তথ্য সংশোধন বন্ধ রাখা হয়েছে।');
      setLoading(false);
      return;
    }

    const finalProfilePic = customPicUrl.trim() !== '' ? customPicUrl.trim() : profilePic;
    const userRef = doc(db, 'users', user.uid);
    
    const payload: Partial<User> = {
      name: name.trim(),
      userName: name.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      nid: nid.trim(),
      nidNumber: nid.trim(),
      dob: dob.trim(),
      emergencyPhone: emergencyPhone.trim(),
      alternatePhone: emergencyPhone.trim(),
      profession: profession.trim(),
      occupation: profession.trim(),
      nomineeName: nomineeName.trim(),
      nomineePhone: nomineePhone.trim(),
      division,
      district: district.trim(),
      thana: thana.trim(),
      postOffice: postOffice.trim(),
      profilePic: finalProfilePic,
      hasSetProfile: true,
      updatedAt: serverTimestamp() as any
    };

    updateDoc(userRef, payload)
      .then(() => {
        if (onUpdate) onUpdate();
      })
      .catch((err: any) => {
        console.error("Profile update error:", err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      });

    setTimeout(() => {
      setSuccessMsg('আপনার প্রোফাইল তথ্য সফলভাবে আপডেট ও সংরক্ষিত হয়েছে!');
      setIsEditing(false);
      setLoading(false);
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccessMsg(''), 5000);
    }, 80);
  };

  const selectPresetAvatar = (id: string) => {
    setProfilePic(id);
    setCustomPicUrl('');
    setShowAvatarPicker(false);
    
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { profilePic: id })
      .then(() => { if (onUpdate) onUpdate(); })
      .catch((err) => console.error(err));
  };

  const saveCustomPicUrl = () => {
    if (!customPicUrl.trim().startsWith('http')) {
      alert('সঠিক ছবি ইউআরএল (URL) প্রদান করুন, যা http বা https দিয়ে শুরু হতে হবে।');
      return;
    }
    setProfilePic(customPicUrl);
    setShowAvatarPicker(false);
    
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { profilePic: customPicUrl })
      .then(() => { if (onUpdate) onUpdate(); })
      .catch((err) => console.error(err));
  };

  // ----------------------------------------------------
  // File Picker Trigger -> Opens Cropper Modal
  // ----------------------------------------------------
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('অনুগ্রহ করে একটি সঠিক ছবি ফাইল নির্বাচন করুন।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const tempImg = new Image();
      tempImg.onload = () => {
        setCropImgDims({
          w: tempImg.naturalWidth || 300,
          h: tempImg.naturalHeight || 300
        });
        setCropImageRaw(src);
        setCropZoom(1);
        setCropRotation(0);
        setCropPan({ x: 0, y: 0 });
        setShowCropperModal(true);
        setShowAvatarPicker(false);
      };
      tempImg.src = src;
    };
    reader.readAsDataURL(file);

    // Reset input value so same image can be re-selected if needed
    e.target.value = '';
  };

  // ----------------------------------------------------
  // Perform Interactive Crop & Save to Firebase (100% WYSIWYG WhatsApp-Style)
  // ----------------------------------------------------
  const handleCropAndSave = async () => {
    if (!cropImageRaw) return;
    setSavingCroppedPic(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = cropImageRaw;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const CANVAS_SIZE = 400;
      const CIRCLE_SIZE = 240;
      const scaleMultiplier = CANVAS_SIZE / CIRCLE_SIZE;

      const rawW = img.naturalWidth || cropImgDims.w || 300;
      const rawH = img.naturalHeight || cropImgDims.h || 300;
      const baseScale = Math.max(CIRCLE_SIZE / rawW, CIRCLE_SIZE / rawH);
      const displayW = rawW * baseScale * cropZoom;
      const displayH = rawH * baseScale * cropZoom;

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Save state and set origin to center with pan offset scaled
      ctx.save();
      ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.translate(cropPan.x * scaleMultiplier, cropPan.y * scaleMultiplier);
      ctx.rotate((cropRotation * Math.PI) / 180);

      const canvasW = displayW * scaleMultiplier;
      const canvasH = displayH * scaleMultiplier;
      ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
      ctx.restore();

      // Compress to high-efficiency JPEG data URL (quality: 0.90)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.90);

      // Save directly to Firestore doc: Completely replaces old image
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        profilePic: compressedBase64,
        updatedAt: serverTimestamp()
      });

      setProfilePic(compressedBase64);
      setCustomPicUrl('');
      setShowCropperModal(false);
      setCropImageRaw(null);
      setSuccessMsg('🎉 আপনার নতুন প্রোফাইল ছবি সফলভাবে ক্রপ ও সংরক্ষণ করা হয়েছে!');
      onUpdate();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Crop error:', err);
      setErrorMsg('ছবি ক্রপ ও সেভ করতে ত্রুটি হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSavingCroppedPic(false);
    }
  };

  // Remove Photo & Reset to Default
  const handleRemovePhoto = async () => {
    if (!confirm('আপনি কি নিশ্চিত যে বর্তমান প্রোফাইল ছবিটি মুছে ফেলতে চান?')) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        profilePic: 'av3',
        updatedAt: serverTimestamp()
      });
      setProfilePic('av3');
      setCustomPicUrl('');
      setShowCropperModal(false);
      setSuccessMsg('প্রোফাইল ছবিটি মুছে ফেলা হয়েছে।');
      onUpdate();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('ছবি মুছতে ব্যর্থ হয়েছে।');
    }
  };

  // Pan & Pinch Handlers for WhatsApp-style Cropper
  const handlePanStart = (clientX: number, clientY: number) => {
    setIsPanning(true);
    setPanStart({ x: clientX - cropPan.x, y: clientY - cropPan.y });
  };

  const handlePanMove = (clientX: number, clientY: number) => {
    if (!isPanning) return;
    setCropPan({
      x: clientX - panStart.x,
      y: clientY - panStart.y
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialTouchDist(dist);
      setInitialTouchZoom(cropZoom);
    } else if (e.touches.length === 1 && e.touches[0]) {
      handlePanStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDist) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newZoom = Math.min(4.0, Math.max(0.4, initialTouchZoom * (currentDist / initialTouchDist)));
      setCropZoom(newZoom);
    } else if (e.touches.length === 1 && e.touches[0]) {
      handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setInitialTouchDist(null);
    handlePanEnd();
  };

  // ----------------------------------------------------
  // Shareholder / Investor Upgrade Form Submission
  // ----------------------------------------------------
  const handleApplyMembership = async (category: 'shareholder' | 'investor', monthlyTarget: number) => {
    setSubmittingUpgrade(true);
    setUpgradeModalMsg(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updates: any = {
        memberCategory: category,
        monthlySavingsTarget: monthlyTarget,
        samitySchemeActive: true,
        samityStatus: 'approved',
        samityApproved: true,
        isSamityMember: true,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        dob: dob.trim(),
        emergencyPhone: emergencyPhone.trim(),
        profession: profession.trim(),
        nomineeName: nomineeName.trim(),
        nomineePhone: nomineePhone.trim(),
        division: division.trim(),
        district: district.trim(),
        thana: thana.trim(),
        postOffice: postOffice.trim(),
        hasSetProfile: true,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(userRef, updates);

      // Save application document
      await addDoc(collection(db, 'samity_applications'), {
        userId: user.uid,
        userName: user.name || user.userName || '',
        userPhone: user.phone || '',
        memberId: user.memberId || '',
        category,
        monthlyTarget,
        status: 'approved',
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Notification
      const titleText = category === 'shareholder' 
        ? '👑 অভিনন্দন! আপনি এখন একজন শেয়ার হোল্ডার সদস্য' 
        : '💎 অভিনন্দন! আপনি এখন একজন ইনভেস্টর সদস্য';
      const descText = category === 'shareholder'
        ? `আপনার আবেদন সফল হয়েছে। আপনি শেয়ার হোল্ডার সদস্য হিসেবে প্রতি মাসে ৳${monthlyTarget.toLocaleString('bn-BD')} সঞ্চয় কিস্তি বজায় রাখার অঙ্গীকার করেছেন। আপনার প্রোফাইলে লাল ভেরিফাইড টিক যুক্ত হয়েছে।`
        : `আপনার আবেদন সফল হয়েছে। আপনি ইনভেস্টর সদস্য হিসেবে প্রতি মাসে ৳${monthlyTarget.toLocaleString('bn-BD')} সঞ্চয় কিস্তি পরিচালনার অঙ্গীকার করেছেন। আপনার প্রোফাইলে ব্লু ভেরিফাইড টিক যুক্ত হয়েছে।`;

      await addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: titleText,
        message: descText,
        type: 'success',
        read: false,
        createdAt: serverTimestamp()
      });

      setSuccessMsg(titleText);
      setShowShareholderModal(false);
      setShowInvestorModal(false);
      onUpdate();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Upgrade membership error:', err);
      setUpgradeModalMsg('আবেদন সংরক্ষণে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSubmittingUpgrade(false);
    }
  };

  const currentAvatarMeta = PRESET_AVATARS.find(av => av.id === profilePic) || PRESET_AVATARS[2];
  const isCustomPic = profilePic?.startsWith('http') || profilePic?.startsWith('data:image/');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Upper Status Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold leading-normal flex items-start gap-2.5 shadow-sm">
          <span>🎉</span>
          <div>{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold leading-normal flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Hidden File Picker */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleImageFileSelect} 
        className="hidden" 
      />

      {/* Profile Card Header with Slim, Compact 2-Line Design & Category Sections */}
      <div className="bg-gradient-to-br from-emerald-850 via-emerald-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden text-center border border-emerald-800/40">
        {/* Background mesh decoration */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-teal-400/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Action Row: Left (👑 শেয়ার হোল্ডার) & Right (💎 ইনভেস্টার) Buttons */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          {/* Left Side Button: 👑 শেয়ার হোল্ডার */}
          <button
            type="button"
            onClick={() => {
              setModalSavingsTarget(user.monthlySavingsTarget || 1000);
              setShowShareholderModal(true);
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 ${
              memberCategoryMeta.key === 'shareholder'
                ? 'bg-rose-600/90 text-white border-rose-400 shadow-rose-900/40 ring-2 ring-rose-400/50'
                : 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border-rose-500/40 hover:border-rose-400'
            }`}
            title="শেয়ার হোল্ডার হওয়ার শর্তাবলী, নিয়ম ও আবেদন ফরম"
          >
            <span className="text-sm">👑</span>
            <div className="text-left">
              <span className="block leading-none text-[10.5px] sm:text-[11px] font-black">শেয়ার হোল্ডার</span>
              <span className="text-[8px] sm:text-[8.5px] text-rose-300 font-medium">নিয়ম ও আবেদন</span>
            </div>
          </button>

          {/* Right Side Button: 💎 ইনভেস্টার */}
          <button
            type="button"
            onClick={() => {
              setModalSavingsTarget(user.monthlySavingsTarget || 500);
              setShowInvestorModal(true);
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-2xl border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 ${
              memberCategoryMeta.key === 'investor'
                ? 'bg-sky-600/90 text-white border-sky-400 shadow-sky-900/40 ring-2 ring-sky-400/50'
                : 'bg-sky-950/70 hover:bg-sky-900 text-sky-200 border-sky-500/40 hover:border-sky-400'
            }`}
            title="ইনভেস্টার হওয়ার শর্তাবলী, নিয়ম ও আবেদন ফরম"
          >
            <div className="text-right">
              <span className="block leading-none text-[10.5px] sm:text-[11px] font-black">ইনভেস্টার</span>
              <span className="text-[8px] sm:text-[8.5px] text-sky-300 font-medium">নিয়ম ও আবেদন</span>
            </div>
            <span className="text-sm">💎</span>
          </button>
        </div>

        {/* Profile Avatar Wrapper (Enlarged) */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto mb-3 group">
          <div className={`w-full h-full rounded-full ring-4 ring-offset-4 p-1 shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
            memberCategoryMeta.key === 'shareholder'
              ? 'ring-red-600 ring-offset-slate-950 bg-red-600/20 border-2 border-red-500 shadow-red-900/60'
              : memberCategoryMeta.key === 'investor'
              ? 'ring-blue-600 ring-offset-slate-950 bg-blue-600/20 border-2 border-blue-500 shadow-blue-900/60'
              : 'ring-emerald-400/60 ring-offset-emerald-950 bg-slate-900 border-2 border-slate-700'
          }`}>
            {isCustomPic ? (
              <img 
                src={profilePic} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = '';
                  setProfilePic('av3');
                }}
              />
            ) : (
              <div className={`w-full h-full rounded-full flex items-center justify-center text-5xl sm:text-6xl font-extrabold ${currentAvatarMeta.bg}`}>
                {currentAvatarMeta.emoji}
              </div>
            )}
          </div>
          
          {/* Verification Badge based on Member Tier */}
          {memberCategoryMeta.key === 'shareholder' ? (
            <div 
              className="absolute bottom-1 right-1 w-8 h-8 bg-red-600 border-2 border-slate-950 rounded-full flex items-center justify-center text-white shadow-xl z-20"
              title="শেয়ার হোল্ডার ভেরিফাইড (লাল টিক)"
            >
              <Check className="w-4.5 h-4.5 stroke-[3] text-white" />
            </div>
          ) : memberCategoryMeta.key === 'investor' ? (
            <div 
              className="absolute bottom-1 right-1 w-8 h-8 bg-blue-600 border-2 border-slate-950 rounded-full flex items-center justify-center text-white shadow-xl z-20"
              title="ইনভেস্টার ভেরিফাইড (ব্লু টিক)"
            >
              <Check className="w-4.5 h-4.5 stroke-[3] text-white" />
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="গ্যালারি থেকে ফটো নির্বাচন ও ক্রপ করুন"
              className="absolute bottom-1 right-1 p-2 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-950 rounded-full transition-all text-white cursor-pointer hover:scale-110 active:scale-95 shadow-lg flex items-center justify-center z-20"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Line 1: [1. পদবী] -> [2. নাম] -> [3. একটিভ] */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
          {/* 1. পদবী (শেয়ার হোল্ডার / ইনভেস্টার / সাধারণ সদস্য) */}
          <span 
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black shadow-md border ${
              memberCategoryMeta.key === 'shareholder'
                ? 'bg-red-600 text-white border-red-400 shadow-red-950/50'
                : memberCategoryMeta.key === 'investor'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-950/50'
                : 'bg-slate-700/90 text-slate-200 border-slate-600'
            }`}
            title={memberCategoryMeta.titleBn}
          >
            <span>{memberCategoryMeta.key === 'shareholder' ? '👑' : memberCategoryMeta.key === 'investor' ? '💎' : '👤'}</span>
            <span>{memberCategoryMeta.shortLabel || memberCategoryMeta.badgeBn}</span>
          </span>

          {/* 2. নাম (মাঝখানে) */}
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
            {user.name}
          </h2>

          {/* 3. একটিভ স্ট্যাটাস */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {user.status === 'inactive' ? 'নিষ্ক্রিয়' : 'একটিভ'}
          </span>
        </div>

        {/* Line 2: Member ID, Photo Crop, Avatar & Remove Button (2য় লাইন) */}
        <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[10.5px] font-medium text-emerald-200/90 flex-wrap pt-1.5 border-t border-emerald-800/40">
          <span className="font-mono font-bold text-emerald-300">
            সমবায় আইডিঃ {user.memberId}
          </span>
          <span className="text-emerald-500/60">•</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-0.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-[10px] font-bold rounded-lg border border-white/20 transition flex items-center gap-1 cursor-pointer"
          >
            <Camera className="w-3 h-3 text-emerald-300" />
            <span>ফটো ক্রপ</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-200 text-[10px] font-bold rounded-lg border border-emerald-600/30 transition cursor-pointer"
          >
            অ্যাভাটার
          </button>
          {isCustomPic && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              title="বর্তমান ছবি মুছুন"
              className="p-1 bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-800/40 transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Preset / Custom Avatar Picker Popup Drawer */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm text-left overflow-hidden space-y-4"
          >
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-1 flex items-center justify-between">
                <span>পছন্দের প্রোফাইল অ্যাভাটার নির্বাচন করুন</span>
                <button onClick={() => setShowAvatarPicker(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </h4>
              <p className="text-[10px] text-slate-450 leading-relaxed">সহজে আইডেন্টিফিকেশনের জন্য নিচের যেকোনো একটি মেম্বার অ্যাভাটারে ক্লিক দিনঃ</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_AVATARS.map((av, idx) => (
                <button
                  key={`${av.id}-${idx}`}
                  onClick={() => selectPresetAvatar(av.id)}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 cursor-pointer transition text-center ${
                    profilePic === av.id 
                      ? 'border-emerald-600 bg-emerald-50/20' 
                      : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="text-3xl">{av.emoji}</span>
                  <span className="text-[9px] font-black text-slate-600 leading-none truncate w-full">{av.label}</span>
                </button>
              ))}
            </div>

            {/* Direct URL entry option */}
            <div className="border-t border-slate-100 pt-3.5 space-y-2">
              <label className="block text-[10px] font-bold text-slate-500">অথবা যেকোনো কাস্টম ছবি লিঙ্ক (URL) দিনঃ</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  placeholder="https://images.unsplash.com/.../profile.jpg"
                  value={customPicUrl}
                  onChange={(e) => setCustomPicUrl(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                <button 
                  onClick={saveCustomPicUrl}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-[10.5px] px-3 font-bold rounded-xl whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  ছবি সেট
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* Interactive WhatsApp-Style Direct Cropper Modal */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showCropperModal && cropImageRaw && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-white rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 overflow-hidden space-y-3.5"
            >
              {/* Cropper Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Camera className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">ফটো ক্রপ ও কাটিং (WhatsApp Style)</h3>
                    <p className="text-[9.5px] text-slate-500">ছবি টেনে কাঙ্ক্ষিত অংশ বৃত্তের মাঝে বসান</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCropperModal(false);
                    setCropImageRaw(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewport Interactive Cropper Frame: Full Coverage with Circular Viewfinder */}
              {(() => {
                const CIRCLE_SIZE = 240;
                const rawW = cropImgDims.w || 300;
                const rawH = cropImgDims.h || 300;
                const baseScale = Math.max(CIRCLE_SIZE / rawW, CIRCLE_SIZE / rawH);
                const displayW = rawW * baseScale * cropZoom;
                const displayH = rawH * baseScale * cropZoom;

                return (
                  <div 
                    className="relative w-[280px] h-[280px] mx-auto bg-slate-950 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none border border-slate-800 shadow-inner flex items-center justify-center touch-none"
                    onMouseDown={(e) => handlePanStart(e.clientX, e.clientY)}
                    onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={handlePanEnd}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Circular Viewfinder Overlay with Subtle 3x3 Grid */}
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                      <div className="w-[240px] h-[240px] rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] relative overflow-hidden">
                        {/* 3x3 Grid */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25 pointer-events-none">
                          <div className="border-r border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-r border-b border-white" />
                          <div className="border-b border-white" />
                          <div className="border-r border-white" />
                          <div className="border-r border-white" />
                          <div />
                        </div>
                      </div>
                    </div>

                    {/* Transformed Image Preview: Exact Sized matching Canvas geometry */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        width: `${displayW}px`,
                        height: `${displayH}px`,
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) translate(${cropPan.x}px, ${cropPan.y}px) rotate(${cropRotation}deg)`,
                        transformOrigin: 'center center'
                      }}
                    >
                      <img
                        ref={cropImageRef}
                        src={cropImageRaw || ''}
                        alt="Crop Preview"
                        draggable={false}
                        className="w-full h-full object-fill pointer-events-none block"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Zoom & Rotation Controls Bar */}
              <div className="space-y-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] font-bold">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCropZoom((prev) => Math.max(0.5, Number((prev - 0.15).toFixed(2))))}
                      className="w-7 h-7 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 text-sm font-black"
                      title="ছোট করুন (Zoom Out)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.05"
                      value={cropZoom}
                      onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                      className="w-24 sm:w-28 accent-emerald-600 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setCropZoom((prev) => Math.min(3.0, Number((prev + 0.15).toFixed(2))))}
                      className="w-7 h-7 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 text-sm font-black"
                      title="বড় করুন (Zoom In)"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCropRotation((prev) => (prev + 90) % 360)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 text-[10.5px]"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCropRotation(0);
                        setCropZoom(1);
                        setCropPan({ x: 0, y: 0 });
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 text-[10.5px]"
                      title="পজিশন ও জুম রিসেট"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCropperModal(false);
                    setCropImageRaw(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                >
                  বাতিল
                </button>
                
                <button
                  type="button"
                  disabled={savingCroppedPic}
                  onClick={handleCropAndSave}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/10 active:scale-95"
                >
                  {savingCroppedPic ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>ক্রপ ও সেভ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* 👑 Shareholder Rules & Application Modal */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showShareholderModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 text-left overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-rose-200 overflow-hidden space-y-4 my-auto max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-rose-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-xl shadow-xs">
                    👑
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                      <span>শেয়ার হোল্ডার সদস্য নীতিমালা ও আবেদন</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">লাল টিক ভেরিফাইড</span>
                    </h3>
                    <p className="text-[10.5px] text-slate-500">নিয়ম ও শর্তাবলি পড়ে শেয়ার হোল্ডার ফরম ফিলাপ করুন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareholderModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {upgradeModalMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold shrink-0">
                  {upgradeModalMsg}
                </div>
              )}

              {/* Scrollable Content */}
              <div className="overflow-y-auto pr-1 space-y-4 text-xs">
                {/* Rules & Conditions Card */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-black text-rose-900 text-xs flex items-center gap-1.5">
                    <span>📜</span>
                    <span>শেয়ার হোল্ডার হওয়ার আবশ্যকীয় নিয়ম ও শর্তাবলীঃ</span>
                  </h4>
                  <ul className="space-y-2 text-[11px] text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 font-bold">1.</span>
                      <span><strong>বড় প্রজেক্ট ও জায়গার ক্যাপাসিটি:</strong> আমরা যখন কোনো জমি বা বড় প্রজেক্ট ক্রয় করব, তখন সর্বনিম্ন <strong>50,000 টাকা থেকে 5,00,000 টাকা (5 লাখ টাকা)</strong> পর্যন্ত এককালীন দেওয়ার আর্থিক সক্ষমতা থাকতে হবে।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 font-bold">2.</span>
                      <span><strong>মাসিক নিয়মিত সঞ্চয় কিস্তি:</strong> প্রতি মাসে মিনিমাম <strong>1,000 টাকা থেকে 5,000 টাকা</strong> পর্যন্ত সঞ্চয় কিস্তি নিয়মিত চালিয়ে যেতে হবে।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 font-bold">3.</span>
                      <span><strong>100% সম্পূর্ণ প্রোফাইল তথ্য:</strong> পিতা, মাতা, এনআইডি নম্বর, জন্ম তারিখ, পেশা, নমিনি ও জরুরি যোগাযোগ নম্বর বাধ্যতামূলক।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 font-bold">4.</span>
                      <span><strong>সম্মাননা ও অধিকার:</strong> শেয়ার হোল্ডার সদস্য হিসেবে প্রোফাইলে <strong>লাল ভেরিফাইড টিক (Red Verified Tick)</strong> ব্যাজ প্রদর্শন করবে এবং প্রজেক্টের মুনাফা বণ্টন পাবেন।</span>
                    </li>
                  </ul>
                </div>

                {/* Form Fields: Monthly Savings Target */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800">
                    মাসিক সঞ্চয় কিস্তি নির্বাচন করুন (টাকা)*:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1000, 2000, 3000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setModalSavingsTarget(amt)}
                        className={`py-2 px-1 rounded-xl text-center font-bold text-xs border transition cursor-pointer ${
                          modalSavingsTarget === amt
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ৳{amt.toLocaleString('bn-BD')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Profile Fields Required for 100% completion */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h5 className="font-black text-slate-800 text-[11.5px] flex items-center justify-between">
                    <span>প্রোফাইল তথ্য ও ভেরিফিকেশন ফরমঃ</span>
                    {isProfileComplete && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ তথ্য সম্পূর্ণ
                      </span>
                    )}
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">পেশা (Profession)*</label>
                      <input
                        type="text"
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="যেমন: ব্যবসা / চাকরি"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">বিকল্প / জরুরি ফোন নম্বর*</label>
                      <input
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">পিতার নাম (Father's Name)*</label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="পিতার নাম লিখুন"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">মাতার নাম (Mother's Name)*</label>
                      <input
                        type="text"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        placeholder="মাতার নাম লিখুন"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জাতীয় পরিচয়পত্র (NID)*</label>
                      <input
                        type="text"
                        value={nid}
                        onChange={(e) => setNid(e.target.value)}
                        placeholder="10/13/17 ডিজিটের NID"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জন্ম তারিখ (DOB)*</label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">নমিনীর নাম (Nominee Name)*</label>
                      <input
                        type="text"
                        value={nomineeName}
                        onChange={(e) => setNomineeName(e.target.value)}
                        placeholder="নমিনীর নাম"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">নমিনীর ফোন নম্বর*</label>
                      <input
                        type="tel"
                        value={nomineePhone}
                        onChange={(e) => setNomineePhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">বিভাগ (Division)*</label>
                      <input
                        type="text"
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        placeholder="যেমন: ঢাকা"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জেলা (District)*</label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="যেমন: গাজীপুর"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">থানা / উপজেলা (Thana)*</label>
                      <input
                        type="text"
                        value={thana}
                        onChange={(e) => setThana(e.target.value)}
                        placeholder="যেমন: সদর"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">গ্রাম / পোস্ট অফিস / ঠিকানা (Village / Post Office)*</label>
                      <input
                        type="text"
                        value={postOffice}
                        onChange={(e) => setPostOffice(e.target.value)}
                        placeholder="গ্রাম, রোড বা পোস্ট অফিস"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowShareholderModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={submittingUpgrade}
                  onClick={() => handleApplyMembership('shareholder', modalSavingsTarget)}
                  className="flex-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/10"
                >
                  {submittingUpgrade ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>👑</span>
                      <span>শেয়ার হোল্ডার আবেদন সম্পন্ন করুন</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* 💎 Investor Rules & Application Modal */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showInvestorModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 text-left overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-sky-200 overflow-hidden space-y-4 my-auto max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-sky-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center text-xl shadow-xs">
                    💎
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                      <span>ইনভেস্টর সদস্য নীতিমালা ও আবেদন</span>
                      <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">ব্লু টিক ভেরিফাইড</span>
                    </h3>
                    <p className="text-[10.5px] text-slate-500">নিয়ম ও শর্তাবলি পড়ে ইনভেস্টর ফরম ফিলাপ করুন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvestorModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {upgradeModalMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold shrink-0">
                  {upgradeModalMsg}
                </div>
              )}

              {/* Scrollable Content */}
              <div className="overflow-y-auto pr-1 space-y-4 text-xs">
                {/* Rules & Conditions Card */}
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-black text-sky-900 text-xs flex items-center gap-1.5">
                    <span>📜</span>
                    <span>ইনভেস্টর হওয়ার আবশ্যকীয় নিয়ম ও শর্তাবলীঃ</span>
                  </h4>
                  <ul className="space-y-2 text-[11px] text-slate-700 leading-relaxed font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold">1.</span>
                      <span><strong>এককালীন কোনো বড় বাধ্যবাধকতা নেই:</strong> জমি কেনা বা বড় প্রজেক্টের ক্ষেত্রে কোনো এককালীন বড় অঙ্কের অর্থ দেওয়ার বাধ্যবাধকতা নেই।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold">2.</span>
                      <span><strong>মাসিক নিয়মিত সঞ্চয় কিস্তি:</strong> প্রতি মাসে মিনিমাম <strong>500 টাকা থেকে 5,000 টাকা</strong> পর্যন্ত সঞ্চয় কিস্তি নিয়মিত চালিয়ে যেতে হবে।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold">3.</span>
                      <span><strong>100% সম্পূর্ণ প্রোফাইল তথ্য:</strong> পিতা, মাতা, এনআইডি নম্বর, জন্ম তারিখ, পেশা, নমিনি ও জরুরি যোগাযোগ নম্বর পূরণ বাধ্যতামূলক।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-600 font-bold">4.</span>
                      <span><strong>সম্মাননা ও অধিকার:</strong> ইনভেস্টর সদস্য হিসেবে প্রোফাইলে <strong>ব্লু ভেরিফাইড টিক (Blue Verified Tick)</strong> ব্যাজ প্রদর্শন করবে এবং সঞ্চয়ের ওপর নিয়মিত মুনাফা লাভ করবেন।</span>
                    </li>
                  </ul>
                </div>

                {/* Form Fields: Monthly Savings Target */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800">
                    মাসিক সঞ্চয় কিস্তি নির্বাচন করুন (টাকা)*:
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[500, 1000, 2000, 3000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setModalSavingsTarget(amt)}
                        className={`py-2 px-1 rounded-xl text-center font-bold text-xs border transition cursor-pointer ${
                          modalSavingsTarget === amt
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ৳{amt.toLocaleString('bn-BD')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Profile Fields Required for 100% completion */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h5 className="font-black text-slate-800 text-[11.5px] flex items-center justify-between">
                    <span>প্রোফাইল তথ্য ও ভেরিফিকেশন ফরমঃ</span>
                    {isProfileComplete && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ তথ্য সম্পূর্ণ
                      </span>
                    )}
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">পেশা (Profession)*</label>
                      <input
                        type="text"
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="যেমন: ব্যবসা / চাকরি"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">বিকল্প / জরুরি ফোন নম্বর*</label>
                      <input
                        type="tel"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">পিতার নাম (Father's Name)*</label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="পিতার নাম লিখুন"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">মাতার নাম (Mother's Name)*</label>
                      <input
                        type="text"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        placeholder="মাতার নাম লিখুন"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জাতীয় পরিচয়পত্র (NID)*</label>
                      <input
                        type="text"
                        value={nid}
                        onChange={(e) => setNid(e.target.value)}
                        placeholder="10/13/17 ডিজিটের NID"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জন্ম তারিখ (DOB)*</label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">নমিনীর নাম (Nominee Name)*</label>
                      <input
                        type="text"
                        value={nomineeName}
                        onChange={(e) => setNomineeName(e.target.value)}
                        placeholder="নমিনীর নাম"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">নমিনীর ফোন নম্বর*</label>
                      <input
                        type="tel"
                        value={nomineePhone}
                        onChange={(e) => setNomineePhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">বিভাগ (Division)*</label>
                      <input
                        type="text"
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        placeholder="যেমন: ঢাকা"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">জেলা (District)*</label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="যেমন: গাজীপুর"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">থানা / উপজেলা (Thana)*</label>
                      <input
                        type="text"
                        value={thana}
                        onChange={(e) => setThana(e.target.value)}
                        placeholder="যেমন: সদর"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">গ্রাম / পোস্ট অফিস / ঠিকানা (Village / Post Office)*</label>
                      <input
                        type="text"
                        value={postOffice}
                        onChange={(e) => setPostOffice(e.target.value)}
                        placeholder="গ্রাম, রোড বা পোস্ট অফিস"
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInvestorModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={submittingUpgrade}
                  onClick={() => handleApplyMembership('investor', modalSavingsTarget)}
                  className="flex-2 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-sky-900/10"
                >
                  {submittingUpgrade ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>💎</span>
                      <span>ইনভেস্টর আবেদন সম্পন্ন করুন</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Profile Info Details Grid & Edit toggle */}
      {!isEditing ? (
        <div className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-sm space-y-3.5 text-left">
          {/* Header Action Row */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider leading-none">সদস্য পরিচিতি ও ডাটাপত্র</h3>
              <p className="text-[9px] text-slate-400 mt-1">নিবন্ধিত সমবায় তথ্যাদি ও আইডি বিবরণী</p>
            </div>
            {appConfig?.allowProfileSelfEdit === false && user.role !== 'admin' ? (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-800 font-extrabold border border-rose-200 rounded-lg text-[9.5px] sm:text-[10px] flex items-center gap-0.5 shadow-3xs leading-none">
                🔒 তথ্য সংশোধন বন্ধ (Admin Off)
              </span>
            ) : user.hasSetProfile && appConfig?.allowProfileSelfEdit === false && user.role !== 'admin' ? (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold border border-amber-200 rounded-lg text-[9.5px] sm:text-[10px] flex items-center gap-0.5 shadow-3xs leading-none">
                🔒 তথ্য লকড
              </span>
            ) : (
              <button 
                onClick={handleStartEditing}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-850 hover:text-emerald-950 font-bold border border-emerald-200 hover:border-emerald-300 rounded-xl text-[11px] transition-all active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                তথ্য এডিট
              </button>
            )}
          </div>

          {/* Copied Info indicator */}
          {copiedField && (
            <div className="bg-slate-900 text-white py-1 px-3 rounded-lg text-[9px] font-black tracking-wide text-center animate-bounce">
              📋 {copiedField} সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!
            </div>
          )}

          {/* Profile Details 2-Column Comprehensive List Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left">
            {/* Card 1: Full Name & Member ID */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">সদস্যের নাম ও সমবায় আইডি</span>
                  </div>
                  <button onClick={() => handleCopy(user.memberId, 'সমবায় আইডি')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer" title="আইডি কপি">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <strong className="text-xs sm:text-sm text-slate-900 font-black block truncate">
                  {user.name}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10.5px]">
                <span className="text-slate-500 font-medium">রেজিস্ট্রি আইডি:</span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {user.memberId}
                </span>
              </div>
            </div>

            {/* Card 2: Primary Mobile Phone */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">প্রধান মোবাইল নম্বর</span>
                  </div>
                  <button onClick={() => handleCopy(user.phone, 'মোবাইল নম্বর')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer" title="ফোন কপি">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <strong className="text-xs sm:text-sm text-slate-900 font-mono font-black block truncate">
                  {maskSecretPhone(user.phone)}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-500 font-medium">অ্যাকাউন্ট ভেরিফাইড নম্বর</span>
                <button 
                  onClick={() => {
                    setPhoneModalMsg(null);
                    setShowPhoneChangeModal(true);
                  }}
                  className="px-2.5 py-0.5 bg-[#009273] hover:bg-[#007b61] text-white font-bold text-[9.5px] rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>নম্বর পরিবর্তন</span>
                </button>
              </div>
            </div>

            {/* Card 3: Alternate / Emergency Phone */}
            <div className="p-3 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl border border-emerald-200/80 transition space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-emerald-800 font-bold">1/ বিকল্প জরুরি নাম্বার</span>
                  </div>
                  {(user.emergencyPhone || user.alternatePhone) && (
                    <button onClick={() => handleCopy(user.emergencyPhone || user.alternatePhone || '', 'জরুরি নাম্বার')} className="p-1 hover:bg-emerald-200 text-emerald-700 rounded-md cursor-pointer" title="কপি">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <strong className="text-xs sm:text-sm text-slate-900 font-mono font-black block truncate">
                  {user.emergencyPhone || user.alternatePhone || '(নেই)'}
                </strong>
              </div>
              <div className="text-[10px] text-emerald-700 font-medium pt-1 border-t border-emerald-200/50">
                জরুরি যোগাযোগের জন্য ব্যবহৃত বিকল্প নম্বর
              </div>
            </div>

            {/* Card 4: Profession / Occupation */}
            <div className="p-3 bg-teal-50/40 hover:bg-teal-50/70 rounded-2xl border border-teal-200/80 transition space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-teal-800 font-bold">2/ আপনার পেশা কি</span>
                  </div>
                  {(user.profession || user.occupation) && (
                    <button onClick={() => handleCopy(user.profession || user.occupation || '', 'পেশা')} className="p-1 hover:bg-teal-200 text-teal-700 rounded-md cursor-pointer" title="কপি">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <strong className="text-xs sm:text-sm text-slate-900 font-black block truncate">
                  {user.profession || user.occupation || '(নেই)'}
                </strong>
              </div>
              <div className="text-[10px] text-teal-700 font-medium pt-1 border-t border-teal-200/50">
                সদস্যের বর্তমান পেশা ও কর্মসংস্থান বিবরণ
              </div>
            </div>

            {/* Card 5: Father's Name & Mother's Name */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">পিতা ও মাতার নাম</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">পিতার নামঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {user.fatherName || '(নেই)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">মাতার নামঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {user.motherName || '(নেই)'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-200/60">
                পিতা ও মাতার পূর্ণ নাম ভেরিফিকেশন রেকর্ড
              </div>
            </div>

            {/* Card 6: NID Number & Date of Birth */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-xs">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">জাতীয় পরিচয়পত্র ও জন্ম তারিখ</span>
                  </div>
                  {(user.nid || user.nidNumber) && (
                    <button onClick={() => handleCopy(user.nid || user.nidNumber || '', 'NID')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer" title="NID কপি">
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">NID নম্বরঃ</span>
                    <strong className="text-slate-800 font-mono font-bold block truncate">
                      {user.nid || user.nidNumber || '(নেই)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">জন্ম তারিখঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {user.dob ? new Date(user.dob).toLocaleDateString('bn-BD', { year: 'numeric', month: 'numeric', day: 'numeric' }) : '(নেই)'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-200/60">
                সরকারি জাতীয় পরিচয়পত্র ও বয়স যাচাইকরণ
              </div>
            </div>

            {/* Card 7: Nominee Details */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-pink-50 text-pink-700 flex items-center justify-center font-bold text-xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">মনোনীত নমিনি (Nominee)</span>
                  </div>
                  {user.nomineePhone && (
                    <button onClick={() => handleCopy(user.nomineePhone || '', 'নমিনি ফোন')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer" title="নমিনি ফোন কপি">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">নমিনির নামঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {user.nomineeName || '(নেই)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">নমিনির ফোনঃ</span>
                    <strong className="text-slate-800 font-mono font-bold block truncate">
                      {user.nomineePhone ? maskSecretPhone(user.nomineePhone) : '(নেই)'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-200/60">
                উত্তরাধিকার ও অ্যাকাউন্টের মনোনীত নমিনি তথ্য
              </div>
            </div>

            {/* Card 8: Complete Present Address Details (বিভাগ, জেলা, থানা, গ্রাম/পোস্ট অফিস) */}
            <div className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 transition space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">বর্তমান ঠিকানা (গ্রাম, পোস্ট, থানা ও জেলা)</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">বিভাগ ও জেলাঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {[user.division, user.district].filter(Boolean).join(', ') || '(নেই)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-medium block">থানা ও গ্রাম / পোস্টঃ</span>
                    <strong className="text-slate-800 font-bold block truncate">
                      {[user.thana, user.postOffice].filter(Boolean).join(', ') || '(নেই)'}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-200/60 truncate">
                পূর্ণ ঠিকানাঃ {[user.postOffice, user.thana, user.district, user.division].filter(Boolean).join(', ') || '(ঠিকানা সংরক্ষিত নেই)'}
              </div>
            </div>
          </div>

          {/* Pending Phone Request Notice if any */}
          {pendingPhoneReq && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">আবেদন অপেক্ষমাণ:</strong> নম্বর <strong>{user.phone}</strong> পরিবর্তন করে <strong className="font-mono">{pendingPhoneReq.newPhone}</strong> করার আবেদনটি এডমিন পর্যালোচনায় রয়েছে।
              </div>
            </div>
          )}

          {/* Member Category 3-Tier Explanation Card */}
          <div className="p-3 bg-gradient-to-r from-slate-50 to-emerald-50/40 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                সদস্য ক্যাটাগরি ও স্ট্যাটাস
              </span>
              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg ${memberCategoryMeta.tagColor}`}>
                {memberCategoryMeta.titleBn}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-600 font-medium leading-relaxed">
              {memberCategoryMeta.descBn}
            </p>
          </div>

          {/* Admin panel gate for admins only */}
          {user.role === 'admin' && onTriggerAdmin && (
            <div className="pt-1.5 border-t border-slate-100 mt-1">
              <button
                onClick={onTriggerAdmin}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold rounded-xl text-[10.5px] transition duration-150 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-slate-900/10"
              >
                <ShieldCheck className="w-4 h-4 text-amber-450" />
                অ্যাডমিন গেটওয়ে মডিউলে প্রবেশ করুন
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Edit Profile Mode Form */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-slate-205 p-4.5 rounded-3xl shadow-sm text-left"
        >
          <div className="pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-slate-800">প্রোফাইল সম্পাদন খাতা</h3>
            <p className="text-[9px] text-slate-450 mt-0.5">নিচের ফর্মটি যথাযথ তথ্য দিয়ে পূরণ করে ডাটা আপডেট করুনঃ</p>
          </div>

          {/* Policy Notice matching user criteria */}
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl mb-3 text-amber-950 text-[10px] leading-relaxed font-bold space-y-1 text-left">
            <div className="flex items-center gap-1.5 text-amber-900">
              <span className="text-sm">📌</span>
              <span className="font-black">প্রোফাইল পূরণ ও মেম্বারশিপ সংক্রান্ত নিয়মাবলীঃ</span>
            </div>
            <p className="text-slate-700 font-medium pl-5">
              • <strong>সাধারণ সদস্য:</strong> সাধারণ লেনদেন ও কেনাকাটার জন্য শুধু নাম, বিকল্প জরুরি নাম্বার ও পেশা পূরণ করলেই চলবে।
            </p>
            <p className="text-slate-700 font-medium pl-5">
              • <strong>করযে হাসানা ঋণ:</strong> সুদমুক্ত ঋণ গ্রহণের জন্য পিতা-মাতার নাম, NID, নমিনি ও ঠিকানা সহ সম্পূর্ণ তথ্য 100% পূরণ করা বাধ্যতামূলক (কোনো মাসিক কিস্তি দিতে হবে না)।
            </p>
            <p className="text-slate-500 text-[9px] pl-5 italic">
              * নিরাপত্তার স্বার্থে প্রোফাইল তথ্য শুধুমাত্র 1 বার সংরক্ষণ করা যাবে। পরবর্তীতে কোনো সংশোধনের জন্য এডমিন অনুমোদনের প্রয়োজন হবে।
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3 font-sans text-xs">
            {/* Name */}
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-500">মেম্বার পুরো নাম (বাংলা বা ইংরেজি) <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="নাম লিখুন"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* ---------------------------------------------------- */}
            {/* NEW EDIT FIELDS (বিকল্প জরুরি নাম্বার & আপনার পেশা কি) */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-2 gap-3 bg-emerald-50/40 p-2.5 rounded-2xl border border-emerald-200/60">
              {/* Alternate / Emergency Phone */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-emerald-900">1/ বিকল্প জরুরি নাম্বার <span className="text-rose-500">*</span></label>
                <input 
                  type="tel" 
                  maxLength={11}
                  required
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="01XXXXXXXXX"
                  className="w-full text-xs p-2.5 bg-white border border-emerald-300 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-bold"
                />
              </div>

              {/* Profession / Occupation */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-teal-900">2/ আপনার পেশা কি <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="যেমন: ব্যবসা, চাকরি, প্রবাসী"
                  className="w-full text-xs p-2.5 bg-white border border-teal-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Father's & Mother's Name Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Father Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">পিতার নাম (Father's Name)</label>
                <input 
                  type="text" 
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="পিতার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Mother Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">মাতার নাম (Mother's Name)</label>
                <input 
                  type="text" 
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="মাতার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* NID & DOB Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* NID */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">NID নম্বর (10 বা 17 ডিজিট)</label>
                <input 
                  type="text" 
                  maxLength={17}
                  value={nid}
                  onChange={(e) => setNid(e.target.value.replace(/\D/g, ''))}
                  placeholder="National ID নম্বর"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">জন্ম তারিখ</label>
                <input 
                  type="date" 
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold font-mono"
                />
              </div>
            </div>

            {/* Nominee Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Nominee Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">মনোনীত নমিনির নাম</label>
                <input 
                  type="text" 
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="নমিনির নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Nominee Mobile */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">নমিনির কন্টাক্ট মোবাইল নম্বর</label>
                <input 
                  type="tel" 
                  maxLength={11}
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="01XXXXXXXXX"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>
            </div>

            {/* Area / Division & District Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Area / Division dropdown */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">বিভাগ / এলাকা</label>
                <select 
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl text-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="Dhaka">ঢাকা (Dhaka)</option>
                  <option value="Chittagong">চট্টগ্রাম (Chittagong)</option>
                  <option value="Rajshahi">রাজশাহী (Rajshahi)</option>
                  <option value="Khulna">খুলনা (Khulna)</option>
                  <option value="Barisal">বরিশাল (Barisal)</option>
                  <option value="Sylhet">সিলেট (Sylhet)</option>
                  <option value="Rangpur">রংপুর (Rangpur)</option>
                  <option value="Mymensingh">ময়মনসিংহ (Mymensingh)</option>
                </select>
              </div>

              {/* District */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">জেলা (District)</label>
                <input 
                  type="text" 
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="জেলার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Thana & Post Office Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Thana */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">থানা / উপজেলা (Thana / Upazila)</label>
                <input 
                  type="text" 
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  placeholder="থানার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Post Office or Village */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">পোস্ট অফিস / গ্রাম (Post / Village)</label>
                <input 
                  type="text" 
                  value={postOffice}
                  onChange={(e) => setPostOffice(e.target.value)}
                  placeholder="গ্রাম বা পোস্ট অফিস"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex gap-2.5 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl transition cursor-pointer text-center text-[11px] shadow-xs"
              >
                বাতিল করুন
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-850 hover:bg-emerald-900 text-white font-extrabold rounded-xl transition cursor-pointer text-center text-[11px] shadow-md shadow-emerald-850/10 flex items-center justify-center gap-1 border border-emerald-900"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    ডাটা সংরক্ষণ
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Phone Change Request Modal */}
      <AnimatePresence>
        {showPhoneChangeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative overflow-hidden space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                    <Phone className="w-5 h-5 text-[#009273]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">মোবাইল নম্বর পরিবর্তনের আবেদন</h3>
                    <p className="text-[10px] text-slate-500 font-medium">এডমিন অনুমোদন দিলে আপনার নম্বর অটোমেটিক আপডেট হবে</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoneChangeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Security & Data Preservation Notice */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-[#009273]">
                  <ShieldCheck className="w-4 h-4 text-[#009273] shrink-0" />
                  নিরাপত্তা ও ডাটা সংরক্ষণের বার্তা:
                </p>
                <p className="text-[10.5px] leading-relaxed text-slate-700">
                  নম্বর পরিবর্তন করা হলেও আপনার অ্যাকাউন্টের মেইন ওয়ালেট ব্যালেন্স, সঞ্চয় খতিয়ান, ডিপিএস, লভ্যাংশ, কিস্তি তথ্য ও মেম্বার আইডি <strong>100% নিরাপদ ও অপরিবর্তিত থাকবে</strong>। শুধু লগইন করার মোবাইল নম্বরটি আপডেট হবে।
                </p>
              </div>

              {/* Fee Notice */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-amber-900">{currentFeeDetails.badgeText}</p>
                  <p className="text-[10.5px] leading-relaxed text-amber-800">
                    {currentFeeDetails.noticeText} (আপনার বর্তমান ব্যালেন্স: <span className="font-bold text-slate-900">৳{(user.balance || 0).toFixed(2)}</span>)
                  </p>
                </div>
              </div>

              {phoneModalMsg && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  phoneModalMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{phoneModalMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitPhoneChange} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    বর্তমান মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.phone || ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    নতুন মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="01700000000"
                    value={newPhoneInput}
                    onChange={(e) => setNewPhoneInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#009273] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    নম্বর পরিবর্তনের কারণ (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="যেমন: নতুন নম্বর ব্যবহার করছি বা আগের নম্বরটি হারিয়ে গেছে..."
                    value={phoneReasonInput}
                    onChange={(e) => setPhoneReasonInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-[#009273] outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPhoneChangeModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="submit"
                    disabled={phoneSubmitting}
                    className="flex-1 py-2.5 bg-[#009273] hover:bg-[#007b61] text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-teal-900/10"
                  >
                    {phoneSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>আবেদন সাবমিট করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
