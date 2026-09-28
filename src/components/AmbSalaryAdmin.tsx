import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  Trash2, 
  Edit, 
  User, 
  Search, 
  Plus, 
  X, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  UserPlus, 
  UserMinus, 
  ArrowLeft, 
  Bell, 
  Briefcase,
  Building,
  DollarSign,
  Clock,
  CheckCircle2, 
  Sliders,
  Sparkles,
  SearchCode
} from 'lucide-react';

interface AmbSalaryAdminProps {
  onBack: () => void;
}

interface Employee {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  designation: string;
  basicSalary: number;
  overtimeHours: number;
  otherAllowance: number;
  phone: string;
  status: 'Paid' | 'Pending';
  lastPaymentDate?: string;
  lastPaymentTime?: string;
  createdAt?: string;
}

interface SalaryConfig {
  id: string; // userId
  companyName: string;
  companyId: string;
  overtimeRate: number;
  payDate: string;
  payTime: string;
  createdAt?: string;
}

interface SalaryPayment {
  id: string;
  userId: string;
  companyName: string;
  totalEmployees: number;
  amountPaid: number;
  payDate: string;
  payTime: string;
  createdAt?: string;
}

interface PlatformUser {
  uid: string;
  name: string;
  phone: string;
  memberId?: string;
  balance?: number;
}

export default function AmbSalaryAdmin({ onBack }: AmbSalaryAdminProps) {
  // Master lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [configs, setConfigs] = useState<SalaryConfig[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & tab controls
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'configs' | 'payments'>('employees');
  const [search, setSearch] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConfigUser, setSelectedConfigUser] = useState<string>('');
  const [editingConfig, setEditingConfig] = useState<SalaryConfig | null>(null);

  // Form states for Employees
  const [empUserId, setEmpUserId] = useState('');
  const [empEmployeeId, setEmpEmployeeId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empBasicSalary, setEmpBasicSalary] = useState('');
  const [empOvertimeHours, setEmpOvertimeHours] = useState('0');
  const [empOtherAllowance, setEmpOtherAllowance] = useState('0');
  const [empPhone, setEmpPhone] = useState('');
  const [empStatus, setEmpStatus] = useState<'Paid' | 'Pending'>('Pending');

  // Form states for Config
  const [cfgCompanyName, setCfgCompanyName] = useState('');
  const [cfgCompanyId, setCfgCompanyId] = useState('');
  const [cfgOvertimeRate, setCfgOvertimeRate] = useState('150');
  const [cfgPayDate, setCfgPayDate] = useState('');
  const [cfgPayTime, setCfgPayTime] = useState('');

  // Fetch all databases real-time
  useEffect(() => {
    setLoading(true);

    // 1. Listen to all employees
    const empUnsub = onSnapshot(query(collection(db, 'salary_employees')), (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || '',
          employeeId: data.employeeId || '',
          name: data.name || '',
          designation: data.designation || '',
          basicSalary: Number(data.basicSalary) || 0,
          overtimeHours: Number(data.overtimeHours) || 0,
          otherAllowance: Number(data.otherAllowance) || 0,
          phone: data.phone || '',
          status: data.status || 'Pending',
          lastPaymentDate: data.lastPaymentDate || '',
          lastPaymentTime: data.lastPaymentTime || '',
          createdAt: data.createdAt || ''
        });
      });
      // Sort alphabetically or by design
      list.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching salary employees:", error);
    });

    // 2. Listen to all configs
    const configUnsub = onSnapshot(query(collection(db, 'salary_configs')), (snapshot) => {
      const list: SalaryConfig[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id, // userId
          companyName: data.companyName || '',
          companyId: data.companyId || '',
          overtimeRate: Number(data.overtimeRate) || 0,
          payDate: data.payDate || '',
          payTime: data.payTime || '',
          createdAt: data.createdAt || ''
        });
      });
      setConfigs(list);
    });

    // 3. Listen to all salary payments/ledger logs
    const paymentsUnsub = onSnapshot(query(collection(db, 'salary_payments')), (snapshot) => {
      const list: SalaryPayment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || '',
          companyName: data.companyName || 'অজানা কোম্পানি',
          totalEmployees: Number(data.totalEmployees) || 0,
          amountPaid: Number(data.amountPaid) || 0,
          payDate: data.payDate || '',
          payTime: data.payTime || '',
          createdAt: data.createdAt || ''
        });
      });
      // Sort descending
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setPayments(list);
    });

    // 4. Listen to users
    const usersUnsub = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const list: PlatformUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          uid: docSnap.id,
          name: data.name || 'নাম নেই',
          phone: data.phone || 'মোবাইল নম্বর নেই',
          memberId: data.memberId || '',
          balance: data.balance || 0
        });
      });
      setUsers(list);
    });

    return () => {
      empUnsub();
      configUnsub();
      paymentsUnsub();
      usersUnsub();
    };
  }, []);

  // Clear / Reset handlers to remove all demo data from Firestore
  const handleClearAllEmployees = async () => {
    if (!window.confirm("আপনি কি নিশ্চিত যে সকল কর্মী ডাটাবেজ থেকে মুছে দিয়ে সবকিছু শূন্য (0) করতে চান?")) return;
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'salary_employees'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'salary_employees', d.id)));
      await Promise.all(deletePromises);
      alert("সফলভাবে সকল ডেমো কর্মচারী ডাটাবেজ থেকে রিমুভ করা হয়েছে! ডাটাবেজ এখন শূন্য (0)।");
    } catch (err: any) {
      console.error("Error clearing employees:", err);
      alert("ডাটা মুছে ফেলতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllConfigs = async () => {
    if (!window.confirm("আপনি কি সকল কোম্পানি প্রোফাইল মুছে সবকিছু শূন্য করতে চান?")) return;
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'salary_configs'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'salary_configs', d.id)));
      await Promise.all(deletePromises);
      alert("সকল কোম্পানি প্রোফাইল মুছে শূন্য করা হয়েছে।");
    } catch (err: any) {
      alert("সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllPayments = async () => {
    if (!window.confirm("আপনি কি সকল পেমেন্ট ইতিহাস রেকর্ড মুছে শূন্য করতে চান?")) return;
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'salary_payments'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'salary_payments', d.id)));
      await Promise.all(deletePromises);
      alert("সকল পেমেন্ট লেজার মুছে শূন্য করা হয়েছে।");
    } catch (err: any) {
      alert("সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatMoney = (amount: number) => {
    return Number(amount || 0).toLocaleString('en-IN');
  };

  // Helper to find username/phone
  const getUserMeta = (userId: string) => {
    const found = users.find(u => u.uid === userId);
    const companyFound = configs.find(c => c.id === userId);
    return {
      name: found ? found.name : 'অজানা সদস্য',
      phone: found ? found.phone : '',
      companyName: companyFound ? companyFound.companyName : 'সেট করা নেই',
      memberId: found?.memberId || ''
    };
  };

  // Filter Employees
  const getFilteredEmployees = () => {
    return employees.filter(emp => {
      // 1. Company/User Filter
      if (selectedUserFilter !== 'all' && emp.userId !== selectedUserFilter) return false;

      // 2. Status Filter
      if (selectedStatusFilter !== 'all' && emp.status !== selectedStatusFilter) return false;

      // 3. Text Search
      const userMeta = getUserMeta(emp.userId);
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchLower) ||
        emp.designation.toLowerCase().includes(searchLower) ||
        emp.employeeId.toLowerCase().includes(searchLower) ||
        emp.phone.includes(searchLower) ||
        userMeta.name.toLowerCase().includes(searchLower) ||
        userMeta.companyName.toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  };

  const filteredEmployees = getFilteredEmployees();

  // Stats calculations
  const totalEmployeesCount = employees.length;
  const paidEmployeesCount = employees.filter(e => e.status === 'Paid').length;
  const pendingEmployeesCount = employees.filter(e => e.status === 'Pending').length;
  const totalPayrollAmount = employees.reduce((acc, e) => {
    const overtimeAmount = e.overtimeHours * (configs.find(c => c.id === e.userId)?.overtimeRate || 150);
    return acc + e.basicSalary + overtimeAmount + e.otherAllowance;
  }, 0);
  const totalPaidAmount = payments.reduce((acc, p) => acc + p.amountPaid, 0);

  // Send automatic notification inside member app
  const sendInboxNotification = async (targetUserId: string, title: string, body: string) => {
    try {
      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: targetUserId,
        title: title,
        body: body,
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to push inbox notification:", err);
    }
  };

  // Add/Edit Employee logic
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empUserId) {
      alert("অনুগ্রহ করে প্রতিষ্ঠান/নিয়োগকর্তা নির্বাচন করুন!");
      return;
    }
    if (!empName || !empDesignation || !empBasicSalary || !empEmployeeId) {
      alert("অনুগ্রহ করে সব তারকা চিহ্নিত (*) তথ্য প্রদান করুন!");
      return;
    }

    try {
      const docData = {
        userId: empUserId,
        employeeId: empEmployeeId,
        name: empName,
        designation: empDesignation,
        basicSalary: Number(empBasicSalary),
        overtimeHours: Number(empOvertimeHours) || 0,
        otherAllowance: Number(empOtherAllowance) || 0,
        phone: empPhone,
        status: empStatus,
        createdAt: new Date().toISOString()
      };

      if (editingEmployee) {
        // Edit Mode
        const docRef = doc(db, 'salary_employees', editingEmployee.id);
        await updateDoc(docRef, docData);

        // Notify employer
        await sendInboxNotification(
          empUserId,
          `👥 কর্মচারী তথ্য সংশোধিত`,
          `অ্যাডমিন প্যানেল থেকে আপনার প্রতিষ্ঠানের কর্মচারী "${empName}" এর তথ্য সংশোধন করা হয়েছে। বেসিক বেতন: ৳${formatMoney(Number(empBasicSalary))}।`
        );
        alert("কর্মচারী তথ্য সফলভাবে সংশোধন করা হয়েছে!");
      } else {
        // Add Mode
        await addDoc(collection(db, 'salary_employees'), docData);

        // Notify employer
        await sendInboxNotification(
          empUserId,
          `👥 নতুন কর্মচারী যুক্ত করা হয়েছে`,
          `অ্যাডমিন প্যানেল আপনার প্রতিষ্ঠানে একজন নতুন কর্মচারী "${empName}" যুক্ত করেছেন। পদবি: ${empDesignation}, বেসিক: ৳${formatMoney(Number(empBasicSalary))}।`
        );
        alert("কর্মচারী সফলভাবে ডাটাবেজে যুক্ত করা হয়েছে!");
      }

      // Reset
      setShowAddEmployeeModal(false);
      setEditingEmployee(null);
      resetEmployeeForm();
    } catch (err: any) {
      alert("সমস্যা হয়েছে: " + err.message);
    }
  };

  const resetEmployeeForm = () => {
    setEmpUserId('');
    setEmpEmployeeId('');
    setEmpName('');
    setEmpDesignation('');
    setEmpBasicSalary('');
    setEmpOvertimeHours('0');
    setEmpOtherAllowance('0');
    setEmpPhone('');
    setEmpStatus('Pending');
  };

  const startEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpUserId(emp.userId);
    setEmpEmployeeId(emp.employeeId);
    setEmpName(emp.name);
    setEmpDesignation(emp.designation);
    setEmpBasicSalary(emp.basicSalary.toString());
    setEmpOvertimeHours(emp.overtimeHours.toString());
    setEmpOtherAllowance(emp.otherAllowance.toString());
    setEmpPhone(emp.phone);
    setEmpStatus(emp.status);
    setShowAddEmployeeModal(true);
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${emp.name}" কর্মচারীর অ্যাকাউন্ট সম্পূর্ণ মুছে ফেলতে চান?`)) {
      try {
        await deleteDoc(doc(db, 'salary_employees', emp.id));
        await sendInboxNotification(
          emp.userId,
          `🗑️ কর্মচারী মুছে ফেলা হয়েছে`,
          `অ্যাডমিন আপনার প্রতিষ্ঠান থেকে কর্মচারী "${emp.name}" কে রিমুভ করেছেন।`
        );
        alert("কর্মচারী সফলভাবে ডিলিট করা হয়েছে!");
      } catch (err: any) {
        alert("সমস্যা হয়েছে: " + err.message);
      }
    }
  };

  // Toggle paid status manually
  const toggleEmployeePayStatus = async (emp: Employee) => {
    const newStatus: 'Paid' | 'Pending' = emp.status === 'Paid' ? 'Pending' : 'Paid';
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    try {
      const docRef = doc(db, 'salary_employees', emp.id);
      await updateDoc(docRef, {
        status: newStatus,
        lastPaymentDate: newStatus === 'Paid' ? now.toISOString().split('T')[0] : '',
        lastPaymentTime: newStatus === 'Paid' ? timeStr : ''
      });

      // Send update notification to employer
      await sendInboxNotification(
        emp.userId,
        `🔔 কর্মচারীর বেতন স্টেটাস পরিবর্তিত`,
        `অ্যাডমিন প্যানেল থেকে আপনার কর্মচারী "${emp.name}" এর বেতন স্টেটাস পরিবর্তিত করা হয়েছে (${newStatus === 'Paid' ? 'পরিশোধিত' : 'বকেয়া'})।`
      );
    } catch (err: any) {
      alert("স্টেটাস পরিবর্তন ব্যর্থ: " + err.message);
    }
  };

  // Add/Edit Company configuration
  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userIdToUse = editingConfig ? editingConfig.id : selectedConfigUser;
    if (!userIdToUse) {
      alert("অনুগ্রহ করে সদস্য নির্বাচন করুন!");
      return;
    }
    if (!cfgCompanyName || !cfgCompanyId) {
      alert("অনুগ্রহ করে সব তথ্য সঠিকভাবে পূরণ করুন!");
      return;
    }

    try {
      const configRef = doc(db, 'salary_configs', userIdToUse);
      const data = {
        companyName: cfgCompanyName,
        companyId: cfgCompanyId,
        overtimeRate: Number(cfgOvertimeRate) || 150,
        payDate: cfgPayDate || new Date().toISOString().split('T')[0],
        payTime: cfgPayTime || '10:00',
        createdAt: new Date().toISOString()
      };

      await setDoc(configRef, data, { merge: true });

      await sendInboxNotification(
        userIdToUse,
        `🏢 অটো স্যালারি পে কনফিগারেশন আপডেট`,
        `অ্যাডমিন আপনার প্রতিষ্ঠান "${cfgCompanyName}" এর প্রোফাইল ও স্যালারি সেটিংস পরিবর্তন করেছেন। ওভারটাইম রেট: ৳${cfgOvertimeRate}/ঘণ্টা।`
      );

      alert("কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!");
      setShowConfigModal(false);
      setEditingConfig(null);
      setSelectedConfigUser('');
      setCfgCompanyName('');
      setCfgCompanyId('');
      setCfgOvertimeRate('150');
      setCfgPayDate('');
      setCfgPayTime('');
    } catch (err: any) {
      alert("সমস্যা হয়েছে: " + err.message);
    }
  };

  const startEditConfig = (cfg: SalaryConfig) => {
    setEditingConfig(cfg);
    setCfgCompanyName(cfg.companyName);
    setCfgCompanyId(cfg.companyId);
    setCfgOvertimeRate(cfg.overtimeRate.toString());
    setCfgPayDate(cfg.payDate);
    setCfgPayTime(cfg.payTime);
    setShowConfigModal(true);
  };

  const handleDeleteConfig = async (cfg: SalaryConfig) => {
    if (window.confirm(`আপনি কি "${cfg.companyName}" এর প্রতিষ্ঠান প্রোফাইল ডিলিট করতে চান? (সতর্কতা: এতে তার কর্মীদের তথ্য ডিলিট হবে না)`)) {
      try {
        await deleteDoc(doc(db, 'salary_configs', cfg.id));
        alert("কোম্পানি প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে!");
      } catch (err: any) {
        alert("ডিলিট ব্যর্থ: " + err.message);
      }
    }
  };

  // Delete Payment Record Log
  const handleDeletePaymentLog = async (pay: SalaryPayment) => {
    if (window.confirm("আপনি কি এই পেমেন্ট রেকর্ডটি ডাটাবেজ থেকে মুছে ফেলতে চান? (সতর্কতা: এটি শুধুমাত্র লেজার থেকে রেকর্ড মুছবে, সদস্যের ব্যালেন্স ফেরত দেবে না)")) {
      try {
        await deleteDoc(doc(db, 'salary_payments', pay.id));
        alert("রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে!");
      } catch (err: any) {
        alert("মুছে ফেলতে সমস্যা হয়েছে: " + err.message);
      }
    }
  };

  return (
    <div className="bg-[#f3f4f6] min-h-screen font-sans pb-16 text-slate-800">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-teal-850 to-emerald-900 text-white shadow-md border-b border-teal-950">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-full transition active:scale-95"
              title="অ্যাডমিন ড্যাশবোর্ডে ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                AMB অটো স্যালারি পে অ্যাডমিন প্যানেল
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-200 font-bold">সকল প্রতিষ্ঠানের কর্মী ডাটাবেজ, বেতন প্রদান ও প্রোফাইল কনফিগারেশন গেটওয়ে</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeSubTab === 'employees' && (
              <>
                <button
                  onClick={handleClearAllEmployees}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[11px] font-black rounded-xl transition shadow-xs border border-rose-500"
                  title="সকল ডেমো কর্মী রেকর্ড ক্লিয়ার করে শূন্য (0) করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  সব ডাটা মুছে রিসেট (0)
                </button>
                <button
                  onClick={() => {
                    resetEmployeeForm();
                    setEditingEmployee(null);
                    setShowAddEmployeeModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-black rounded-xl transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  নতুন কর্মচারী
                </button>
              </>
            )}
            {activeSubTab === 'configs' && (
              <>
                <button
                  onClick={handleClearAllConfigs}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[11px] font-black rounded-xl transition shadow-xs border border-rose-500"
                  title="সকল কোম্পানি প্রোফাইল মুছে শূন্য (0) করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  সব কোম্পানি ক্লিয়ার (0)
                </button>
                <button
                  onClick={() => {
                    setEditingConfig(null);
                    setSelectedConfigUser('');
                    setCfgCompanyName('');
                    setCfgCompanyId('');
                    setCfgOvertimeRate('150');
                    setCfgPayDate(new Date().toISOString().split('T')[0]);
                    setCfgPayTime('10:00');
                    setShowConfigModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[11px] font-black rounded-xl transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  কোম্পানি যুক্ত করুন
                </button>
              </>
            )}
            {activeSubTab === 'payments' && (
              <button
                onClick={handleClearAllPayments}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[11px] font-black rounded-xl transition shadow-xs border border-rose-500"
                title="সকল পেমেন্ট লেজার ইতিহাস ক্লিয়ার করে শূন্য (0) করুন"
              >
                <Trash2 className="w-3.5 h-3.5" />
                সব পেমেন্ট ইতিহাস ক্লিয়ার (0)
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 space-y-6">

        {/* METRICS BENTO GRID */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
          
          <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-24 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <Building className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">নিবন্ধিত প্রতিষ্ঠান</span>
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 block">
                {configs.length} টি কোম্পানি
              </span>
            </div>
            <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block w-max">
              প্লাটফর্ম স্যালারি খাতা সচল
            </span>
          </div>

          <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-24 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-teal-50 rounded-full flex items-center justify-center text-[#00a884]">
              <User className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">মোট প্লাটফর্ম কর্মী</span>
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 block">
                {totalEmployeesCount} জন
              </span>
            </div>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-max">
              {paidEmployeesCount} পরিশোধিত | {pendingEmployeesCount} বকেয়া
            </span>
          </div>

          <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-24 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">চলতি মাসের পে-রোল (মোট)</span>
            <div>
              <span className="text-base sm:text-lg font-black text-amber-700 block truncate">
                ৳{formatMoney(totalPayrollAmount)}
              </span>
            </div>
            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block w-max">
              বেসিক, ওভারটাইম ও ভাতা সহ
            </span>
          </div>

          <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-24 relative overflow-hidden col-span-2 md:col-span-1">
            <div className="absolute top-2 right-2 w-7 h-7 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">মোট পরিশোধিত বেতন</span>
            <div>
              <span className="text-base sm:text-lg font-black text-rose-600 block truncate">
                ৳{formatMoney(totalPaidAmount)}
              </span>
            </div>
            <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md inline-block w-max">
              {payments.length} টি সফল ডিল
            </span>
          </div>
        </div>

        {/* CONTROLS SUB-TABS SELECTOR */}
        <div className="bg-white border border-slate-200 rounded-3xl p-2.5 shadow-3xs flex gap-1 bg-slate-100">
          <button
            onClick={() => setActiveSubTab('employees')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              activeSubTab === 'employees' 
                ? 'bg-[#00a884] text-white shadow-sm scale-[1.02]' 
                : 'bg-transparent text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <User className="w-4 h-4" />
            স্টাফ ও কর্মচারী ডাটাবেজ ({employees.length} জন)
          </button>
          <button
            onClick={() => setActiveSubTab('configs')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              activeSubTab === 'configs' 
                ? 'bg-[#00a884] text-white shadow-sm scale-[1.02]' 
                : 'bg-transparent text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <Building className="w-4 h-4" />
            কোম্পানি সেটিংস ({configs.length} টি)
          </button>
          <button
            onClick={() => setActiveSubTab('payments')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              activeSubTab === 'payments' 
                ? 'bg-[#00a884] text-white shadow-sm scale-[1.02]' 
                : 'bg-transparent text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            বেতন পরিশোধ ইতিহাস ({payments.length} টি)
          </button>
        </div>

        {/* ----------------- SUB TAB 1: EMPLOYEES DATABASE ----------------- */}
        {activeSubTab === 'employees' && (
          <div className="space-y-4">
            
            {/* SEARCH & FILTERS FOR EMPLOYEES */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4.5 shadow-3xs grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">প্রতিষ্ঠান / নিয়োগকর্তা ফিল্টার</label>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                >
                  <option value="all">সকল কোম্পানি (সব কর্মী)</option>
                  {configs.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">বেতন প্রদানের স্টেটাস</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                >
                  <option value="all">সকল স্টেটাস</option>
                  <option value="Paid">পরিশোধিত (Paid)</option>
                  <option value="Pending">বকেয়া (Pending)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">কর্মী সার্চ করুন (নাম, আইডি, পদবি বা মোবাইল)</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="খুঁজুন..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl pl-9 pr-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>
              </div>
            </div>

            {/* EMPLOYEES DATA TABLE */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/60 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">কর্মচারীদের তালিকা ({filteredEmployees.length} জন কর্মী)</span>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs font-bold text-slate-400">কর্মী ডাটাবেজ লোড হচ্ছে...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-xs font-black text-slate-400">কোনো কর্মী রেকর্ড পাওয়া যায়নি।</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-4">কর্মী আইডি ও নাম</th>
                        <th className="p-4">প্রতিষ্ঠান (নিয়োগকর্তা)</th>
                        <th className="p-4">পদবি ও মোবাইল</th>
                        <th className="p-4 text-right">বেসিক বেতন</th>
                        <th className="p-4 text-center">ওভারটাইম ও অন্যান্য</th>
                        <th className="p-4 text-center">বেতন স্টেটাস</th>
                        <th className="p-4 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-black text-slate-700">
                      {filteredEmployees.map((emp, idx) => {
                        const userMeta = getUserMeta(emp.userId);
                        const rate = configs.find(c => c.id === emp.userId)?.overtimeRate || 150;
                        const overtimeVal = emp.overtimeHours * rate;
                        const totalDue = emp.basicSalary + overtimeVal + emp.otherAllowance;

                        return (
                          <tr key={`${emp.id}-${idx}`} className="hover:bg-slate-50/60 transition">
                            <td className="p-4">
                              <div className="text-slate-900 font-black">{emp.name}</div>
                              <span className="text-[9.5px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-550 font-bold block w-max mt-0.5">
                                ID: {emp.employeeId}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-bold">{userMeta.companyName}</div>
                              <span className="text-[9px] text-slate-400 block">মালিক: {userMeta.name}</span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-700 font-bold">{emp.designation}</div>
                              <span className="text-[10px] text-slate-400 block">{emp.phone || 'মোবাইল নেই'}</span>
                            </td>
                            <td className="p-4 text-right text-slate-900 font-black">
                              ৳{formatMoney(emp.basicSalary)}
                            </td>
                            <td className="p-4 text-center">
                              <div className="text-[10.5px]">ওভারটাইম: {emp.overtimeHours} ঘণ্টা (৳{formatMoney(overtimeVal)})</div>
                              <div className="text-[9px] text-slate-400">ভাতা: ৳{formatMoney(emp.otherAllowance)}</div>
                              <div className="text-[10px] text-emerald-700 font-black mt-0.5">মোট: ৳{formatMoney(totalDue)}</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => toggleEmployeePayStatus(emp)}
                                  className={`px-3 py-1 rounded-full text-[9px] font-black border transition active:scale-95 ${
                                    emp.status === 'Paid' 
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                      : 'bg-rose-50 text-rose-600 border-rose-200'
                                  }`}
                                  title="স্টেটাস পরিবর্তন করতে ক্লিক করুন"
                                >
                                  {emp.status === 'Paid' ? 'Paid (পরিশোধিত)' : 'Pending (বকেয়া)'}
                                </button>
                                {emp.lastPaymentDate && (
                                  <span className="text-[8.5px] text-slate-400 font-bold block">
                                    {emp.lastPaymentDate} {emp.lastPaymentTime}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => startEditEmployee(emp)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition active:scale-95"
                                  title="সম্পাদনা করুন"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEmployee(emp)}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-550 hover:text-rose-700 transition active:scale-95"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- SUB TAB 2: COMPANY PROFILES ----------------- */}
        {activeSubTab === 'configs' && (
          <div className="space-y-4">
            
            {/* CONFIG DATA TABLE */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/60 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">নিবন্ধিত প্রতিষ্ঠান প্রোফাইল তালিকা ({configs.length} টি)</span>
              </div>

              {configs.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-xs font-black text-slate-400">কোনো কোম্পানির স্যালারি সেটিংস পাওয়া যায়নি।</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-4">প্রতিষ্ঠানের নাম ও আইডি</th>
                        <th className="p-4">নিয়োগকর্তা (সদস্য)</th>
                        <th className="p-4 text-center">ওভারটাইম রেট</th>
                        <th className="p-4 text-center">বেতন পরিশোধ সময়সূচী</th>
                        <th className="p-4 text-center">মোট স্টাফ</th>
                        <th className="p-4 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-black text-slate-700">
                      {configs.map((cfg, idx) => {
                        const userMeta = getUserMeta(cfg.id);
                        const compStaff = employees.filter(e => e.userId === cfg.id).length;
                        return (
                          <tr key={`${cfg.id}-${idx}`} className="hover:bg-slate-50/60 transition">
                            <td className="p-4">
                              <div className="text-slate-900 font-black">{cfg.companyName}</div>
                              <span className="text-[9.5px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 font-bold block w-max mt-0.5">
                                কোম্পানি আইডি: {cfg.companyId}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-black">{userMeta.name}</div>
                              <span className="text-[10px] text-slate-400 block font-bold">{userMeta.phone}</span>
                            </td>
                            <td className="p-4 text-center text-slate-900 font-black">
                              ৳{cfg.overtimeRate} / ঘণ্টা
                            </td>
                            <td className="p-4 text-center">
                              <div className="text-[11px] font-bold text-slate-700">তারিখ: {cfg.payDate || 'সেট নেই'}</div>
                              <span className="text-[10px] text-slate-400 block">সময়: {cfg.payTime || 'সেট নেই'}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full font-black text-[10.5px] border border-teal-100">
                                {compStaff} জন কর্মী
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => startEditConfig(cfg)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition active:scale-95"
                                  title="কোম্পানি সেটিংস সম্পাদনা"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteConfig(cfg)}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-550 hover:text-rose-700 transition active:scale-95"
                                  title="কোম্পানি রিমুভ করুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- SUB TAB 3: PAYMENTS HISTORY ----------------- */}
        {activeSubTab === 'payments' && (
          <div className="space-y-4">
            
            {/* PAYMENTS HISTORY LIST */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/60 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">প্ল্যাটফর্ম বেতন পরিশোধের বিবরণী ({payments.length} টি ডিল)</span>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-xs font-black text-slate-400">কোনো বেতন পরিশোধের ইতিহাস পাওয়া যায়নি।</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500">
                        <th className="p-4">পরিশোধের তারিখ ও সময়</th>
                        <th className="p-4">প্রতিষ্ঠানের নাম</th>
                        <th className="p-4">নিয়োগকর্তা (মালিক)</th>
                        <th className="p-4 text-center">কর্মী সংখ্যা</th>
                        <th className="p-4 text-right">পরিশোধিত মোট টাকা</th>
                        <th className="p-4 text-center">রেকর্ড কন্ট্রোল</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-black text-slate-700">
                      {payments.map((pay, idx) => {
                        const userMeta = getUserMeta(pay.userId);
                        return (
                          <tr key={`${pay.id}-${idx}`} className="hover:bg-slate-50/60 transition">
                            <td className="p-4">
                              <div className="text-slate-900 font-black">{pay.payDate}</div>
                              <span className="text-[10px] text-slate-400 block font-bold">সময়: {pay.payTime}</span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-black">{pay.companyName}</div>
                              <span className="text-[9px] text-slate-400 block">Ledger Log ID: {pay.id}</span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-850 font-bold">{userMeta.name}</div>
                              <span className="text-[10px] text-slate-400 block">{userMeta.phone}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded-lg text-[10px]">
                                {pay.totalEmployees} জন স্টাফ
                              </span>
                            </td>
                            <td className="p-4 text-right text-emerald-700 font-black text-sm">
                              ৳{formatMoney(pay.amountPaid)}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeletePaymentLog(pay)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-550 hover:text-rose-700 transition active:scale-95"
                                title="লগ মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT EMPLOYEE MODAL --- */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                👥 {editingEmployee ? 'কর্মচারীর তথ্য সংশোধন করুন' : 'নতুন কর্মচারী যুক্ত করুন'}
              </h3>
              <button 
                onClick={() => setShowAddEmployeeModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="space-y-3 text-left">
              
              {/* Select employer (company) */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">প্রতিষ্ঠান / নিয়োগকর্তা সিলেক্ট করুন *</label>
                <select
                  value={empUserId}
                  onChange={(e) => setEmpUserId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                  disabled={!!editingEmployee}
                >
                  <option value="">-- কোম্পানি নির্বাচন করুন --</option>
                  {configs.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.id}>{c.companyName} ({getUserMeta(c.id).name})</option>
                  ))}
                </select>
              </div>

              {/* Employee ID */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">কর্মী আইডি (যেমন: EMP101) *</label>
                <input
                  type="text"
                  placeholder="যেমন: EMP101"
                  value={empEmployeeId}
                  onChange={(e) => setEmpEmployeeId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">কর্মচারীর নাম *</label>
                  <input
                    type="text"
                    placeholder="নাম লিখুন"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                    required
                  />
                </div>

                {/* Designation */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">পদবি / ডেজিগনেশন *</label>
                  <input
                    type="text"
                    placeholder="যেমন: ক্যাশিয়ার"
                    value={empDesignation}
                    onChange={(e) => setEmpDesignation(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Basic Salary */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">বেসিক বেতন (৳) *</label>
                  <input
                    type="number"
                    placeholder="যেমন: 15000"
                    value={empBasicSalary}
                    onChange={(e) => setEmpBasicSalary(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                    required
                  />
                </div>

                {/* Overtime Hours */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">ওভারটাইম (ঘণ্টা)</label>
                  <input
                    type="number"
                    placeholder="ঘণ্টা"
                    value={empOvertimeHours}
                    onChange={(e) => setEmpOvertimeHours(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>

                {/* Other Allowance */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">ভাতা / বোনাস (৳)</label>
                  <input
                    type="number"
                    placeholder="অন্যান্য ভাতা"
                    value={empOtherAllowance}
                    onChange={(e) => setEmpOtherAllowance(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>
              </div>

              {/* Employee Phone */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">কর্মচারীর মোবাইল নম্বর (ঐচ্ছিক)</label>
                <input
                  type="tel"
                  placeholder="যেমন: 017xxxxxxxx"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">বেতন স্টেটাস *</label>
                <select
                  value={empStatus}
                  onChange={(e) => setEmpStatus(e.target.value as any)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                >
                  <option value="Pending">বকেয়া (Pending)</option>
                  <option value="Paid">পরিশোধিত (Paid)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-black transition active:scale-95 text-xs shadow-3xs"
                >
                  {editingEmployee ? 'সংশোধন করুন' : 'যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT CONFIG MODAL --- */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                🏢 {editingConfig ? 'প্রতিষ্ঠান স্যালারি কনফিগার করুন' : 'নতুন প্রতিষ্ঠান প্রোফাইল যুক্ত করুন'}
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfigSubmit} className="space-y-3 text-left">
              
              {/* Select User to map configuration */}
              {!editingConfig && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">মালিক / নিয়োগকর্তা নির্বাচন করুন *</label>
                  <select
                    value={selectedConfigUser}
                    onChange={(e) => setSelectedConfigUser(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                    required
                  >
                    <option value="">-- প্ল্যাটফর্ম মেম্বার সিলেক্ট করুন --</option>
                    {users.map((u, idx) => (
                      <option key={`${u.uid}-${idx}`} value={u.uid}>{u.name} ({u.phone})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Company Name */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">প্রতিষ্ঠানের নাম (যেমন: AMB সল্যুশনস) *</label>
                <input
                  type="text"
                  placeholder="প্রতিষ্ঠানের নাম লিখুন"
                  value={cfgCompanyName}
                  onChange={(e) => setCfgCompanyName(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Company ID */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">কোম্পানি রেজিস্টার্ড আইডি (যেমন: AMB-CORP-99) *</label>
                <input
                  type="text"
                  placeholder="কোম্পানি আইডি দিন"
                  value={cfgCompanyId}
                  onChange={(e) => setCfgCompanyId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Overtime Rate */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">ওভারটাইম প্রতি ঘণ্টার হার (৳) *</label>
                <input
                  type="number"
                  placeholder="যেমন: 150"
                  value={cfgOvertimeRate}
                  onChange={(e) => setCfgOvertimeRate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Pay Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">বেতন প্রদানের তারিখ</label>
                  <input
                    type="date"
                    value={cfgPayDate}
                    onChange={(e) => setCfgPayDate(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>

                {/* Pay Time */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">বেতন প্রদানের সময়</label>
                  <input
                    type="time"
                    value={cfgPayTime}
                    onChange={(e) => setCfgPayTime(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-black transition active:scale-95 text-xs shadow-3xs"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
