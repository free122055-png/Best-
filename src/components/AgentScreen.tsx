import React, { useState, useEffect, useMemo, useRef } from 'react';
import UnifiedBackButton from './UnifiedBackButton';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Search, 
  Filter, 
  MapPin, 
  Phone, 
  Calendar, 
  Users, 
  Globe, 
  ShieldCheck, 
  Award, 
  Coins, 
  TrendingUp, 
  FileText, 
  Briefcase, 
  ArrowRight, 
  CheckCircle,
  Eye,
  Map as LucideMap,
  User,
  Heart,
  Send,
  Bell,
  Settings,
  Share2,
  AlertTriangle,
  Languages,
  Star,
  Navigation,
  Power,
  Check,
  X,
  Sparkles,
  MapPinned,
  Radio,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import LeafletActiveMap from './LeafletActiveMap';
import AgentProfileCard from './AgentProfileCard';
import AgentReportModal from './AgentReportModal';
import AgentDashboardPanel from './AgentDashboardPanel';
import {
  getHighPrecisionPosition,
  startWatchingHighPrecisionLocation,
  stopSharingAgentLocation,
  syncAgentLocationToFirestore,
  calculateHaversineDistance,
  formatDistance,
  formatRelativeTime,
  getOnlinePresenceStatus,
  toBanglaDigits
} from '../lib/locationService';
import { useBackHandler } from '../lib/navigationManager';

interface AgentScreenProps {
  user: {
    uid: string;
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
    balance?: number;
  };
  onBack: () => void;
  appConfig?: any;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  country: string;
  flag: string;
  city: string;
  phone: string;
  lat: number;   // realLat or percentage
  lng: number;   // realLng or percentage
  realLat?: number;
  realLng?: number;
  hasRealGPS?: boolean;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  lastUpdatedTs?: number;
  distanceKm?: number;
  isSharingLocation?: boolean;
  shopMapLink?: string;
  locationNumber?: string;
  bdX?: number;  // Percent X on Bangladesh map
  bdY?: number;  // Percent Y on Bangladesh map
  img: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  verified?: boolean;
  status?: 'Available' | 'Busy' | 'Offline';
  lastSeen?: string;
  whatsapp?: string;
  messenger?: string;
  liveLocationEnabled?: boolean;
}

export default function AgentScreen({ user, onBack, appConfig }: AgentScreenProps) {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [activeTab, setActiveTab] = useState<'map' | 'apply' | 'my-applications' | 'profile' | 'agent-dash'>('map');
  const [mapType, setMapType] = useState<'world' | 'bangladesh'>('world');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number | 'all'>('all');
  const [filterOnline, setFilterOnline] = useState<boolean>(false);
  const [filterNearby, setFilterNearby] = useState<boolean>(false);
  const [filterVerified, setFilterVerified] = useState<boolean>(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState<boolean>(false);

  // Admin Config State for Manual vs Auto Location
  const [allowManualLocation, setAllowManualLocation] = useState<boolean>(
    appConfig?.allowManualAgentLocation ?? false
  );

  // User Geolocation States
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Privacy: Share My Location toggle
  const [isSharingLocation, setIsSharingLocation] = useState<boolean>(() => {
    return localStorage.getItem('amb_share_location') !== 'false';
  });

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('amb_favorite_agents');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleFavorite = (agentId: string) => {
    const updated = favorites.includes(agentId)
      ? favorites.filter(id => id !== agentId)
      : [...favorites, agentId];
    setFavorites(updated);
    localStorage.setItem('amb_favorite_agents', JSON.stringify(updated));
  };

  // Agent Reporting States
  const [reportingAgent, setReportingAgent] = useState<Agent | null>(null);
  const [reportReason, setReportReason] = useState<string>('ভুল তথ্য');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  // Missing application form & UI states
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [closestAgent, setClosestAgent] = useState<Agent | null>(null);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [showApplyForm, setShowApplyForm] = useState<boolean>(false);

  // Agent internal back handler
  useBackHandler(() => {
    if (reportingAgent) { setReportingAgent(null); return true; }
    if (showFilterDropdown) { setShowFilterDropdown(false); return true; }
    if (showApplyForm) { setShowApplyForm(false); return true; }
    if (activeTab !== 'map') {
      setActiveTab('map');
      return true;
    }
    return false;
  }, true, 25);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [areaName, setAreaName] = useState<string>('');
  const [experience, setExperience] = useState<string>('');
  const [whatsNumber, setWhatsNumber] = useState<string>('');
  const [motivation, setMotivation] = useState<string>('');
  const [isFetchingAddress, setIsFetchingAddress] = useState<boolean>(false);
  const [applyLat, setApplyLat] = useState<number | null>(null);
  const [applyLng, setApplyLng] = useState<number | null>(null);
  const [shopMapLink, setShopMapLink] = useState<string>('');
  const [locationNumber, setLocationNumber] = useState<string>('');

  // Multi-Language translations dictionary
  const trans = {
    bn: {
      title: 'AMB এজেন্ট ম্যাপ',
      subtitle: 'বিশ্বজুড়ে আমাদের অনুমোদিত এজেন্ট নেটওয়ার্ক',
      onlineBadge: '24/7 লাইভ',
      locateBtn: 'লোকেশন সনাক্ত করুন 📍',
      locateBtnActive: 'লোকেশন আপডেট করুন',
      locating: 'খোঁজা হচ্ছে...',
      scanningUser: 'আপনার বর্তমান অবস্থান স্ক্যান করা হচ্ছে...',
      gpsZone: 'জিপিএস ডিস্টেন্স জোন',
      gpsFound: 'সফলভাবে অবস্থান সনাক্ত করা হয়েছে!',
      gpsHelp: 'নিকটবর্তী এজেন্টদের দূরত্ব দেখতে অবস্থান সনাক্ত করুন।',
      findNearMe: 'Find Agent Near You',
      introText: 'পৃথিবীর যেকোনো প্রান্ত থেকে আপনার নিকটস্থ কো-অপারেটিভ এজেন্টের সাথে যোগাযোগ করুন। টাকা পাঠানো, উত্তোলন করা ও ক্যাশ আউট এখন মুহূর্তেই সম্পন্ন করুন।',
      nearestAgent: 'নিকটবর্তী এজেন্টঃ',
      searchPlaceholder: 'নাম, দেশ, শহর বা Agent ID দিয়ে খুঁজুন...',
      allCountries: 'সব দেশ',
      allCities: 'সব শহর',
      onlineFilter: '🟢 অনলাইন',
      nearbyFilter: '📍 নিকটস্থ (< 50 কি.মি.)',
      verifiedFilter: '☑️ ভেরিফাইড',
      activeAgentsCount: 'জন সক্রিয় এজেন্ট',
      agentCardStatusActive: 'Active',
      agentCardStatusBusy: 'Busy',
      agentCardStatusOffline: 'Offline',
      mapViewWorld: 'ওয়ার্ল্ড ম্যাপ',
      mapViewBD: 'বাংলাদেশ ম্যাপ',
      navHome: '🏡 হোম',
      navMap: 'এজেন্ট ম্যাপ',
      navApply: 'আবেদন করুন',
      navMyApps: 'আমার আবেদন',
      navProfile: 'প্রোফাইল',
      navAgentDash: 'ড্যাশবোর্ড',
      selectedAgent: 'নির্বাচিত এজেন্ট প্রোফাইল',
      locationLabel: '📍 অবস্থানঃ',
      phoneLabel: '📞 যোগাযোগ নম্বরঃ',
      etaLabel: 'আনুমানিক দূরত্ব ও সময়ঃ',
      distLabel: 'দূরত্বঃ',
      timeLabel: 'সময়ঃ',
      callBtn: '📞 কল করুন',
      waBtn: '💬 হোয়াটসঅ্যাপ',
      dirBtn: '📍 Get Direction (ডিরেকশন)',
      shareBtn: '🔗 শেয়ার',
      favBtn: '❤️ ফেভারিট',
      reportBtn: '⚠️ রিপোর্ট',
      reportModalTitle: 'এজেন্ট রিপোর্ট খতিয়ান',
      reportReasonLabel: 'রিপোর্টের কারণ নির্বাচন করুন',
      reportDetailsLabel: 'অভিযোগের বিবরণ দিন',
      submitReportBtn: 'অভিযোগ দাখিল করুন',
      reportSuccessText: 'আপনার রিপোর্টটি সফলভাবে দাখিল করা হয়েছে!',
      agentDashTitle: '💼 এজেন্ট কন্ট্রোল প্যানেল',
      agentDashStatusTitle: 'অনলাইন ডিউটি স্ট্যাটাস পরিবর্তন',
      agentLiveLocTitle: 'লাইভ জিপিএস লোকেশন ব্রডকাস্ট',
      agentLiveLocDesc: 'এই অপশনটি চালু থাকলে কো-অপারেটিভ সদস্যরা আপনার লাইভ অবস্থান ম্যাপে দেখতে পাবেন।',
      updateLocationGPSBtn: 'বর্তমান জিপিএস লোকেশন আপডেট করুন 🗺️',
      locationUpdatedSuccess: 'আপনার লাইভ অবস্থান সফলভাবে ডাটাবেসে আপডেট করা হয়েছে!',
      profileUpdateTitle: 'এজেন্ট প্রোফাইল সেটিংস আপডেট করুন',
      saveProfileBtn: 'প্রোফাইল তথ্য সংরক্ষণ করুন 💾'
    },
    en: {
      title: 'AMB Agent Map Portal',
      subtitle: 'Our Approved Cooperative Agent Network Worldwide',
      onlineBadge: '24/7 Live',
      locateBtn: 'Detect Location 📍',
      locateBtnActive: 'Update Location',
      locating: 'Locating...',
      scanningUser: 'Scanning your current GPS coordinates...',
      gpsZone: 'GPS Proximity Zone',
      gpsFound: 'Position successfully detected!',
      gpsHelp: 'Enable GPS permission to see nearest agents and distance.',
      findNearMe: 'Find Agent Near You',
      introText: 'Connect with our nearby cooperative agents globally. Send, receive, and cash out funds instantly with maximum convenience.',
      nearestAgent: 'Nearest Agent:',
      searchPlaceholder: 'Search by Name, Country, City or Agent ID...',
      allCountries: 'All Countries',
      allCities: 'All Cities',
      onlineFilter: '🟢 Online',
      nearbyFilter: '📍 Nearby (< 50 km)',
      verifiedFilter: '☑️ Verified',
      activeAgentsCount: 'active agents mapped',
      agentCardStatusActive: 'Active',
      agentCardStatusBusy: 'Busy',
      agentCardStatusOffline: 'Offline',
      mapViewWorld: 'World Map',
      mapViewBD: 'Bangladesh Map',
      navHome: '🏡 Home',
      navMap: 'Agent Map',
      navApply: 'Apply Now',
      navMyApps: 'My Applications',
      navProfile: 'Profile',
      navAgentDash: 'Agent Panel',
      selectedAgent: 'Selected Agent Profile',
      locationLabel: '📍 Location:',
      phoneLabel: '📞 Phone Number:',
      etaLabel: 'Estimated Distance & ETA:',
      distLabel: 'Distance:',
      timeLabel: 'Time:',
      callBtn: '📞 Call Now',
      waBtn: '💬 WhatsApp',
      dirBtn: '📍 Get Direction',
      shareBtn: '🔗 Share',
      favBtn: '❤️ Favorite',
      reportBtn: '⚠️ Report',
      reportModalTitle: 'Report Agent Form',
      reportReasonLabel: 'Select Reason for Report',
      reportDetailsLabel: 'Describe your complaint',
      submitReportBtn: 'Submit Complaint',
      reportSuccessText: 'Your report has been submitted successfully!',
      agentDashTitle: '💼 Agent Control Panel',
      agentDashStatusTitle: 'Update Duty Status',
      agentLiveLocTitle: 'Live GPS Broadcast',
      agentLiveLocDesc: 'When enabled, cooperative members can see your live position on the active map.',
      updateLocationGPSBtn: 'Update Current GPS Location 🗺️',
      locationUpdatedSuccess: 'Your live coordinate has been successfully updated in Firestore!',
      profileUpdateTitle: 'Update Agent Profile Settings',
      saveProfileBtn: 'Save Profile Settings 💾'
    }
  };

  const t = trans[lang];

  // Helpers for Bangla numbers and Geodistance calculations
  const toBanglaDigits = (numStr: string | number) => {
    const banglaDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return numStr.toString().replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit)]);
  };

  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const getEstimatedTime = (distance: number) => {
    if (distance < 2) {
      // Walking at 4.5 km/h
      const mins = Math.max(1, Math.round((distance / 4.5) * 60));
      return { time: mins, type: 'হাঁটা পথ' };
    } else {
      // Driving at 25 km/h
      const mins = Math.max(1, Math.round((distance / 25) * 60));
      return { time: mins, type: 'ড্রাইভ' };
    }
  };

  const detectUserLocation = () => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 23.8103, lng: 90.4125 });
      setLocationError('আপনার ব্রাউজারটি জিপিএস লোকেশন সনাক্তকরণ সমর্থন করে না (ডিফল্ট ঢাকা কেন্দ্র সক্রিয়)।');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        // Fallback to central location so distance calculations work anyway!
        setUserLocation({ lat: 23.8103, lng: 90.4125 });
        setLocationError('জিপিএস সিগন্যাল বিলম্বিত। ঢাকা কেন্দ্র থেকে দূরত্ব হিসাব করা হচ্ছে।');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Default Agent Data (Empty - strictly loads real registered members from Firestore)
  const defaultAgents: Agent[] = [];

  // Dynamic Agents list combining Firestore agents & default agents
  const [agentsList, setAgentsList] = useState<Agent[]>(defaultAgents);

  // Agent Control Panel states
  const [myAgentProfile, setMyAgentProfile] = useState<Agent | null>(null);
  const [isUpdatingLoc, setIsUpdatingLoc] = useState<boolean>(false);
  const [isSavingAgentProfile, setIsSavingAgentProfile] = useState<boolean>(false);

  // Form input states for the Profile Tab (Unified Change/Listing Request)
  const [profName, setProfName] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profWhats, setProfWhats] = useState<string>('');
  const [profCountry, setProfCountry] = useState<string>('Bangladesh');
  const [profCity, setProfCity] = useState<string>('');
  const [profDist, setProfDist] = useState<string>('');
  const [profThana, setProfThana] = useState<string>('');
  const [profPost, setProfPost] = useState<string>('');
  const [profLat, setProfLat] = useState<number | null>(null);
  const [profLng, setProfLng] = useState<number | null>(null);
  const [isProfFetchingGPS, setIsProfFetchingGPS] = useState<boolean>(false);
  const [profSuccess, setProfSuccess] = useState<string>('');
  const [profError, setProfError] = useState<string>('');
  const [isProfSubmitting, setIsProfSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setProfName(myAgentProfile?.name || user.name || '');
      setProfPhone(myAgentProfile?.phone || user.phone || '');
      setProfWhats(myAgentProfile?.whatsapp || myAgentProfile?.phone || user.phone || '');
      setProfCountry(myAgentProfile?.country || 'Bangladesh');
      setProfCity(myAgentProfile?.city || '');
      setProfDist(myAgentProfile?.district || '');
      setProfThana(myAgentProfile?.thana || '');
      setProfPost(myAgentProfile?.postOffice || '');
      setProfLat(myAgentProfile?.realLat || myAgentProfile?.lat || null);
      setProfLng(myAgentProfile?.realLng || myAgentProfile?.lng || null);
    }
  }, [user, myAgentProfile]);

// Helper to resolve an individual profile picture / avatar
const resolveAgentAvatar = (data: any, fallbackName: string): string => {
  const customPic = data?.photoURL || data?.photoUrl || data?.profilePic || data?.img || data?.avatar || data?.nidFront || data?.photo;
  
  // Ignore standard default female sample unsplash photo if user didn't upload it
  if (
    customPic && 
    typeof customPic === 'string' && 
    customPic.trim().length > 5 && 
    !customPic.includes('1534528741775-53994a69daeb')
  ) {
    return customPic.trim();
  }
  
  const nameToUse = data?.name || data?.userName || fallbackName || 'Member Agent';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameToUse)}&background=0D9488&color=fff&size=200&bold=true`;
};

// District Coordinate Presets across Bangladesh (Full 64 Districts)
const districtCoordinatesMap: { [key: string]: { lat: number; lng: number } } = {
  // Dhaka Division
  'dhaka': { lat: 23.8103, lng: 90.4125 },
  'ঢাকা': { lat: 23.8103, lng: 90.4125 },
  'faridpur': { lat: 23.6071, lng: 89.8425 },
  'ফরিদপুর': { lat: 23.6071, lng: 89.8425 },
  'gazipur': { lat: 23.9999, lng: 90.4203 },
  'গাজীপুর': { lat: 23.9999, lng: 90.4203 },
  'gopalganj': { lat: 23.0050, lng: 89.8266 },
  'গোপালগঞ্জ': { lat: 23.0050, lng: 89.8266 },
  'kishoreganj': { lat: 24.4449, lng: 90.7765 },
  'কিশোরগঞ্জ': { lat: 24.4449, lng: 90.7765 },
  'madaripur': { lat: 23.1641, lng: 90.1897 },
  'মাদারীপুর': { lat: 23.1641, lng: 90.1897 },
  'manikganj': { lat: 23.8644, lng: 90.0047 },
  'মানিকগঞ্জ': { lat: 23.8644, lng: 90.0047 },
  'munshiganj': { lat: 23.5422, lng: 90.5305 },
  'মুন্সীগঞ্জ': { lat: 23.5422, lng: 90.5305 },
  'narayanganj': { lat: 23.6238, lng: 90.5000 },
  'নারায়ণগঞ্জ': { lat: 23.6238, lng: 90.5000 },
  'narsingdi': { lat: 23.9193, lng: 90.7202 },
  'নরসিংদী': { lat: 23.9193, lng: 90.7202 },
  'rajbari': { lat: 23.7574, lng: 89.6444 },
  'রাজবাড়ী': { lat: 23.7574, lng: 89.6444 },
  'shariatpur': { lat: 23.2423, lng: 90.4348 },
  'শরীয়তপুর': { lat: 23.2423, lng: 90.4348 },
  'tangail': { lat: 24.2513, lng: 89.9167 },
  'টাঙ্গাইল': { lat: 24.2513, lng: 89.9167 },

  // Chattogram Division
  'chittagong': { lat: 22.3569, lng: 91.7832 },
  'chattogram': { lat: 22.3569, lng: 91.7832 },
  'চট্টগ্রাম': { lat: 22.3569, lng: 91.7832 },
  'bandarban': { lat: 21.8311, lng: 92.3686 },
  'বান্দরবান': { lat: 21.8311, lng: 92.3686 },
  'brahmanbaria': { lat: 23.9571, lng: 91.1119 },
  'ব্রাহ্মণবাড়িয়া': { lat: 23.9571, lng: 91.1119 },
  'chandpur': { lat: 23.2321, lng: 90.6631 },
  'চাঁদপুর': { lat: 23.2321, lng: 90.6631 },
  'comilla': { lat: 23.4607, lng: 91.1809 },
  'cumilla': { lat: 23.4607, lng: 91.1809 },
  'কুমিল্লা': { lat: 23.4607, lng: 91.1809 },
  'coxsbazar': { lat: 21.4272, lng: 92.0058 },
  'কক্সবাজার': { lat: 21.4272, lng: 92.0058 },
  'feni': { lat: 23.0159, lng: 91.3976 },
  'ফেনী': { lat: 23.0159, lng: 91.3976 },
  'khagrachhari': { lat: 23.1192, lng: 91.9847 },
  'খাগড়াছড়ি': { lat: 23.1192, lng: 91.9847 },
  'lakshmipur': { lat: 22.9447, lng: 90.8282 },
  'লক্ষ্মীপুর': { lat: 22.9447, lng: 90.8282 },
  'noakhali': { lat: 22.8696, lng: 91.0991 },
  'নোয়াখালী': { lat: 22.8696, lng: 91.0991 },
  'rangamati': { lat: 22.6533, lng: 92.1753 },
  'রাঙ্গামাটি': { lat: 22.6533, lng: 92.1753 },

  // Rajshahi Division
  'rajshahi': { lat: 24.3636, lng: 88.6241 },
  'রাজশাহী': { lat: 24.3636, lng: 88.6241 },
  'bogra': { lat: 24.8481, lng: 89.3730 },
  'bogura': { lat: 24.8481, lng: 89.3730 },
  'বগুড়া': { lat: 24.8481, lng: 89.3730 },
  'joypurhat': { lat: 25.1022, lng: 89.0238 },
  'জয়পুরহাট': { lat: 25.1022, lng: 89.0238 },
  'naogaon': { lat: 24.8103, lng: 88.9415 },
  'নওগাঁ': { lat: 24.8103, lng: 88.9415 },
  'natore': { lat: 24.4102, lng: 88.9818 },
  'নাটোর': { lat: 24.4102, lng: 88.9818 },
  'chapainawabganj': { lat: 24.5965, lng: 88.2775 },
  'nawabganj': { lat: 24.5965, lng: 88.2775 },
  'চাঁপাইনবাবগঞ্জ': { lat: 24.5965, lng: 88.2775 },
  'pabna': { lat: 24.0123, lng: 89.2312 },
  'পাবনা': { lat: 24.0123, lng: 89.2312 },
  'sirajganj': { lat: 24.4534, lng: 89.7008 },
  'সিরাজগঞ্জ': { lat: 24.4534, lng: 89.7008 },

  // Khulna Division
  'khulna': { lat: 22.8456, lng: 89.5403 },
  'খুলনা': { lat: 22.8456, lng: 89.5403 },
  'bagerhat': { lat: 22.6516, lng: 89.7859 },
  'বাগেরহাট': { lat: 22.6516, lng: 89.7859 },
  'chuadanga': { lat: 23.6402, lng: 88.8418 },
  'চুয়াডাঙ্গা': { lat: 23.6402, lng: 88.8418 },
  'jhenaidah': { lat: 23.5450, lng: 89.1726 },
  'ঝিনাইদহ': { lat: 23.5450, lng: 89.1726 },
  'jessore': { lat: 23.1664, lng: 89.2081 },
  'jashore': { lat: 23.1664, lng: 89.2081 },
  'যশোর': { lat: 23.1664, lng: 89.2081 },
  'kushtia': { lat: 23.9013, lng: 89.1204 },
  'কুষ্টিয়া': { lat: 23.9013, lng: 89.1204 },
  'magura': { lat: 23.4873, lng: 89.4199 },
  'মাগুরা': { lat: 23.4873, lng: 89.4199 },
  'meherpur': { lat: 23.7622, lng: 88.6318 },
  'মেহেরপুর': { lat: 23.7622, lng: 88.6318 },
  'narail': { lat: 23.1725, lng: 89.5127 },
  'নড়াইল': { lat: 23.1725, lng: 89.5127 },
  'satkhira': { lat: 22.7185, lng: 89.0705 },
  'সাতক্ষীরা': { lat: 22.7185, lng: 89.0705 },

  // Barishal Division
  'barisal': { lat: 22.7010, lng: 90.3535 },
  'barishal': { lat: 22.7010, lng: 90.3535 },
  'বরিশাল': { lat: 22.7010, lng: 90.3535 },
  'barguna': { lat: 22.1570, lng: 90.1256 },
  'বরগুনা': { lat: 22.1570, lng: 90.1256 },
  'bhola': { lat: 22.6859, lng: 90.6482 },
  'ভোলা': { lat: 22.6859, lng: 90.6482 },
  'jhalokati': { lat: 22.6423, lng: 90.1987 },
  'ঝালকাঠি': { lat: 22.6423, lng: 90.1987 },
  'patuakhali': { lat: 22.3596, lng: 90.3298 },
  'পটুয়াখালী': { lat: 22.3596, lng: 90.3298 },
  'pirojpur': { lat: 22.5791, lng: 89.9759 },
  'পিরোজপুর': { lat: 22.5791, lng: 89.9759 },

  // Sylhet Division
  'sylhet': { lat: 24.8949, lng: 91.8687 },
  'সিলেট': { lat: 24.8949, lng: 91.8687 },
  'habiganj': { lat: 24.3749, lng: 91.4155 },
  'হবিগঞ্জ': { lat: 24.3749, lng: 91.4155 },
  'moulvibazar': { lat: 24.4829, lng: 91.7774 },
  'মৌলভীবাজার': { lat: 24.4829, lng: 91.7774 },
  'sunamganj': { lat: 25.0658, lng: 91.3950 },
  'সুনামগঞ্জ': { lat: 25.0658, lng: 91.3950 },

  // Rangpur Division
  'rangpur': { lat: 25.7439, lng: 89.2752 },
  'রংপুর': { lat: 25.7439, lng: 89.2752 },
  'dinajpur': { lat: 25.6217, lng: 88.6354 },
  'দিনাজপুর': { lat: 25.6217, lng: 88.6354 },
  'gaibandha': { lat: 25.3288, lng: 89.5404 },
  'গাইবান্ধা': { lat: 25.3288, lng: 89.5404 },
  'kurigram': { lat: 25.8054, lng: 89.6361 },
  'কুড়িগ্রাম': { lat: 25.8054, lng: 89.6361 },
  'lalmonirhat': { lat: 25.9165, lng: 89.4532 },
  'লালমনিরহাট': { lat: 25.9165, lng: 89.4532 },
  'nilphamari': { lat: 25.9318, lng: 88.8560 },
  'নীলফামারী': { lat: 25.9318, lng: 88.8560 },
  'panchagarh': { lat: 26.3411, lng: 88.5541 },
  'পঞ্চগড়': { lat: 26.3411, lng: 88.5541 },
  'thakurgaon': { lat: 26.0337, lng: 88.4617 },
  'ঠাকুরগাঁও': { lat: 26.0337, lng: 88.4617 },

  // Mymensingh Division
  'mymensingh': { lat: 24.7471, lng: 90.4203 },
  'ময়মনসিংহ': { lat: 24.7471, lng: 90.4203 },
  'jamalpur': { lat: 24.9375, lng: 89.9378 },
  'জামালপুর': { lat: 24.9375, lng: 89.9378 },
  'netrokona': { lat: 24.8709, lng: 90.7279 },
  'নেত্রকোণা': { lat: 24.8709, lng: 90.7279 },
  'sherpur': { lat: 25.0205, lng: 90.0153 },
  'শেরপুর': { lat: 25.0205, lng: 90.0153 },
  'trishal': { lat: 24.5800, lng: 90.3980 },
  'ত্রিশাল': { lat: 24.5800, lng: 90.3980 },

  // International
  'bukayriyah': { lat: 26.1439, lng: 43.6559 },
  'আল-কাসিম': { lat: 26.1439, lng: 43.6559 }
};

const bdSpreadGrid = [
  { lat: 23.8103, lng: 90.4125 }, // Dhaka
  { lat: 24.7471, lng: 90.4203 }, // Mymensingh
  { lat: 22.3569, lng: 91.7832 }, // Chittagong
  { lat: 24.8949, lng: 91.8687 }, // Sylhet
  { lat: 24.3636, lng: 88.6241 }, // Rajshahi
  { lat: 22.8456, lng: 89.5403 }, // Khulna
  { lat: 22.7010, lng: 90.3535 }, // Barisal
  { lat: 25.7439, lng: 89.2752 }, // Rangpur
  { lat: 23.4607, lng: 91.1809 }, // Comilla
  { lat: 23.9999, lng: 90.4203 }, // Gazipur
  { lat: 23.6238, lng: 90.5000 }, // Narayanganj
  { lat: 24.8481, lng: 89.3730 }, // Bogra
  { lat: 24.2513, lng: 89.9167 }, // Tangail
  { lat: 21.4272, lng: 92.0058 }, // Cox's Bazar
  { lat: 23.0159, lng: 91.3976 }, // Feni
  { lat: 22.8696, lng: 91.0991 }, // Noakhali
  { lat: 23.1664, lng: 89.2081 }, // Jessore
  { lat: 24.0123, lng: 89.2312 }, // Pabna
  { lat: 25.6217, lng: 88.6354 }, // Dinajpur
  { lat: 23.9013, lng: 89.1204 }, // Kushtia
  { lat: 23.6071, lng: 89.8425 }, // Faridpur
  { lat: 24.5800, lng: 90.3980 }, // Trishal
  { lat: 23.8500, lng: 90.2500 }, // Savar
  { lat: 23.7500, lng: 90.3800 }  // Dhaka South
];

const resolveCountryMetadata = (rawCountry?: string, rawCity?: string, rawDist?: string) => {
  const c = (rawCountry || '').toLowerCase().trim();
  const city = (rawCity || rawDist || '').toLowerCase().trim();

  if (c.includes('saudi') || c.includes('সৌদি') || c.includes('ksa') || city.includes('riyadh') || city.includes('রিয়াদ') || city.includes('jeddah') || city.includes('জেদ্দা') || city.includes('makkah') || city.includes('মাক্কা') || city.includes('মক্কা') || city.includes('medina') || city.includes('মদিনা') || city.includes('dammam') || city.includes('দাম্মাম')) {
    return { country: 'Saudi Arabia', flag: '🇸🇦', defaultLat: 24.7136, defaultLng: 46.6753 };
  }
  if (c.includes('uae') || c.includes('dubai') || c.includes('আমিরাত') || c.includes('emirates') || city.includes('dubai') || city.includes('দুবাই') || city.includes('abudhabi') || city.includes('আবুধাবি')) {
    return { country: 'UAE', flag: '🇦🇪', defaultLat: 25.2048, defaultLng: 55.2708 };
  }
  if (c.includes('qatar') || c.includes('কাতার') || city.includes('doha') || city.includes('দোহা')) {
    return { country: 'Qatar', flag: '🇶🇦', defaultLat: 25.2854, defaultLng: 51.5310 };
  }
  if (c.includes('oman') || c.includes('ওমান') || city.includes('muscat') || city.includes('মাস্কাট')) {
    return { country: 'Oman', flag: '🇴🇲', defaultLat: 23.5880, defaultLng: 58.3829 };
  }
  if (c.includes('kuwait') || c.includes('কুয়েত')) {
    return { country: 'Kuwait', flag: '🇰🇼', defaultLat: 29.3759, defaultLng: 47.9774 };
  }
  if (c.includes('malaysia') || c.includes('মালয়েশিয়া') || city.includes('kuala') || city.includes('কুয়ালালামপুর')) {
    return { country: 'Malaysia', flag: '🇲🇾', defaultLat: 3.1390, defaultLng: 101.6869 };
  }
  if (c.includes('singapore') || c.includes('সিঙ্গাপুর')) {
    return { country: 'Singapore', flag: '🇸🇬', defaultLat: 1.3521, defaultLng: 103.8198 };
  }
  if (c.includes('usa') || c.includes('united states') || c.includes('যুক্তরাষ্ট্র') || c.includes('america') || city.includes('new york') || city.includes('নিউ ইয়র্ক')) {
    return { country: 'United States', flag: '🇺🇸', defaultLat: 40.7128, defaultLng: -74.0060 };
  }
  if (c.includes('uk') || c.includes('united kingdom') || c.includes('যুক্তরাজ্য') || c.includes('england') || city.includes('london') || city.includes('লন্ডন')) {
    return { country: 'United Kingdom', flag: '🇬🇧', defaultLat: 51.5074, defaultLng: -0.1278 };
  }
  if (c.includes('italy') || c.includes('ইতালি') || city.includes('rome') || city.includes('রোম')) {
    return { country: 'Italy', flag: '🇮🇹', defaultLat: 41.9028, defaultLng: 12.4964 };
  }

  return { country: rawCountry || 'Bangladesh', flag: (rawCountry && rawCountry !== 'Bangladesh' && rawCountry !== 'বাংলাদেশ') ? '🌐' : '🇧🇩', defaultLat: 23.8103, defaultLng: 90.4125 };
};

const matchesCountryName = (agentCountry: string, filter: string) => {
  if (!filter || filter === 'all') return true;
  const c = (agentCountry || '').toLowerCase().trim();
  const f = filter.toLowerCase().trim();
  if (c === f) return true;
  if (f.includes('saudi') || f.includes('সৌদি') || f.includes('ksa')) {
    return c.includes('saudi') || c.includes('সৌদি') || c.includes('ksa');
  }
  if (f.includes('uae') || f.includes('dubai') || f.includes('দুবাই') || f.includes('আমিরাত')) {
    return c.includes('uae') || c.includes('dubai') || c.includes('আমিরাত') || c.includes('emirates');
  }
  if (f.includes('qatar') || f.includes('কাতার')) {
    return c.includes('qatar') || c.includes('কাতার');
  }
  if (f.includes('oman') || f.includes('ওমান')) {
    return c.includes('oman') || c.includes('ওমান');
  }
  if (f.includes('kuwait') || f.includes('কুয়েত')) {
    return c.includes('kuwait') || c.includes('কুয়েত');
  }
  if (f.includes('malaysia') || f.includes('মালয়েশিয়া')) {
    return c.includes('malaysia') || c.includes('মালয়েশিয়া');
  }
  if (f.includes('singapore') || f.includes('সিঙ্গাপুর')) {
    return c.includes('singapore') || c.includes('সিঙ্গাপুর');
  }
  if (f.includes('usa') || f.includes('states') || f.includes('যুক্তরাষ্ট্র') || f.includes('আমেরিকা')) {
    return c.includes('usa') || c.includes('united states') || c.includes('যুক্তরাষ্ট্র') || c.includes('america');
  }
  if (f.includes('uk') || f.includes('kingdom') || f.includes('যুক্তরাজ্য') || f.includes('লন্ডন')) {
    return c.includes('uk') || c.includes('united kingdom') || c.includes('যুক্তরাজ্য') || c.includes('london');
  }
  if (f.includes('bangladesh') || f.includes('বাংলাদেশ')) {
    return c.includes('bangladesh') || c.includes('বাংলাদেশ') || c.includes('bd');
  }
  return c.includes(f);
};

const assignUniqueAgentCoordinates = (list: Agent[]): Agent[] => {
  return list.map((agent, index) => {
    const meta = resolveCountryMetadata(agent.country, agent.city, agent.district);
    const resolvedCountry = meta.country;
    const resolvedFlag = agent.flag && agent.flag !== '🌐' && agent.flag !== '🇧🇩' ? agent.flag : meta.flag;

    // Check if real GPS coordinates already exist for this user/agent
    if (
      agent.hasRealGPS ||
      (
        typeof agent.realLat === 'number' && 
        typeof agent.realLng === 'number' && 
        agent.realLat !== 0 && 
        agent.realLng !== 0 &&
        !(Math.abs(agent.realLat - 23.8103) < 0.00001 && Math.abs(agent.realLng - 90.4125) < 0.00001)
      )
    ) {
      return {
        ...agent,
        country: resolvedCountry,
        flag: resolvedFlag
      };
    }

    // If international agent, use country default coordinates with small offset
    if (resolvedCountry !== 'Bangladesh') {
      const latOffset = (((index * 7) % 11) - 5) * 0.015;
      const lngOffset = (((index * 13) % 13) - 6) * 0.015;
      const finalLat = Number((meta.defaultLat + latOffset).toFixed(5));
      const finalLng = Number((meta.defaultLng + lngOffset).toFixed(5));
      return {
        ...agent,
        country: resolvedCountry,
        flag: resolvedFlag,
        lat: agent.lat || finalLat,
        lng: agent.lng || finalLng,
        realLat: agent.realLat || finalLat,
        realLng: agent.realLng || finalLng
      };
    }

    // Bangladesh agent logic without exact GPS - lookup district coordinates
    const distLower = (agent.district || agent.city || agent.thana || '').toLowerCase().trim();
    let baseCoord = districtCoordinatesMap[distLower];

    if (!baseCoord) {
      const foundKey = Object.keys(districtCoordinatesMap).find(k => distLower.includes(k) || k.includes(distLower));
      if (foundKey) {
        baseCoord = districtCoordinatesMap[foundKey];
      }
    }

    if (!baseCoord) {
      baseCoord = bdSpreadGrid[index % bdSpreadGrid.length];
    }

    const latOffset = (((index * 13) % 17) - 8) * 0.012;
    const lngOffset = (((index * 29) % 19) - 9) * 0.012;

    const finalLat = Number((baseCoord.lat + latOffset).toFixed(5));
    const finalLng = Number((baseCoord.lng + lngOffset).toFixed(5));

    return {
      ...agent,
      country: resolvedCountry,
      flag: resolvedFlag,
      lat: agent.lat || finalLat,
      lng: agent.lng || finalLng,
      realLat: agent.realLat || finalLat,
      realLng: agent.realLng || finalLng
    };
  });
};

  // Agent Dashboard Input States
  const [dashName, setDashName] = useState<string>('');
  const [dashCity, setDashCity] = useState<string>('');
  const [dashCountry, setDashCountry] = useState<string>('');
  const [dashPhone, setDashPhone] = useState<string>('');
  const [dashWhats, setDashWhats] = useState<string>('');
  const [dashMsg, setDashMsg] = useState<string>('');
  const [dashDist, setDashDist] = useState<string>('');
  const [dashThana, setDashThana] = useState<string>('');
  const [dashPost, setDashPost] = useState<string>('');

  const parseCoordinatesFromInput = (input: string): { lat: number; lng: number } | null => {
    if (!input || !input.trim()) return null;
    const str = input.trim();

    // Match standard lat, lng e.g. "23.8103, 90.4125"
    const directMatch = str.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
    if (directMatch) {
      const lat = parseFloat(directMatch[1]);
      const lng = parseFloat(directMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    // Match Google Maps URL patterns e.g. /@23.8103,90.4125 or ?q=23.8103,90.4125
    const urlMatch = str.match(/([@-]?\d+\.\d+)[,\/]+([@-]?\d+\.\d+)/);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1].replace('@', ''));
      const lng = parseFloat(urlMatch[2].replace('@', ''));
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    return null;
  };

  const parseCoord = (val: any): number | undefined => {
    if (typeof val === 'number' && !isNaN(val) && val !== 0) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const p = parseFloat(val);
      if (!isNaN(p) && p !== 0) return p;
    }
    return undefined;
  };

  const fetchAgents = async () => {
    try {
      const agentsMap = new globalThis.Map<string, Agent>();

      const processDataAndAdd = (docId: string, data: any) => {
        if (!data) return;
        const name = data.name || data.userName || data.fullName || data.agentName || data.memberName || '';
        const phone = data.phone || data.mobile || data.whatsNumber || data.userPhone || data.phoneNumber || '';
        if (!name && !phone) return;

        const avatar = resolveAgentAvatar(data, name);

        const shopMapLink = data.shopMapLink || data.manualMapLink || data.mapLink || data.googleMapUrl || data.locationUrl || data.shopLocationLink || '';
        const locationNumber = data.locationNumber || data.shopNumber || data.locationCode || '';

        // Safely extract lat/lng from all possible property names
        const rawLat = data.realLat ?? data.lat ?? data.latitude ?? data.gpsLat ?? data.userLat ?? (data.location && (data.location.lat ?? data.location.latitude));
        const rawLng = data.realLng ?? data.lng ?? data.longitude ?? data.gpsLng ?? data.userLng ?? (data.location && (data.location.lng ?? data.location.longitude));

        let parsedLat = parseCoord(rawLat);
        let parsedLng = parseCoord(rawLng);

        if ((parsedLat === undefined || parsedLng === undefined) && shopMapLink) {
          const parsedFromLink = parseCoordinatesFromInput(shopMapLink);
          if (parsedFromLink) {
            parsedLat = parsedFromLink.lat;
            parsedLng = parsedFromLink.lng;
          }
        }

        const meta = resolveCountryMetadata(data.country, data.city || data.area, data.district);

        const hasRealGPS = data.hasRealGPS === true || (parsedLat !== undefined && parsedLng !== undefined &&
                           !(Math.abs(parsedLat - 23.8103) < 0.00001 && Math.abs(parsedLng - 90.4125) < 0.00001));

        const lat = parsedLat !== undefined ? parsedLat : meta.defaultLat;
        const lng = parsedLng !== undefined ? parsedLng : meta.defaultLng;

        const key = phone.trim() || docId;

        const agentObj: Agent = {
          id: docId,
          name: name || 'এজেন্ট সদস্য',
          role: data.role || data.agentRole || (data.isAgent ? 'অফিসিয়াল এজেন্ট' : 'সহযোগী সদস্য'),
          country: meta.country,
          flag: meta.flag,
          city: data.city || data.area || data.district || 'ঢাকা',
          phone: phone,
          lat: lat,
          lng: lng,
          realLat: lat,
          realLng: lng,
          hasRealGPS: hasRealGPS,
          shopMapLink: shopMapLink,
          locationNumber: locationNumber,
          bdX: typeof data.bdX === 'number' ? data.bdX : 50,
          bdY: typeof data.bdY === 'number' ? data.bdY : 50,
          img: avatar,
          district: data.district || data.division || data.state || '',
          thana: data.thana || data.areaName || data.upazila || data.area || data.postOffice || '',
          postOffice: data.postOffice || '',
          verified: data.verified !== undefined ? data.verified : true,
          status: data.status === 'Busy' ? 'Busy' : data.status === 'Offline' ? 'Offline' : 'Available',
          lastSeen: data.lastSeen || 'Active Now',
          whatsapp: data.whatsapp || data.whatsNumber || phone,
          messenger: data.messenger || '',
          liveLocationEnabled: data.liveLocationEnabled !== undefined ? data.liveLocationEnabled : true
        };

        if (!agentsMap.has(key)) {
          agentsMap.set(key, agentObj);
        } else {
          const existing = agentsMap.get(key)!;
          if (hasRealGPS && !existing.hasRealGPS) {
            existing.lat = lat;
            existing.lng = lng;
            existing.realLat = lat;
            existing.realLng = lng;
            existing.hasRealGPS = true;
          }
          if (!existing.img.includes('ui-avatars.com') && avatar.includes('ui-avatars.com')) {
            // Keep existing custom photo
          } else if (avatar && !avatar.includes('ui-avatars.com')) {
            existing.img = avatar;
          }
          if (!existing.district && (data.district || data.division)) existing.district = data.district || data.division;
          if (!existing.thana && (data.thana || data.areaName || data.area)) existing.thana = data.thana || data.areaName || data.area;
          if (!existing.phone && phone) existing.phone = phone;
        }
      };

      // 1. Query 'agents' collection
      try {
        const snap1 = await getDocs(collection(db, 'agents'));
        snap1.forEach((doc) => processDataAndAdd(doc.id, doc.data()));
      } catch (e) {
        console.error('Error loading agents collection:', e);
      }

      // 2. Query 'bap_agents' collection
      try {
        const snap2 = await getDocs(collection(db, 'bap_agents'));
        snap2.forEach((doc) => processDataAndAdd(doc.id, doc.data()));
      } catch (e) {
        console.error('Error loading bap_agents collection:', e);
      }

      // 3. Query 'agent_requests' collection
      try {
        const snap3 = await getDocs(collection(db, 'agent_requests'));
        snap3.forEach((doc) => processDataAndAdd(doc.id, doc.data()));
      } catch (e) {
        console.error('Error loading agent_requests collection:', e);
      }

      // 4. Query 'users' collection (loads all registered users/agents)
      try {
        const snap4 = await getDocs(collection(db, 'users'));
        snap4.forEach((doc) => {
          const data = doc.data();
          processDataAndAdd(doc.id, data);
        });
      } catch (e) {
        console.error('Error loading users collection:', e);
      }

      // 5. Query 'agentLocations' collection (High precision real-time GPS coordinates)
      try {
        const snapLocs = await getDocs(collection(db, 'agentLocations'));
        snapLocs.forEach((docSnap) => {
          const loc = docSnap.data();
          if (loc && loc.userId) {
            const existing = agentsMap.get(loc.userId) || Array.from(agentsMap.values()).find((a: Agent) => a.phone === loc.phone);
            if (existing) {
              existing.lat = loc.latitude;
              existing.lng = loc.longitude;
              existing.realLat = loc.latitude;
              existing.realLng = loc.longitude;
              existing.hasRealGPS = true;
              existing.accuracy = loc.accuracy;
              existing.altitude = loc.altitude;
              existing.heading = loc.heading;
              existing.speed = loc.speed;
              existing.lastUpdatedTs = loc.lastUpdatedTs;
              if (loc.isOnline !== undefined) {
                existing.status = loc.isOnline ? 'Available' : 'Offline';
              }
              if (loc.isSharingLocation !== undefined) {
                existing.isSharingLocation = loc.isSharingLocation;
              }
            } else {
              const newFromLoc: Agent = {
                id: loc.userId,
                name: loc.name || 'এজেন্ট',
                role: loc.role || 'অফিসিয়াল এজেন্ট',
                country: loc.country || 'Bangladesh',
                flag: '🇧🇩',
                city: loc.city || 'ঢাকা',
                phone: loc.phone || '',
                lat: loc.latitude,
                lng: loc.longitude,
                realLat: loc.latitude,
                realLng: loc.longitude,
                hasRealGPS: true,
                accuracy: loc.accuracy,
                altitude: loc.altitude,
                heading: loc.heading,
                speed: loc.speed,
                lastUpdatedTs: loc.lastUpdatedTs,
                img: loc.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.name || 'Agent')}&background=0D9488&color=fff`,
                verified: true,
                status: loc.isOnline ? 'Available' : 'Offline',
                isSharingLocation: loc.isSharingLocation
              };
              agentsMap.set(loc.userId, newFromLoc);
            }
          }
        });
      } catch (e) {
        console.error('Error loading agentLocations collection:', e);
      }

      let fetchedAgentsList: Agent[] = Array.from(agentsMap.values());

      // Filter out demo keywords if explicitly named "demo" or "test"
      fetchedAgentsList = fetchedAgentsList.filter(agent => {
        const nameLower = agent.name.toLowerCase();
        const idLower = agent.id.toLowerCase();
        if (nameLower.includes('demo') || nameLower.includes('mock') || idLower.startsWith('demo-')) return false;
        return true;
      });

      // Spread and assign unique coordinates to every agent so all show up on map
      fetchedAgentsList = assignUniqueAgentCoordinates(fetchedAgentsList);

      setAgentsList(fetchedAgentsList);

      // Match current logged in user
      const matched = fetchedAgentsList.find(a => a.phone === user.phone || a.id === user.uid);
      if (matched) {
        setMyAgentProfile(matched);
        setDashName(matched.name);
        setDashCity(matched.city);
        setDashCountry(matched.country);
        setDashPhone(matched.phone);
        setDashWhats(matched.whatsapp || matched.phone);
        setDashMsg(matched.messenger || '');
        setDashDist(matched.district || '');
        setDashThana(matched.thana || '');
        setDashPost(matched.postOffice || '');
      } else if (user.role === 'agent') {
        const userAvatar = resolveAgentAvatar(user, user.name || 'নতুন এজেন্ট');
        const stubAgent: Agent = {
          id: user.uid,
          name: user.name || 'নতুন এজেন্ট অংশীদার',
          role: 'Co-op Agent',
          country: 'Bangladesh',
          flag: '🇧🇩',
          city: 'Dhaka',
          phone: user.phone || '',
          lat: 23.8103,
          lng: 90.4125,
          img: userAvatar,
          verified: true,
          status: 'Available',
          lastSeen: 'Active Now'
        };
        setMyAgentProfile(stubAgent);
        setDashName(stubAgent.name);
        setDashCity(stubAgent.city);
        setDashCountry(stubAgent.country);
        setDashPhone(stubAgent.phone);
      }
    } catch (err) {
      console.error('Error fetching dynamic agents: ', err);
    }
  };

  useEffect(() => {
    fetchAgents();
    detectUserLocation();

    // High precision watcher for continuous background sync
    let stopWatcher: (() => void) | null = null;
    if (user.uid && isSharingLocation) {
      stopWatcher = startWatchingHighPrecisionLocation(
        user.uid,
        {
          name: user.name || 'সদস্য',
          phone: user.phone || '',
          role: user.role === 'agent' ? 'অফিসিয়াল এজেন্ট' : 'মেম্বার',
          profileImage: resolveAgentAvatar(user, user.name || 'User')
        },
        (coords) => {
          setUserLocation(coords);
          setGpsAccuracy(coords.accuracy || null);
        }
      );
    }

    // Subscribe to system settings / app_config for real-time manual vs auto location setting
    const unsubConfig = onSnapshot(doc(db, 'system_settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.allowManualAgentLocation !== undefined) {
          setAllowManualLocation(data.allowManualAgentLocation);
        }
      }
    });

    // Subscribe to real-time updates for agents, requests, users, and high precision agentLocations
    const unsub1 = onSnapshot(collection(db, 'agents'), () => fetchAgents(), err => console.error(err));
    const unsub2 = onSnapshot(collection(db, 'bap_agents'), () => fetchAgents(), err => console.error(err));
    const unsub3 = onSnapshot(collection(db, 'agent_requests'), () => fetchAgents(), err => console.error(err));
    const unsub4 = onSnapshot(collection(db, 'users'), () => fetchAgents(), err => console.error(err));
    const unsub5 = onSnapshot(collection(db, 'agentLocations'), () => fetchAgents(), err => console.error(err));

    return () => {
      if (stopWatcher) stopWatcher();
      unsubConfig();
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [user.uid, isSharingLocation]);

  // Auto fetch address when applicant opens application tab
  useEffect(() => {
    if (activeTab === 'apply' && (!district || !areaName)) {
      handleAutoFetchAddress();
    }
  }, [activeTab]);

  // Fetch submitted applications for the current user
  const fetchMyApplications = async () => {
    if (!user.uid) return;
    setLoadingApps(true);
    try {
      const qApps = (user.role === 'admin' || user.role === 'sub_admin')
        ? collection(db, 'agent_requests')
        : query(
            collection(db, 'agent_requests'),
            where('userId', '==', user.uid)
          );
      const snap = await getDocs(qApps);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort client-side by createdAt descending
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setUserApplications(list);
    } catch (err) {
      console.error('Error fetching agent requests: ', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleApproveApplication = async (app: any) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই এজেন্ট আবেদনটি অনুমোদন করতে চান?')) return;
    try {
      // 1. Update request status to approved
      await updateDoc(doc(db, 'agent_requests', app.id), {
        status: 'approved',
        processedAt: serverTimestamp()
      });

      // 2. Add to active agents collection
      const newAgentId = 'agent_' + app.userId;
      const newAgentObj = {
        id: newAgentId,
        name: app.userName,
        role: app.role || 'AMB Co-op Agent',
        country: app.country || 'Bangladesh',
        flag: '🇧🇩',
        city: app.area || 'ঢাকা',
        phone: app.phone,
        lat: app.lat || 23.8103, // default lat for Dhaka
        lng: app.lng || 90.4125, // default lng for Dhaka
        realLat: app.lat || 23.8103,
        realLng: app.lng || 90.4125,
        hasRealGPS: true,
        shopMapLink: app.shopMapLink || '',
        locationNumber: app.locationNumber || '',
        img: resolveAgentAvatar(app, app.userName),
        district: app.district || 'ঢাকা',
        thana: app.thana || 'গুলশান',
        postOffice: app.postOffice || 'ঢাকা',
        verified: true,
        status: 'Available',
        lastSeen: 'সদ্য অনলাইন',
        whatsapp: app.whatsNumber || app.phone,
        messenger: '',
        liveLocationEnabled: true,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'agents', newAgentId), newAgentObj);

      // 3. Dispatch dynamic notification to user's inbox
      const noticeId = 'notice_' + Date.now();
      await setDoc(doc(db, 'user_notifications', noticeId), {
        id: noticeId,
        userId: app.userId,
        title: '🛡️ এজেন্ট অনুমোদন বিজ্ঞপ্তি',
        content: `অভিনন্দন ${app.userName}! আপনার কো-অপারেটিভ এজেন্ট হওয়ার আবেদনটি সফলভাবে অনুমোদিত হয়েছে। এখন থেকে আপনি আমাদের অফিসিয়াল রিপ্রেজেন্টেティブ ম্যাপে যুক্ত হয়েছেন।`,
        createdAt: new Date().toISOString(),
        read: false
      });

      console.log('আবেদনপত্রটি সফলভাবে অনুমোদিত হয়েছে এবং এজেন্ট সক্রিয় করা হয়েছে!');
      fetchMyApplications();
      fetchAgents();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  const handleRejectApplication = async (app: any) => {
    const reason = window.prompt('আবেদনটি বাতিল করার কারণ লিখুন (ঐচ্ছিক):');
    if (reason === null) return; // cancelled
    try {
      // 1. Update request status to rejected
      await updateDoc(doc(db, 'agent_requests', app.id), {
        status: 'rejected',
        processedAt: serverTimestamp(),
        rejectReason: reason || 'তথ্য অসম্পূর্ণ বা ক্রুটিপূর্ণ'
      });

      // 2. Dispatch dynamic notification to user's inbox
      const noticeId = 'notice_' + Date.now();
      await setDoc(doc(db, 'user_notifications', noticeId), {
        id: noticeId,
        userId: app.userId,
        title: '❌ এজেন্ট আবেদন বাতিল',
        content: `দুঃখিত ${app.userName}, আপনার এজেন্ট হওয়ার আবেদনটি বাতিল করা হয়েছে। কারণঃ ${reason || 'তথ্য অসম্পূর্ণ বা ক্রুটিপূর্ণ'}`,
        createdAt: new Date().toISOString(),
        read: false
      });

      console.log('আবেদনপত্রটি বাতিল করা হয়েছে!');
      fetchMyApplications();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'agents', id));
      console.log('এজেন্ট সফলভাবে ডিলিট করা হয়েছে!');
      // Also reset selected agent state
      setHighlightedAgentId(null);
      fetchAgents();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-applications') {
      fetchMyApplications();
    }
  }, [activeTab]);

  // Reverse Geocoding Coordinates to District & Area/Thana
  const fetchAddressFromCoords = async (latitude: number, longitude: number) => {
    setIsFetchingAddress(true);
    setErrorMessage('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=bn,en`
      );
      
      if (!response.ok) {
        throw new Error('ঠিকানা সার্ভার থেকে সাড়া পাওয়া যায়নি।');
      }
      
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        
        let rawDistrict = addr.district || addr.state_district || addr.city || addr.state || '';
        let cleanDistrict = rawDistrict
          .replace(/District/gi, '')
          .replace(/Division/gi, '')
          .replace(/City/gi, '')
          .trim();
          
        let cleanArea = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.county || addr.town || addr.municipality || addr.road || '';
        cleanArea = cleanArea.trim();
        
        if (!cleanDistrict) {
          cleanDistrict = 'ঢাকা';
        }
        if (!cleanArea) {
          cleanArea = 'চিহ্নিত এলাকা';
        }

        setDistrict(cleanDistrict);
        setAreaName(cleanArea);
        setApplyLat(latitude);
        setApplyLng(longitude);
        
        if (!userLocation) {
          setUserLocation({ lat: latitude, lng: longitude });
        }
        return { district: cleanDistrict, area: cleanArea };
      }
    } catch (error: any) {
      console.error('Reverse geocoding error:', error);
      setErrorMessage('ঠিকানা লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsFetchingAddress(false);
    }
    return null;
  };

  // Smart Geocoding for Map Link or Location Text
  const geocodeTextOrLink = async (textInput: string) => {
    if (!textInput || !textInput.trim()) return null;
    setIsFetchingAddress(true);
    
    // Check direct coordinates first
    const parsedCoords = parseCoordinatesFromInput(textInput);
    if (parsedCoords) {
      return await fetchAddressFromCoords(parsedCoords.lat, parsedCoords.lng);
    }

    // Try extracting place name from URL or text
    let queryText = textInput.trim();
    if (queryText.includes('google.com/maps/place/')) {
      const parts = queryText.split('google.com/maps/place/');
      if (parts[1]) {
        queryText = decodeURIComponent(parts[1].split('/')[0].replace(/\+/g, ' '));
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&accept-language=bn,en&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return await fetchAddressFromCoords(lat, lon);
        }
      }
    } catch (err) {
      console.error('Search geocode error:', err);
    } finally {
      setIsFetchingAddress(false);
    }
    return null;
  };

  // Handle Auto-Fetch GPS Address
  const handleAutoFetchAddress = () => {
    setIsFetchingAddress(true);
    setErrorMessage('');
    
    if (!navigator.geolocation) {
      setErrorMessage('আপনার ব্রাউজারে জিপিএস লোকেশন সনাক্ত করার সুবিধা নেই।');
      setIsFetchingAddress(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await fetchAddressFromCoords(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'জিপিএস দিয়ে আপনার অবস্থান সনাক্ত করতে ব্যর্থ হয়েছে।';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'অনুগ্রহ করে ব্রাউজারে জিপিএস লোকেশন পারমিশন দিন।';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'জিপিএস নেটওয়ার্ক পাওয়া যায়নি।';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'লোকেশন সনাক্ত করতে সময় শেষ হয়েছে (Timeout)।';
        }
        setErrorMessage(errorMsg);
        setIsFetchingAddress(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Handle application submission
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !fullName || !district || !areaName) {
      setErrorMessage('অনুগ্রহ করে সঠিক তথ্য দিয়ে ফরমটি পূর্ণাঙ্গ রূপ দিন।');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // If shopMapLink was entered, try to extract coordinates if applyLat is not set
      let finalLat = applyLat || (userLocation ? userLocation.lat : 23.8103);
      let finalLng = applyLng || (userLocation ? userLocation.lng : 90.4125);

      if (shopMapLink && (!applyLat || !applyLng)) {
        const parsed = parseCoordinatesFromInput(shopMapLink);
        if (parsed) {
          finalLat = parsed.lat;
          finalLng = parsed.lng;
        }
      }

      const newRequest = {
        userId: user.uid,
        userName: fullName,
        phone: phoneNumber,
        email: emailAddress,
        district,
        area: areaName,
        experience,
        whatsapp: whatsNumber || phoneNumber,
        motivation: motivation || 'কোনো বিবরণ দেওয়া হয়নি',
        shopMapLink: shopMapLink || '',
        locationNumber: locationNumber || '',
        status: 'pending', // pending, reviewed, approved, rejected
        createdAt: serverTimestamp(),
        appliedAtStr: new Date().toLocaleString('bn-BD'),
        lat: finalLat,
        lng: finalLng,
        realLat: finalLat,
        realLng: finalLng,
        hasRealGPS: true
      };

      await addDoc(collection(db, 'agent_requests'), newRequest);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন BNB এজেন্ট ও প্রতিনিধি আবেদন',
        message: `${user.name || 'সদস্য'} (${(user as any).memberId || 'N/A'}) এজেন্ট হিসেবে আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        userPhone: user.phone || '',
        type: 'agent_application',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));

      // Also save into user profile so shop location link is immediately saved
      if (user.uid) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            district,
            thana: areaName,
            area: areaName,
            shopMapLink: shopMapLink || '',
            realLat: finalLat,
            realLng: finalLng,
            hasRealGPS: true
          });
        } catch (e) {
          console.error(e);
        }
      }
      
      setSuccessMessage('আপনার এজেন্ট হওয়ার আবেদনটি সফলভাবে বাংলাদেশ কো-অপারেティブ কেন্দ্রীয় সার্ভারে দাখিল করা হয়েছে! আমাদের টিম 3 কর্মদিবসের মধ্যে যোগাযোগ করবে।');
      
      // Clear fields
      setDistrict('');
      setAreaName('');
      setWhatsNumber('');
      setMotivation('');
      setShopMapLink('');
      setLocationNumber('');
      setApplyLat(null);
      setApplyLng(null);

      // Redirect to feedback or "my application"
      setTimeout(() => {
        setActiveTab('my-applications');
        setSuccessMessage('');
      }, 3500);

    } catch (err: any) {
      setErrorMessage('পদ্ধতিগত ত্রুটি: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfFetchGPS = () => {
    setIsProfFetchingGPS(true);
    setProfError('');
    setProfSuccess('');

    if (!navigator.geolocation) {
      setProfError('আপনার ব্রাউজারে জিপিএস সনাক্তকরণ সমর্থন করে না।');
      setIsProfFetchingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setProfLat(latitude);
        setProfLng(longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=bn,en`
          );
          if (!res.ok) throw new Error('Reverse geocoding failed');
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;

            let rawDistrict = addr.district || addr.state_district || addr.city || addr.state || '';
            let cleanDistrict = rawDistrict
              .replace(/District/gi, '')
              .replace(/Division/gi, '')
              .replace(/City/gi, '')
              .trim();

            let cleanArea = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.county || addr.town || addr.municipality || addr.road || '';
            cleanArea = cleanArea.trim();

            const detectedCountry = addr.country || 'Bangladesh';

            setProfDist(cleanDistrict || 'বাংলাদেশ');
            setProfThana(cleanArea || 'চিহ্নিত এলাকা');
            setProfCity(cleanArea || addr.city || 'চিহ্নিত শহর');
            setProfCountry(detectedCountry);
            setProfSuccess('আপনার জিপিএস লোকেশন ও ঠিকানা সফলভাবে সনাক্ত করা হয়েছে!');
          } else {
            setProfSuccess('লোকেশন কোঅর্ডিনেট সেট করা হয়েছে। জেলা/থানা অনুগ্রহ করে টাইপ করুন।');
          }
        } catch (e) {
          console.error(e);
          setProfSuccess('লোকেশন কোঅর্ডিনেট সেট করা হয়েছে (সার্ভার অফলাইন)।');
        } finally {
          setIsProfFetchingGPS(false);
        }
      },
      (err) => {
        console.error(err);
        setProfError('জিপিএস লোকেশন এক্সেস ব্যর্থ হয়েছে। অনুগ্রহ করে ব্রাউজার পারমিশন চেক করুন।');
        setIsProfFetchingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleProfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName || !profPhone || !profDist || !profThana) {
      setProfError('অনুগ্রহ করে নাম, সচল ফোন নম্বর, জেলা ও থানা সহ পূর্ণাঙ্গ তথ্য দিন।');
      return;
    }

    setIsProfSubmitting(true);
    setProfError('');
    setProfSuccess('');

    try {
      const newRequest = {
        userId: user.uid,
        userName: profName,
        phone: profPhone,
        whatsNumber: profWhats || profPhone,
        country: profCountry,
        area: profCity || profThana,
        city: profCity || profThana,
        district: profDist,
        thana: profThana,
        postOffice: profPost || '',
        lat: profLat,
        lng: profLng,
        experience: myAgentProfile ? 'প্রোফাইল সংশোধন আবেদন' : 'নতুন এজেন্ট তালিকাভুক্তি',
        status: 'pending',
        createdAt: serverTimestamp(),
        appliedAtStr: new Date().toLocaleString('bn-BD')
      };

      await addDoc(collection(db, 'agent_requests'), newRequest);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন BNB এজেন্ট ও প্রতিনিধি আবেদন',
        message: `${user.name || 'সদস্য'} (${(user as any).memberId || 'N/A'}) এজেন্ট হিসেবে আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        userPhone: user.phone || '',
        type: 'agent_application',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      
      setProfSuccess('আপনার পরিবর্তনের আবেদনটি সফলভাবে দাখিল করা হয়েছে! অ্যাডমিন অনুমোদন করার সাথে সাথে এটি ম্যাপে আপডেট হয়ে যাবে।');
      
      setTimeout(() => {
        setActiveTab('my-applications');
        setProfSuccess('');
      }, 3000);

    } catch (err: any) {
      setProfError('পদ্ধতিগত ত্রুটি: ' + err.message);
    } finally {
      setIsProfSubmitting(false);
    }
  };

  // Agent Control Panel Operations
  const handleUpdateAgentStatus = async (newStatus: 'Available' | 'Busy' | 'Offline') => {
    if (!myAgentProfile) return;
    try {
      const updateData = { status: newStatus, lastSeen: newStatus === 'Available' ? 'Active Now' : newStatus === 'Busy' ? 'Busy' : 'Active 5m ago' };
      await updateDoc(doc(db, 'agents', myAgentProfile.id), updateData);
      await updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {});
      
      setMyAgentProfile(prev => prev ? { ...prev, ...updateData } : null);
      setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? { ...a, ...updateData } : a));
    } catch (e: any) {
      console.error('Error updating status: ' + e.message);
    }
  };

  const handleToggleLiveLocation = async (enabled: boolean) => {
    if (!myAgentProfile) return;
    try {
      const updateData = { liveLocationEnabled: enabled };
      await updateDoc(doc(db, 'agents', myAgentProfile.id), updateData);
      await updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {});
      
      setMyAgentProfile(prev => prev ? { ...prev, ...updateData } : null);
      setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? { ...a, ...updateData } : a));
    } catch (e: any) {
      console.error('Error toggling location broadcast: ' + e.message);
    }
  };

  const handleUpdateAgentCoordinates = () => {
    if (!myAgentProfile) return;
    if (!navigator.geolocation) {
      console.warn('GPS is not supported on this browser.');
      return;
    }
    setIsUpdatingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const latVal = pos.coords.latitude;
          const lngVal = pos.coords.longitude;
          const updateData = {
            lat: latVal,
            lng: lngVal,
            realLat: latVal,
            realLng: lngVal,
            latitude: latVal,
            longitude: lngVal,
            hasRealGPS: true,
            liveLocationEnabled: true,
            lastSeen: 'Active Now'
          };
          await updateDoc(doc(db, 'agents', myAgentProfile.id), updateData).catch(() => {});
          await updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {});
          await updateDoc(doc(db, 'users', user.uid), updateData).catch(() => {});
          if (myAgentProfile.id !== user.uid) {
            await updateDoc(doc(db, 'users', myAgentProfile.id), updateData).catch(() => {});
          }
          
          setMyAgentProfile(prev => prev ? { ...prev, ...updateData, hasRealGPS: true } : null);
          setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? { ...a, ...updateData, hasRealGPS: true } : a));
          console.log('আপনার লাইভ জিপিএস অবস্থান সফলভাবে ডাটাবেসে আপডেট করা হয়েছে!');
        } catch (err: any) {
          console.error('Failed to update coordinates in database: ' + err.message);
        } finally {
          setIsUpdatingLoc(false);
        }
      },
      (err) => {
        console.warn('GPS detection failed: ' + err.message);
        setIsUpdatingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveAgentProfile = async (profileData: any) => {
    if (!myAgentProfile) return;
    setIsSavingAgentProfile(true);
    try {
      await setDoc(doc(db, 'agents', myAgentProfile.id), { ...myAgentProfile, ...profileData }, { merge: true });
      await setDoc(doc(db, 'bap_agents', myAgentProfile.id), { ...myAgentProfile, ...profileData }, { merge: true }).catch(() => {});
      
      const updatedProfile = { ...myAgentProfile, ...profileData };
      setMyAgentProfile(updatedProfile);
      setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? updatedProfile : a));
      console.log('প্রোফাইল তথ্য সফলভাবে সেভ করা হয়েছে!');
    } catch (err: any) {
      console.error('Failed to save profile: ' + err.message);
    } finally {
      setIsSavingAgentProfile(false);
    }
  };

  // Perform localized proximity scanning simulation
  const handleLocalProximitySearch = () => {
    if (isScanning) return;
    setIsScanning(true);
    setClosestAgent(null);

    setTimeout(() => {
      setIsScanning(false);
      // Select closest real agent from agentsList
      let closest: Agent | null = null;
      if (userLocation && agentsList.length > 0) {
        let minDist = Infinity;
        agentsList.forEach(a => {
          const d = getDistanceInKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
          if (d < minDist) {
            minDist = d;
            closest = a;
          }
        });
      }
      if (!closest && agentsList.length > 0) {
        closest = agentsList[0];
      }
      if (closest) {
        setClosestAgent(closest);
        setHighlightedAgentId((closest as Agent).id);
      }
      
      // Scroll to agent map pins or filter
      setMapType('bangladesh');
    }, 2200);
  };

  // Zoom map handlers
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 1));

  // Extract unique cities for filtering options
  const uniqueCities = useMemo(() => {
    const cities = new Set(agentsList.map((a, _idx) => a.city));
    return Array.from(cities);
  }, [agentsList]);

  // Filtering agent list logically
  const filteredAgents = useMemo(() => {
    return agentsList.filter(agent => {
      const queryLower = searchQuery.toLowerCase();
      const agentIdStr = `AMB-AGT-${agent.id.substring(0,6).toUpperCase()}`;
      const matchesSearch = 
        agent.name.toLowerCase().includes(queryLower) ||
        agent.country.toLowerCase().includes(queryLower) ||
        agent.city.toLowerCase().includes(queryLower) ||
        agent.phone.includes(queryLower) ||
        agentIdStr.toLowerCase().includes(queryLower);
      
      const matchesCountry = matchesCountryName(agent.country, selectedCountryFilter);
      const matchesCity = selectedCityFilter === 'all' || agent.city.toLowerCase() === selectedCityFilter.toLowerCase();
      const matchesOnline = !filterOnline || agent.status === 'Available' || agent.status === 'Busy';
      const matchesVerified = !filterVerified || agent.verified === true;
      
      return matchesSearch && matchesCountry && matchesCity && matchesOnline && matchesVerified;
    });
  }, [agentsList, searchQuery, selectedCountryFilter, selectedCityFilter, filterOnline, filterVerified]);

  // Sort filteredAgents by distance if userLocation is available & apply radius filter
  const processedAgents = useMemo(() => {
    let mapped = filteredAgents.map((agent, _idx) => {
      let distanceKm: number | null = null;
      let estTime: string | null = null;
      let travelType: string | null = null;
      
      const lat = agent.realLat !== undefined ? agent.realLat : agent.lat;
      const lng = agent.realLng !== undefined ? agent.realLng : agent.lng;

      if (userLocation && lat && lng) {
        distanceKm = calculateHaversineDistance(userLocation.lat, userLocation.lng, lat, lng);
        const { time, type } = getEstimatedTime(distanceKm);
        estTime = `${toBanglaDigits(time)} মিনিট`;
        travelType = type;
      }
      return {
        ...agent,
        distance: distanceKm,
        distanceKm,
        estTime,
        travelType
      };
    });

    if (selectedRadiusKm !== 'all' && userLocation) {
      mapped = mapped.filter(a => a.distanceKm !== null && a.distanceKm <= (selectedRadiusKm as number));
    } else if (filterNearby && userLocation) {
      mapped = mapped.filter(a => a.distanceKm !== null && a.distanceKm <= 50);
    }

    if (userLocation) {
      // Sort ascending by distance (nearest first)
      mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return mapped;
  }, [filteredAgents, userLocation, filterNearby, selectedRadiusKm]);

  // Handle toggling location sharing
  const handleToggleSharing = async () => {
    const nextState = !isSharingLocation;
    setIsSharingLocation(nextState);
    localStorage.setItem('amb_share_location', nextState ? 'true' : 'false');
    if (!nextState && user?.uid) {
      await stopSharingAgentLocation(user.uid);
    }
  };

  // Nearest agent summary ticker
  const nearestAgentsSummary = useMemo(() => {
    const withDist = processedAgents.filter(a => a.distance !== null);
    if (withDist.length === 0) return null;
    return `${withDist[0].name} — ${toBanglaDigits(withDist[0].distance!.toFixed(1))} KM`;
  }, [processedAgents]);

  const selectedAgent = useMemo(() => {
    return processedAgents.find(a => a.id === highlightedAgentId) || null;
  }, [processedAgents, highlightedAgentId]);

  return (
    <div className="bg-[#FAFDFB] min-h-screen text-slate-800 pb-28 relative max-w-lg mx-auto border-x border-slate-150">
      
      {/* ================= HEADER SECTION ================= */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 z-30 shadow-3xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UnifiedBackButton
            onClick={() => {
              if (reportingAgent) { setReportingAgent(null); return; }
              if (showFilterDropdown) { setShowFilterDropdown(false); return; }
              if (showApplyForm) { setShowApplyForm(false); return; }
              if (activeTab !== 'map') {
                setActiveTab('map');
                return;
              }
              onBack();
            }}
            variant="dark"
            title="পিছনে যান"
          />
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-tight">{t.title}</h1>
            <p className="text-[9px] font-extrabold text-[#0D9488] tracking-wide">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Dynamic Language Toggle */}
          <button 
            onClick={() => setLang(prev => prev === 'bn' ? 'en' : 'bn')}
            className="p-1.5 bg-sky-50 border border-sky-100 rounded-xl text-sky-700 hover:bg-sky-100 transition cursor-pointer flex items-center gap-1 text-[9.5px] font-black"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'EN' : 'বাং'}</span>
          </button>
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-0.5" />
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 leading-none">
            {t.onlineBadge}
          </span>
        </div>
      </header>



      {/* ================= MAIN CONTENT CANVAS ================= */}
      <main className="p-4 space-y-4">

        {/* TAB 1: LANDING & AGENT MAP */}
        {activeTab === 'map' && (
          <div className="space-y-4 animate-fade-in text-left">
            
            {/* World vs BD Map Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2.5xl border border-slate-200/50">
              <button 
                type="button"
                onClick={() => { setMapType('world'); setZoomLevel(1); }}
                className={`flex-1 py-2 rounded-2xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all duration-200 ${mapType === 'world' ? 'bg-[#0D9488] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
              >
                <Globe className="w-3.5 h-3.5" /> ওয়ার্ল্ড ম্যাপ
              </button>
              <button 
                type="button"
                onClick={() => { setMapType('bangladesh'); setZoomLevel(1); }}
                className={`flex-1 py-2 rounded-2xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all duration-200 ${mapType === 'bangladesh' ? 'bg-[#0D9488] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
              >
                <MapPin className="w-3.5 h-3.5" /> বাংলাদেশ ম্যাপ
              </button>
            </div>

            {/* High Precision GPS Location status & Privacy toggle bar */}
            <div className="bg-white border border-slate-150 p-3.5 rounded-2.5xl shadow-3xs space-y-2.5 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
                    <Compass className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-slate-900 leading-tight flex items-center gap-1.5">
                      <span>উচ্চ-নির্ভুল জিপিএস নেটওয়ার্ক</span>
                      <span className="text-[8px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full border border-emerald-200">
                        GPS Live
                      </span>
                    </h4>
                    {isLocating ? (
                      <p className="text-[9.5px] text-amber-600 font-extrabold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                        উচ্চ-নির্ভুল জিপিএস সিগন্যাল লোড হচ্ছে...
                      </p>
                    ) : userLocation ? (
                      <p className="text-[9.5px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                        <span>জিপিএস পাওয়া গেছে</span>
                        {userLocation.accuracy && (
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-150 font-mono">
                            ± {toBanglaDigits(userLocation.accuracy.toFixed(0))} মি.
                          </span>
                        )}
                      </p>
                    ) : locationError ? (
                      <p className="text-[9.5px] text-rose-600 font-extrabold truncate max-w-[190px] mt-0.5">
                        {locationError}
                      </p>
                    ) : (
                      <p className="text-[9.5px] text-slate-400 font-extrabold mt-0.5">
                        নিকটবর্তী এজেন্টদের নিখুঁত দূরত্ব দেখতে অবস্থান সনাক্ত করুন।
                      </p>
                    )}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={detectUserLocation}
                  disabled={isLocating}
                  className={`px-3 py-1.5 rounded-xl text-[9.5px] font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isLocating 
                      ? 'bg-slate-100 text-slate-400' 
                      : 'bg-[#0D9488] hover:bg-[#0B7A70] text-white shadow-xs'
                  }`}
                >
                  {isLocating ? 'খোঁজা হচ্ছে...' : 'জিপিএস রিফ্রেশ 📍'}
                </button>
              </div>

              {/* Privacy: Share My Location Toggle Switch */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-sans">
                <div className="flex items-center gap-1.5">
                  <Radio className={`w-3.5 h-3.5 ${isSharingLocation ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  <span className="text-[10px] font-black text-slate-700">আমার জিপিএস লোকেশন ম্যাপে শেয়ার করুন</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSharing}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isSharingLocation ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isSharingLocation ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* MAP STAGE CONTAINER */}
            <div className="relative overflow-hidden w-full aspect-[4/3] rounded-3xl bg-sky-950/95 border border-sky-900 shadow-md">
              {/* Map Zoom Controls Widget */}
              <div className="absolute bottom-3 right-3 z-22 flex flex-col gap-1.5">
                <button 
                  type="button"
                  onClick={zoomIn}
                  className="w-8 h-8 rounded-xl bg-white/95 border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center text-sm shadow-xs cursor-pointer select-none"
                >
                  +
                </button>
                <button 
                  type="button"
                  onClick={zoomOut}
                  className="w-8 h-8 rounded-xl bg-white/95 border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center text-sm shadow-xs cursor-pointer select-none"
                >
                  -
                </button>
              </div>

              <LeafletActiveMap 
                mapType={mapType}
                agents={agentsList}
                highlightedAgentId={highlightedAgentId}
                onSelectAgent={setHighlightedAgentId}
                zoomLevel={zoomLevel}
                userLocation={userLocation}
              />
            </div>

            {/* Selected Agent Detailed Overlay Panel */}
            <AnimatePresence>
              {selectedAgent && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                >
                  <AgentProfileCard 
                    agent={selectedAgent as any}
                    lang={lang}
                    onClose={() => setHighlightedAgentId(null)}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onOpenReport={(agent) => {
                      setReportingAgent(agent as any);
                    }}
                    t={t}
                    toBanglaDigits={toBanglaDigits}
                    userRole={user.role}
                    onDeleteAgent={handleDeleteAgent}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ================= NEAREST AGENT HIGHLIGHT CARD ================= */}
            {processedAgents.length > 0 && (
              <div className="bg-gradient-to-br from-teal-900 via-[#0B7A70] to-slate-900 border border-teal-500/30 rounded-3xl p-4 text-white shadow-md space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl">
                      <Navigation className="w-4 h-4 animate-pulse shrink-0" />
                    </span>
                    <div>
                      <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                        📍 আপনার কাছাকাছি সবচেয়ে নিকটস্থ এজেন্ট
                      </h3>
                      <p className="text-[9.5px] text-teal-200 font-bold">
                        {userLocation ? 'জিপিএস লোকেশন অনুযায়ী সনাক্তকৃত' : 'নিকটবর্তী এজেন্ট ইনফরমেশন'}
                      </p>
                    </div>
                  </div>
                  {processedAgents[0].distance !== null && (
                    <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs shrink-0">
                      📏 {toBanglaDigits(processedAgents[0].distance.toFixed(1))} কি.মি.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <img 
                    src={processedAgents[0].img} 
                    alt={processedAgents[0].name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-400/40 shrink-0 shadow-sm" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-white truncate">{processedAgents[0].name}</h4>
                      <span className="text-[8px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-black uppercase">ACTIVE</span>
                    </div>
                    <p className="text-[10px] text-slate-200 font-semibold truncate mt-0.5">
                      📍 {processedAgents[0].city}{processedAgents[0].district ? `, ${processedAgents[0].district}` : ''}
                    </p>
                    <p className="text-[10px] text-amber-300 font-bold mt-0.5 flex items-center gap-1">
                      <span>⏱️ যেতে আনুমানিক সময়:</span>
                      <span className="bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded font-black">
                        {processedAgents[0].estTime || '10 মিনিট'} ({processedAgents[0].travelType || 'ড্রাইভ'})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
                  <a 
                    href={`tel:${processedAgents[0].phone}`}
                    className="py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1 transition shadow-xs text-center cursor-pointer"
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>কল করুন</span>
                  </a>
                  <a 
                    href={`https://wa.me/${processedAgents[0].whatsapp ? processedAgents[0].whatsapp.replace(/[^0-9]/g, '') : processedAgents[0].phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('আসসালামু আলাইকুম, আমি AMB কো-অপারেটিভ অ্যাপ থেকে আপনার কাছে সার্ভিস নিতে যোগাযোগ করছি।')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 bg-[#25D366] hover:bg-[#20ba56] text-white rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1 transition shadow-xs text-center cursor-pointer"
                  >
                    <span>💬 WhatsApp</span>
                  </a>
                  <button 
                    type="button"
                    onClick={() => setHighlightedAgentId(processedAgents[0].id)}
                    className="py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1 transition shadow-xs text-center cursor-pointer"
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>ম্যাপে দেখুন</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= AGENT APPLICATION COLLAPSIBLE CONTAINER ================= */}
            <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-3xs transition-all duration-250">
              <button 
                onClick={() => setShowApplyForm(!showApplyForm)}
                className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-50 rounded-2xl text-[#0D9488]">
                    <Briefcase className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800">এজেন্ট হতে আগ্রহী..? (ভর্তির আবেদন)</h3>
                    <p className="text-[10px] text-[#0D9488] font-bold mt-0.5">
                      {showApplyForm ? 'ফর্মটি বন্ধ করতে এখানে ক্লিক করুন' : 'আবেদনপত্র পূরণ করতে এখানে ক্লিক করুন'}
                    </p>
                  </div>
                </div>
                <div className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  {showApplyForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showApplyForm && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                  <div className="bg-gradient-to-r from-[#0D9488] to-teal-800 rounded-2xl p-4 text-white space-y-1">
                    <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                      <Briefcase className="w-4.5 h-4.5 text-emerald-250 shrink-0" />
                      AMB কো-অপারেটিভ এজেন্ট আবেদনপত্র
                    </h3>
                    <p className="text-[10px] text-emerald-100 font-semibold leading-relaxed">
                      আপনার এলাকার ক্ষুদ্র ক্ষুদ্র সঞ্চয়কে গতিশীল করতে এবং রেমিট্যান্স কালেকশনে AMB এজেন্ট হিসেবে ক্যারিয়ার শুরু করুন। নিচের ফর্মটি সতর্কতার সাথে পূরণ করুন।
                    </p>
                  </div>

                  {/* Success and Error Indicators */}
                  {successMessage && (
                    <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl text-center space-y-1.5 animate-bounce">
                      <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                      <p className="text-xs text-emerald-850 font-extrabold leading-normal">{successMessage}</p>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-[11px] text-rose-700 font-bold leading-normal">
                      ⚠️ {errorMessage}
                    </div>
                  )}

                  <form onSubmit={handleApplySubmit} className="space-y-3.5">
                    <div className="space-y-3.5">
                      {/* 1. Name */}
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-750 uppercase tracking-wider mb-1">1. আবেদনকারীর পূর্ণ নাম</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="উদাঃ সাজ্জাদুল ইসলাম"
                          className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none font-medium text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* 2. Mobile Number */}
                        <div>
                          <label className="block text-[9.5px] font-black text-slate-755 uppercase tracking-wider mb-1">2. সচল মোবাইল নম্বর</label>
                          <input
                            type="tel"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="উদাঃ +88017XXXXXXXX"
                            className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none font-mono text-slate-800 font-bold"
                          />
                        </div>

                        {/* 3. WhatsApp Number */}
                        <div>
                          <label className="block text-[9.5px] font-black text-slate-755 uppercase tracking-wider mb-1">3. হোয়াটসঅ্যাপ নম্বর</label>
                          <input
                            type="tel"
                            value={whatsNumber}
                            onChange={(e) => setWhatsNumber(e.target.value)}
                            placeholder="উদাঃ +88017XXXXXXXX"
                            className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none font-mono text-slate-800 font-bold"
                          />
                        </div>
                      </div>

                      {/* GPS Autodetect Section */}
                      <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-700">📍 জিপিএস ম্যাপ থেকে অটো ঠিকানা নির্বাচন</span>
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                            অটো জিপিএস সুবিধা
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 font-medium leading-normal">
                          কোনো ভুল ঠিকানা এড়াতে জিপিএস ম্যাপ থেকে জেলা ও থানা অটোমেটিক সিলেক্ট হয়। নিচের বাটনে চাপ দিলে আপনার লাইভ থানা ও জেলা ইনস্ট্যান্ট বসে যাবে।
                        </p>
                        <button
                          type="button"
                          onClick={handleAutoFetchAddress}
                          disabled={isFetchingAddress}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3.5 bg-[#0D9488] hover:bg-[#0B7A70] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl font-bold text-xs transition cursor-pointer shadow-3xs hover:shadow-2xs active:scale-[0.98]"
                        >
                          {isFetchingAddress ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                              <span>ম্যাপ থেকে লোকেশন সনাক্ত হচ্ছে...</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-4 h-4 text-white shrink-0 animate-pulse" />
                              <span>📍 ম্যাপ থেকে অটো জেলা ও থানা আপডেট করুন</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Manual Shop Location / Google Maps Link Input */}
                      <div className="bg-[#F0FDFA] border border-teal-200 p-3.5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-teal-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                            <span>📍 দোকানের গুগল ম্যাপস লিংক বা জিপিএস কোঅর্ডিনেট (Google Maps Link)</span>
                          </label>
                          <span className="text-[8.5px] font-extrabold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full border border-teal-200">
                            অটো থিকানা ফিল
                          </span>
                        </div>
                        <p className="text-[9.5px] text-teal-800 font-medium leading-normal">
                          দোকানের গুগল ম্যাপ লিংক (Google Maps Share Link) বা কোঅর্ডিনেট (যেমন: 23.8103, 90.4125) পেস্ট করে 'যাচাই করুন' বাটনে চাপ দিন। আপনার জেলা ও থানা ওই লিংকের এরিয়া অনুযায়ী অটোমেটিক যুক্ত হয়ে যাবে!
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={shopMapLink}
                            onChange={async (e) => {
                              const val = e.target.value;
                              setShopMapLink(val);
                              if (val.trim().length > 5) {
                                await geocodeTextOrLink(val);
                              }
                            }}
                            placeholder="গুগল ম্যাপ লিংক বা কোঅর্ডিনেট টাইপ করুন (উদাঃ https://maps.app.goo.gl/... বা 23.8103, 90.4125)"
                            className="block w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs focus:ring-2 focus:ring-[#0D9488] focus:bg-white focus:outline-none font-medium text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!shopMapLink.trim()) {
                                console.warn('অনুগ্রহ করে সঠিক গুগল ম্যাপ লিংক অথবা জিপিএস কোঅর্ডিনেট পেস্ট করুন।');
                                return;
                              }
                              const result = await geocodeTextOrLink(shopMapLink);
                              if (result) {
                                console.log('ম্যাপ লিংক থেকে ঠিকানা চিহ্নিত হয়েছে');
                              } else {
                                console.log('দোকানের গুগল ম্যাপ লিংক নিবন্ধিত হয়েছে');
                              }
                            }}
                            className="px-3 py-2 bg-[#0D9488] hover:bg-[#0B7A70] text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition shadow-3xs"
                          >
                            যাচাই করুন
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* 4. District */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[9.5px] font-black text-slate-750 uppercase tracking-wider">4. নিজ জেলা / ডিভিশন</label>
                            <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              🔒 অটো জিপিএস / লিংক
                            </span>
                          </div>
                          <input
                            type="text"
                            required
                            readOnly
                            value={district}
                            placeholder="অটো জিপিএস বা লিংক দিলে অটো আসবে..."
                            className="block w-full px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-black rounded-xl text-xs cursor-not-allowed select-none transition-all"
                          />
                          <p className="text-[8.5px] text-teal-700 font-semibold mt-1">
                            📍 জিপিএস/ম্যাপ লিংক থেকে অটো প্রাপ্ত
                          </p>
                        </div>

                        {/* 5. Local Area / Thana */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[9.5px] font-black text-slate-755 uppercase tracking-wider">5. থানা / স্থানীয় এলাকা</label>
                            <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              🔒 অটো জিপিএস / লিংক
                            </span>
                          </div>
                          <input
                            type="text"
                            required
                            readOnly
                            value={areaName}
                            placeholder="অটো জিপিএস বা লিংক দিলে অটো আসবে..."
                            className="block w-full px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-black rounded-xl text-xs cursor-not-allowed select-none transition-all"
                          />
                          <p className="text-[8.5px] text-teal-700 font-semibold mt-1">
                            📍 জিপিএস/ম্যাপ লিংক থেকে অটো প্রাপ্ত
                          </p>
                        </div>
                      </div>

                      {/* 7. Experience */}
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-750 uppercase tracking-wider mb-1">7. পূর্ববর্তী কাজের অভিজ্ঞতা</label>
                        <select
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none text-slate-800 font-bold"
                        >
                          <option value="নেই">কোনো অভিজ্ঞতা নেই</option>
                          <option value="1 বছর">1 বছর বা তার কম</option>
                          <option value="3+ বছর">1 থেকে 3 বছর পর্যন্ত</option>
                          <option value="5+ বছর">5 বছরের বা তার বেশি অভিজ্ঞতা আছে</option>
                        </select>
                      </div>

                      {/* 8. Motivation */}
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-750 uppercase tracking-wider mb-1">8. কেন আপনি আমাদের এজেন্ট হতে চান?</label>
                        <textarea
                          rows={3}
                          value={motivation}
                          onChange={(e) => setMotivation(e.target.value)}
                          placeholder="সংক্ষেপে আপনার প্রেষণা বা উদ্দেশ্য বর্ণনা করুন..."
                          className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-[#0D9488] hover:bg-[#0B7A70] disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/15"
                    >
                      {isSubmitting ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>এজেন্ট আবেদন দাখিল করুন 🚀</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* ================= SEARCH & FILTERS ================= */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider font-sans">এজেন্ট তালিকা (বিশ্বজুড়ে)</h3>
                <span className="text-[10px] font-black text-[#0D9488] bg-sky-50 border border-slate-100 px-2 py-0.5 rounded-full font-bold">
                  {processedAgents.length} জন সক্রিয় ম্যাপ
                </span>
              </div>

              <div className="flex gap-2 relative">
                {/* Search Bar */}
                <div className="bg-white border border-slate-200 rounded-2.5xl px-3 py-1.5 flex items-center gap-2 flex-grow shadow-3xs">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="নাম, দেশ বা অবস্থান দিয়ে খুঁজুন..."
                    className="w-full text-xs font-sans text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Tab Button */}
                <button 
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`px-3 bg-white border rounded-2.5xl flex items-center gap-1.5 text-xs font-sans font-black shadow-3xs cursor-pointer ${showFilterDropdown ? 'border-[#0D9488] text-[#0D9488]' : 'border-slate-200 text-slate-600 hover:text-slate-800'}`}
                >
                  <Filter className="w-3.5 h-3.5" /> ফিল্টার
                </button>

                {/* Expanded Filter Panel Dropdown */}
                {showFilterDropdown && (
                  <div className="absolute top-11 right-0 w-44 bg-white border border-slate-200 rounded-2xl shadow-lg p-2.5 z-40 space-y-1.5">
                    <p className="text-[9px] font-black text-slate-400 tracking-wider uppercase border-b pb-1">দেশ নির্বাচন</p>
                    {[
                      { key: 'all', label: 'সব সক্রিয় দেশ' },
                      { key: 'Bangladesh', label: '🇧🇩 বাংলাদেশ' },
                      { key: 'United States', label: '🇺🇸 যুক্তরাজ্য / USA' },
                      { key: 'UAE', label: '🇦🇪 সংযুক্ত আরব আমিরাত' },
                      { key: 'United Kingdom', label: '🇬🇧 গ্রেট ব্রিটেন (UK)' },
                      { key: 'Singapore', label: '🇸🇬 সিঙ্গাপুর' },
                      { key: 'Malaysia', label: '🇲🇾 মালয়েশিয়া' }
                    ].map((opt, _idx) => (
                      <button 
                        key={`${opt.key}-${_idx}`}
                        onClick={() => {
                          setSelectedCountryFilter(opt.key);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-none flex items-center justify-between font-bold ${selectedCountryFilter === opt.key ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>{opt.label}</span>
                        {selectedCountryFilter === opt.key && <span className="text-emerald-600 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Country & Distance Pill Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-[10px] font-bold">
              <button 
                onClick={() => setSelectedCountryFilter('all')}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'all' ? 'bg-slate-800 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                সব দেশ ({agentsList.length})
              </button>
              <button 
                onClick={() => setSelectedCountryFilter('Bangladesh')}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Bangladesh' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇧🇩 বাংলাদেশ
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Saudi Arabia'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Saudi Arabia' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇸🇦 সৌদি আরব
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('UAE'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'UAE' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇦🇪 দুবাই / UAE
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Qatar'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Qatar' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇶🇦 কাতার
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Oman'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Oman' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇴🇲 ওমান
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Kuwait'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Kuwait' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇰🇼 কুয়েত
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Malaysia'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Malaysia' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇲🇾 মালয়েশিয়া
              </button>
              <button 
                onClick={() => { setSelectedCountryFilter('Singapore'); setMapType('world'); }}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${selectedCountryFilter === 'Singapore' ? 'bg-emerald-700 text-white shadow-3xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                🇸🇬 সিঙ্গাপুর
              </button>
            </div>

            {/* ================= ACTIVE AGENTS GRID ================= */}
            <div className="grid grid-cols-2 gap-3">
              {processedAgents.map((agent, idx) => (
                <div 
                  key={`${agent.id}-${idx}`}
                  className={`bg-white border rounded-2.5xl p-3 flex flex-col justify-between hover:shadow-md transition-all duration-200 shadow-3xs text-left group relative overflow-hidden ${highlightedAgentId === agent.id ? 'border-emerald-500 shadow-sm shadow-emerald-50' : 'border-slate-200'}`}
                >
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span className="text-[7.5px] font-extrabold text-green-700 bg-green-50 px-1 py-0.5 rounded uppercase leading-none">Active</span>
                  </div>

                  {/* Profile Layout with avatar */}
                  <div className="flex items-center gap-2 mt-1">
                    <img 
                      src={agent.img} 
                      alt={agent.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0 shadow-3xs" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-[11.5px] font-black text-slate-800 leading-tight truncate">{agent.name}</h4>
                      <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold truncate">
                        <span>{agent.flag}</span>
                        <span className="truncate">{agent.country}</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1.5 my-2.5 font-sans">
                    <div className="flex items-center gap-1 text-[8.5px] text-slate-600 font-bold leading-normal">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{agent.city}</span>
                    </div>
                    
                    {/* Detailed Permanent Address */}
                    {(agent.district || agent.thana || agent.postOffice) && (
                      <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 text-[8.5px] text-slate-600 font-semibold space-y-0.5 leading-tight text-left">
                        <p className="text-[7.5px] font-black text-teal-650 uppercase tracking-wider">🏠 ঠিকানা / লোকেশনঃ</p>
                        {agent.postOffice && <p>গ্রাম/পোস্টঃ {agent.postOffice}</p>}
                        {agent.thana && <p>থানা/উপজেলাঃ {agent.thana}</p>}
                        {agent.district && <p>জেলা/শহরঃ {agent.district}</p>}
                      </div>
                    )}

                    {/* GPS Coordinates & Google Maps Link */}
                    {(agent.realLat !== undefined || agent.lat !== undefined) && (agent.realLng !== undefined || agent.lng !== undefined) && (
                      <div className="bg-emerald-50/90 border border-emerald-200/80 p-2 rounded-xl text-[8.5px] font-mono font-extrabold text-emerald-950 flex flex-wrap items-center justify-between gap-1">
                        <span className="flex items-center gap-1 shrink-0">
                          <span>🛰️</span> {Number(agent.realLat !== undefined ? agent.realLat : agent.lat).toFixed(6)}, {Number(agent.realLng !== undefined ? agent.realLng : agent.lng).toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${agent.realLat !== undefined ? agent.realLat : agent.lat},${agent.realLng !== undefined ? agent.realLng : agent.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 hover:underline font-black text-[8px]"
                        >
                          (গুগল ম্যাপে দেখুন ↗)
                        </a>
                      </div>
                    )}

                    {/* Proximity Distance Badge or GPS request button */}
                    {agent.distance !== null ? (
                      <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2 text-[8.5px] text-emerald-850 font-bold space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 font-black text-emerald-800">
                            <span>{agent.travelType === 'হাঁটা পথ' ? '🚶' : '🚗'}</span>
                            <span>
                              দূরত্বঃ {agent.distance < 1 
                                ? `${toBanglaDigits(Math.round(agent.distance * 1000))} মিটার` 
                                : `${toBanglaDigits(agent.distance.toFixed(1))} কি.মি.`}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-teal-800 font-extrabold border-t border-emerald-100 pt-0.5 mt-0.5">
                          <span>⏱️ যেতে সময়ঃ</span>
                          <span className="bg-emerald-100 px-1.5 py-0.5 rounded font-black text-emerald-900">
                            {agent.estTime} ({agent.travelType || 'ড্রাইভ'})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={detectUserLocation}
                        className="w-full py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-[8.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <span>📍 জিপিএস দিয়ে দূরত্ব ও সময় দেখুন</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 text-[8.5px] text-slate-600 font-mono font-extrabold leading-normal">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{agent.phone}</span>
                    </div>
                  </div>

                  {/* Comprehensive Action Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-2 gap-1">
                      {/* WhatsApp Button */}
                      <a 
                        href={`https://wa.me/${agent.whatsapp ? agent.whatsapp.replace(/[^0-9]/g, '') : agent.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('আসসালামু আলাইকুম, আমি AMB কো-অপারেটিভ অ্যাপ থেকে যোগাযোগ করছি।')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 bg-[#25D366] hover:bg-[#20ba56] text-white text-[8.5px] font-black rounded-xl flex items-center justify-center gap-1 transition text-center shadow-3xs cursor-pointer"
                      >
                        <span>💬 WhatsApp</span>
                      </a>

                      {/* Google Maps Direction Link */}
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${agent.realLat !== undefined ? agent.realLat : agent.lat},${agent.realLng !== undefined ? agent.realLng : agent.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[8.5px] font-black rounded-xl flex items-center justify-center gap-1 transition text-center shadow-3xs cursor-pointer"
                      >
                        <Navigation className="w-2.5 h-2.5 shrink-0" />
                        <span>গুগল ম্যাপ</span>
                      </a>
                    </div>

                    {/* Interactive Map Pin Button */}
                    <button 
                      onClick={() => {
                        setHighlightedAgentId(agent.id);
                        if (agent.country === 'Bangladesh') {
                          setMapType('bangladesh');
                        } else {
                          setMapType('world');
                        }
                        setZoomLevel(1.5);
                      }}
                      className={`w-full py-1.5 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[9px] font-black rounded-xl transition duration-150 flex items-center justify-center gap-1 cursor-pointer text-center shadow-3xs ${highlightedAgentId === agent.id ? 'bg-emerald-600 ring-2 ring-emerald-300' : ''}`}
                    >
                      <Globe className="w-3 h-3 shrink-0" /> পিন হাইলাইট করুন
                    </button>
                  </div>
                </div>
              ))}
              
              {processedAgents.length === 0 && (
                <div className="col-span-2 bg-slate-50 border border-slate-150 rounded-2.5xl p-6 text-center text-slate-400 text-xs font-bold font-sans">
                  কোনো এজেন্ট খুঁজে পাওয়া যায়নি। অনুসন্ধান শব্দ পরিবর্তন করুন।
                </div>
              )}
            </div>

            {/* ================= 4 INFO METRICS ROW ================= */}
            <div className="grid grid-cols-4 gap-2 my-2">
              <div className="bg-[#FAFCFF] border border-sky-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">{toBanglaDigits(agentsList.length)} জন</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">মোট এজেন্ট</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সারা বিশ্বে</p>
              </div>

              <div className="bg-[#FAFDFB] border border-emerald-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Globe className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-sky-850 leading-none">{toBanglaDigits(new Set(agentsList.map((a, _idx) => a.country?.trim().toLowerCase()).filter(Boolean)).size || 1)} টি</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সক্রিয় দেশ</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">বিশ্বজুড়ে</p>
              </div>

              <div className="bg-[#FFFBF5] border border-amber-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">{toBanglaDigits(new Set(agentsList.map((a, _idx) => a.city?.trim().toLowerCase()).filter(Boolean)).size || 1)} টি</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">শহর কভারেজ</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সেবা সর্বত্র</p>
              </div>

              <div className="bg-[#FFF9FB] border border-rose-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">100%</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">ভেরিফাইড</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">নিরাপদ লেনদেন</p>
              </div>
            </div>



          </div>
        )}



        {/* TAB 3: USER SUBMITTED APPLICATIONS */}
        {activeTab === 'my-applications' && (
          <div className="space-y-4 animate-fade-in text-left">
            <div className="bg-white border border-slate-150 rounded-2.5xl p-4 shadow-3xs">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5 border-b pb-2">
                <FileText className="w-4.5 h-4.5 text-[#0D9488] shrink-0" />
                আমার এজেন্ট আবেদন খতিয়ান
              </h2>

              {loadingApps ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <span className="w-7 h-7 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-450 font-bold">আবেদনপত্র লোড হচ্ছে...</span>
                </div>
              ) : userApplications.length > 0 ? (
                <div className="space-y-3.5 mt-2.5">
                  {userApplications.map((app, idx) => {
                    const isPending = app.status === 'pending';
                    const isApproved = app.status === 'approved';
                    const isRejected = app.status === 'rejected';

                    return (
                      <div key={`${app.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 font-sans">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] font-black text-slate-400 block tracking-wide">রেফারেন্স আইডি</span>
                            <span className="text-[10px] font-mono text-slate-800 font-extrabold block">#{app.id.substring(0, 8).toUpperCase()}</span>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`text-[8.5px] font-black px-2.5 py-0.5 rounded-full uppercase leading-none border ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : isApproved ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isPending ? '⏳ অ্যাডমিন রিভিউ চলছে' : isApproved ? '✓ অনুমোদিত' : '❌ বাতিল হয়েছে'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 border-t border-dashed border-slate-200 pt-2 font-medium">
                          <p>👤 নামঃ <span className="text-slate-800 font-bold">{app.userName}</span></p>
                          <p>📱 ফোনঃ <span className="font-mono text-slate-800 font-bold">{app.phone}</span></p>
                          <p>📍 এলাকাঃ <span className="text-slate-800 font-bold">{app.area}, {app.district}</span></p>
                          <p>💼 অভিজ্ঞতাঃ <span className="text-slate-800 font-bold">{app.experience}</span></p>
                        </div>

                        {app.appliedAtStr && (
                          <p className="text-[8.5px] text-slate-400 mt-1 block">দাখিলের সময়ঃ {app.appliedAtStr}</p>
                        )}
                        
                        {/* Process tracker */}
                        <div className="bg-white border rounded-xl p-2.5 space-y-1.5 text-[9px]">
                          <p className="text-slate-500 font-bold leading-none mb-1">অগ্রগতি ট্র্যাকারঃ</p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0">✓</span>
                            <span className="text-slate-700 font-bold">আবেদনপত্র সার্ভারে গৃহীত হয়েছে</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0 ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-[#E6F4EA] text-emerald-700'}`}>
                              {isPending ? '⏳' : '✓'}
                            </span>
                            <span className={isPending ? 'text-slate-600 font-bold' : 'text-slate-700 font-bold'}>
                              {isPending ? 'অ্যাডমিন ভেরিফিকেশন চলমান রয়েছে' : 'অফিসিয়াল তথ্য রিভিউ সম্পন্ন হয়েছে'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0">3</span>
                            <span className="text-slate-400 font-bold">ব্যবসায়িক প্রশিক্ষণ অ্যাক্সেস</span>
                          </div>
                        </div>

                        {/* Admin Action Bar */}
                        {(user.role === 'admin' || user.role === 'sub_admin') && isPending && (
                          <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl space-y-1.5">
                            <p className="text-[8.5px] font-black text-amber-900 uppercase">🛡️ প্রশাসনিক আবেদন নিয়ন্ত্রণ প্যানেল</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleApproveApplication(app)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 px-2.5 rounded-lg text-[9px] cursor-pointer text-center"
                              >
                                অনুমোদন করুন ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectApplication(app)}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-1.5 px-2.5 rounded-lg text-[9px] cursor-pointer text-center"
                              >
                                বাতিল করুন ✕
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2.5 font-sans">
                  <p className="text-xs text-slate-500 font-bold">আপনি এখনো কোনো নতুন এজেন্ট আবেদন সাবমিট করেননি।</p>
                  <button 
                    onClick={() => setActiveTab('apply')}
                    className="py-1.5 px-4 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[10px] font-black rounded-lg transition"
                  >
                    আবেদন ফর্ম পূরণ করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MOCK AGENT PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fade-in text-left">
            <div className="bg-white border border-slate-150 rounded-2.5xl p-5 shadow-3xs space-y-4">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                <Globe className="w-4.5 h-4.5 text-[#0D9488]" />
                AMB কো-অপারেটিভ আন্তর্জাতিক এজেন্ট কার্ড
              </h2>

              {/* Digital Agent Identity Card */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-4.5 border border-white/10 relative overflow-hidden shadow-lg aspect-[1.58/1] flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0D9488]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-black text-slate-100 font-sans tracking-tight mb-0.5">AMB Business Co-operative Ltd.</h3>
                    <p className="text-[7.5px] text-[#22C55E] uppercase font-black tracking-widest font-mono">OFFICIAL GLOBAL AGENT</p>
                  </div>
                  {/* Flag / status symbol */}
                  <span className="text-2xl">🇧🇩</span>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                    <img 
                      src={resolveAgentAvatar(user, user.name || 'সম্মানিত সদস্য')} 
                      className="w-full h-full object-cover shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-black text-white leading-tight font-sans">{user.name || 'সম্মানিত সদস্য'}</h4>
                    <p className="text-[8px] text-slate-350 leading-tight block truncate mt-0.5">District Agent (Candidate)</p>
                    <p className="text-[8px] text-yellow-350 font-mono mt-0.5">ID: AMB-AGT-TEMP-{user.uid?.substring(0, 5).toUpperCase()}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-white/10 pt-2.5 text-[7px] text-slate-400 font-bold uppercase tracking-widest">
                  <span>VALIDITY: LIFETIME CO-OP</span>
                  <span className="text-emerald-450 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    PENDING APPROVAL
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl text-[10px] text-slate-600 leading-relaxed font-semibold">
                <p className="font-black text-slate-800 text-[11px] mb-1">ℹ️ অনুমোদন প্রক্রিয়াঃ</p>
                আপনার আবেদনপত্রটি দাখিল হওয়ার পর, AMB কেন্দ্রীয় গভর্নিং বোর্ড প্রতিটি এলাকার কোটা অনুযায়ী তথ্য রিভিও করে থাকে। অনুমোদন সম্পন্ন হলেই আপনার আইডি কার্ডটি সচল হবে এবং আপনি আপনার এলাকায় কালেকশন পয়েন্ট ও কিস্তি গ্রহণ সেবা শুরু করতে পারবেন।
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ================= STICKY BOTTOM TABS FOOTER (Matches screenshot exactly) ================= */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-150 py-1.5 z-40 max-w-lg mx-auto shadow-md">
        <div className="grid grid-cols-4 gap-1 text-center">
          {/* Tab 1: হোম */}
          <button 
            type="button"
            onClick={onBack}
            className="flex flex-col items-center justify-center text-slate-450 hover:text-slate-800 cursor-pointer text-center"
          >
            <span className="text-lg">🏡</span>
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">হোম</span>
          </button>

          {/* Tab 2: এজেন্ট ম্যাপ (HIGHLIGHTED Tab) */}
          <button 
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'map' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <MapPin className={`w-4.5 h-4.5 ${activeTab === 'map' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">এজেন্ট ম্যাপ</span>
          </button>

          {/* Tab 3: আমার আবেদন */}
          <button 
            type="button"
            onClick={() => setActiveTab('my-applications')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'my-applications' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <FileText className={`w-4.5 h-4.5 ${activeTab === 'my-applications' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">আমার আবেদন</span>
          </button>

          {/* Tab 4: প্রোফাইল */}
          <button 
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'profile' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <User className={`w-4.5 h-4.5 ${activeTab === 'profile' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">প্রোফাইল</span>
          </button>
        </div>
      </footer>

    </div>
  );
}
