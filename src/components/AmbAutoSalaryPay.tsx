import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  Minus, 
  UserPlus, 
  UserMinus, 
  FileText, 
  Users, 
  BarChart2, 
  Calculator, 
  Bell, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Calendar, 
  BookOpen, 
  Settings, 
  QrCode, 
  Save, 
  Phone, 
  MessageSquare, 
  Check,
  X,
  TrendingUp,
  Clock,
  Briefcase,
  Share2,
  DollarSign,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Employee {
  id?: string;
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
}

interface SalaryConfig {
  companyName: string;
  companyId: string;
  overtimeRate: number;
  payDate: string;
  payTime: string;
}

interface AmbAutoSalaryPayProps {
  user: User | null;
  onBack: () => void;
  syncLiveProfile: () => void;
  appConfig: AppConfig | null;
}

export default function AmbAutoSalaryPay({ user, onBack, syncLiveProfile, appConfig }: AmbAutoSalaryPayProps) {
  // Current tab inside Salary Pay
  // tabs: 'dashboard' | 'employees' | 'payment' | 'reports' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'payment' | 'reports' | 'settings'>('dashboard');

  // Local State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SalaryConfig>({
    companyName: 'ABC Trading Limited',
    companyId: 'AMBC12345',
    overtimeRate: 200,
    payDate: '25 জুন, 2026',
    payTime: 'সকাল 10:00 AM'
  });

  // Selected employee for detailed breakdown
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form controls
  const [employeeForm, setEmployeeForm] = useState<Omit<Employee, 'id'>>({
    employeeId: '',
    name: '',
    designation: '',
    basicSalary: 0,
    overtimeHours: 0,
    otherAllowance: 0,
    phone: '',
    status: 'Pending'
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Pin & payment processing state
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // Load configuration & employees
  useEffect(() => {
    if (!user?.uid) return;

    // Load company config
    const configRef = doc(db, 'salary_configs', user.uid);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as SalaryConfig);
      } else {
        // Create initial config
        updateDoc(doc(db, 'users', user.uid), {
          // ensure initial balance is high or as configured if empty
        }).catch(() => {});
      }
    });

    // Load employees
    const empQuery = query(collection(db, 'salary_employees'), where('userId', '==', user.uid));
    const unsubEmployees = onSnapshot(empQuery, async (snapshot) => {
      const empList: Employee[] = [];
      snapshot.forEach((doc) => {
        empList.push({ id: doc.id, ...doc.data() } as Employee);
      });
      // Sort by employeeId
      empList.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
      setEmployees(empList);
      
      // Default select first employee
      if (empList.length > 0) {
        setSelectedEmployee((prev) => {
          if (!prev) return empList[0];
          const stillExists = empList.find((e) => e.id === prev.id);
          return stillExists || empList[0];
        });
      } else {
        setSelectedEmployee(null);
      }
      setLoading(false);
    });

    // Load real-time payment history
    const historyQuery = query(
      collection(db, 'salary_payments'), 
      where('userId', '==', user.uid)
    );
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const historyList: any[] = [];
      snapshot.forEach((doc) => {
        historyList.push({ id: doc.id, ...doc.data() });
      });
      // Sort client-side by createdAt descending
      historyList.sort((a, b) => {
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      });
      setPaymentHistory(historyList);
    });

    return () => {
      unsubConfig();
      unsubEmployees();
      unsubHistory();
    };
  }, [user?.uid]);

  // Handle selected employee change when employees list updates
  useEffect(() => {
    if (employees.length > 0) {
      if (!selectedEmployee || !employees.find(e => e.id === selectedEmployee.id)) {
        setSelectedEmployee(employees[0]);
      } else {
        // Keep selected employee updated with latest values
        const updated = employees.find(e => e.id === selectedEmployee.id);
        if (updated) setSelectedEmployee(updated);
      }
    } else {
      setSelectedEmployee(null);
    }
  }, [employees]);

  // Calculate stats
  const totalEmployees = employees.length;
  const totalMonthlySalary = employees.reduce((acc, emp) => {
    const overtimeAmount = emp.overtimeHours * config.overtimeRate;
    return acc + emp.basicSalary + overtimeAmount + emp.otherAllowance;
  }, 0);

  const totalPendingSalary = employees
    .filter(emp => emp.status === 'Pending')
    .reduce((acc, emp) => {
      const overtimeAmount = emp.overtimeHours * config.overtimeRate;
      return acc + emp.basicSalary + overtimeAmount + emp.otherAllowance;
    }, 0);

  const pendingEmployeesCount = employees.filter(emp => emp.status === 'Pending').length;
  const paymentStatusText = pendingEmployeesCount === 0 ? 'সফলভাবে সম্পন্ন' : 'আংশিক পেন্ডিং';

  // Format money to Bengali locale style with comma
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('bn-BD');
  };

  // Load sample demo staff
  const handleLoadSampleEmployees = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const samples: Omit<Employee, 'id'>[] = [
        {
          employeeId: 'EMP001',
          name: 'রাকিবুল ইসলাম',
          designation: 'সেলস এক্সিকিউটিভ',
          basicSalary: 25000,
          overtimeHours: 10,
          otherAllowance: 1500,
          phone: '01712345678',
          status: 'Pending'
        },
        {
          employeeId: 'EMP002',
          name: 'সুমাইয়া আক্তার',
          designation: 'অ্যাকাউন্টস অফিসার',
          basicSalary: 28000,
          overtimeHours: 5,
          otherAllowance: 2000,
          phone: '01812345678',
          status: 'Pending'
        },
        {
          employeeId: 'EMP003',
          name: 'মো: আরমান হোসেন',
          designation: 'আইটি সাপোর্ট ইঞ্জিনিয়ার',
          basicSalary: 32000,
          overtimeHours: 12,
          otherAllowance: 2500,
          phone: '01912345678',
          status: 'Pending'
        }
      ];

      for (const sample of samples) {
        await addDoc(collection(db, 'salary_employees'), {
          ...sample,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      console.log('সফলভাবে 3 জন নমুনা ডেমো স্টাফ যুক্ত করা হয়েছে!');
    } catch (err) {
      console.error('Error loading sample employees:', err);
      console.warn('ডেমো স্টাফ লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // Pay salary for a single employee
  const handlePaySingleEmployee = async (emp: Employee) => {
    if (!user?.uid || !emp.id) return;
    const overtimeVal = emp.overtimeHours * config.overtimeRate;
    const totalDue = emp.basicSalary + overtimeVal + emp.otherAllowance;

    if (emp.status === 'Paid') {
      console.log('এই কর্মচারীর বেতন ইতোমধ্যে পরিশোধিত!');
      return;
    }

    const inputPin = prompt(`প্রিয় ${user.name}, "${emp.name}"-কে ৳ ${formatMoney(totalDue)} বেতন প্রদানের জন্য 4-ডিজিট সিকিউরিটি পিন (PIN) দিন:`);
    if (!inputPin) return;

    if (inputPin !== user.pin) {
      console.warn('ভুল পিন নম্বর! স্যালারি পেমেন্ট বাতিল করা হয়েছে।');
      return;
    }

    if ((user.balance || 0) < totalDue) {
      console.warn('দুঃখিত! আপনার ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়।');
      return;
    }

    try {
      // 1. Deduct balance
      const userRef = doc(db, 'users', user.uid);
      const newBal = (user.balance || 0) - totalDue;
      await updateDoc(userRef, { balance: newBal, mainBalance: newBal });

      // 2. Mark employee Paid
      await updateDoc(doc(db, 'salary_employees', emp.id), {
        status: 'Paid',
        lastPaymentDate: config.payDate,
        lastPaymentTime: config.payTime
      });

      // 3. Add Transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        type: 'debit',
        amount: totalDue,
        description: `AMB অটো স্যালারি পে - ${config.companyName} স্টাফ "${emp.name}" (${emp.employeeId}) এর বেতন বিতরণ`,
        category: 'Salary',
        status: 'approved',
        createdAt: new Date().toISOString()
      });

      // 4. Add Payment Log
      addDoc(collection(db, 'admin_notifications'), {
        title: '💼 নতুন অটো সেলারি পে সম্পন্ন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) মোট ৳${totalPendingSalary.toLocaleString('bn-BD')} টাকা অটো সেলারি পে সম্পন্ন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        amount: totalPendingSalary,
        type: 'salary_disbursed',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      await addDoc(collection(db, 'salary_payments'), {
        userId: user.uid,
        companyName: config.companyName,
        totalEmployees: 1,
        amountPaid: totalDue,
        payDate: config.payDate,
        payTime: config.payTime,
        createdAt: new Date().toISOString()
      });

      // 5. Add Notification
      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: user.uid,
        title: 'একক স্যালারি বিতরণ সফল!',
        body: `আপনার ${config.companyName} স্টাফ "${emp.name}"-কে ৳ ${formatMoney(totalDue)} বেতন সফলভাবে পরিশোধ করা হয়েছে।`,
        read: false,
        isPersonal: true,
        category: 'Salary',
        createdAt: new Date().toISOString()
      });

      syncLiveProfile();
      console.log(`সফলভাবে "${emp.name}"-কে ৳ ${formatMoney(totalDue)} বেতন প্রদান সম্পন্ন হয়েছে!`);
    } catch (err) {
      console.error('Single Payment Error:', err);
      console.error('পেমেন্ট প্রসেস করতে কারিগরি সমস্যা হয়েছে।');
    }
  };

  // Add or Edit Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    try {
      if (editingEmployeeId) {
        const empDocRef = doc(db, 'salary_employees', editingEmployeeId);
        await updateDoc(empDocRef, {
          ...employeeForm,
          basicSalary: Number(employeeForm.basicSalary),
          overtimeHours: Number(employeeForm.overtimeHours),
          otherAllowance: Number(employeeForm.otherAllowance),
        });
      } else {
        await addDoc(collection(db, 'salary_employees'), {
          ...employeeForm,
          basicSalary: Number(employeeForm.basicSalary),
          overtimeHours: Number(employeeForm.overtimeHours),
          otherAllowance: Number(employeeForm.otherAllowance),
          userId: user.uid,
          status: 'Pending',
          createdAt: new Date().toISOString()
        });
      }
      setShowAddModal(false);
      setEditingEmployeeId(null);
      setEmployeeForm({
        employeeId: '',
        name: '',
        designation: '',
        basicSalary: 0,
        overtimeHours: 0,
        otherAllowance: 0,
        phone: '',
        status: 'Pending'
      });
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  const handleEditClick = (emp: Employee) => {
    if (!emp.id) return;
    setEditingEmployeeId(emp.id);
    setEmployeeForm({
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      basicSalary: emp.basicSalary,
      overtimeHours: emp.overtimeHours,
      otherAllowance: emp.otherAllowance,
      phone: emp.phone,
      status: emp.status
    });
    setShowAddModal(true);
  };

  const handleDeleteClick = async (empId?: string) => {
    if (!empId) return;
    if (confirm('আপনি কি নিশ্চিতভাবে এই কর্মচারীকে ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(db, 'salary_employees', empId));
        if (selectedEmployee?.id === empId) {
          setSelectedEmployee(null);
        }
      } catch (err) {
        console.error('Error deleting employee:', err);
      }
    }
  };

  // Process salary disbursement
  const handleProcessPayment = async () => {
    if (!user?.uid) return;
    setPinError('');

    // PIN check
    if (pin !== user.pin) {
      setPinError('ভুল পিন নম্বর! আবার চেষ্টা করুন।');
      return;
    }

    // Balance check
    if ((user.balance || 0) < totalPendingSalary) {
      setPinError('দুঃখিত! আপনার ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়।');
      return;
    }

    if (totalPendingSalary <= 0) {
      setPinError('পরিশোধ করার জন্য কোনো পেন্ডিং বেতন নেই!');
      return;
    }

    setProcessingPayment(true);
    try {
      // 1. Deduct balance from user
      const userRef = doc(db, 'users', user.uid);
      const newBalance = (user.balance || 0) - totalPendingSalary;
      await updateDoc(userRef, { balance: newBalance, mainBalance: newBalance });

      // 2. Set all pending employees' status to 'Paid' for this user
      const empQuery = query(
        collection(db, 'salary_employees'), 
        where('userId', '==', user.uid),
        where('status', '==', 'Pending')
      );
      const snapshot = await getDocs(empQuery);
      
      const batchPromises = snapshot.docs.map((docSnap, _idx) => {
        return updateDoc(doc(db, 'salary_employees', docSnap.id), {
          status: 'Paid',
          lastPaymentDate: config.payDate,
          lastPaymentTime: config.payTime
        });
      });
      await Promise.all(batchPromises);

      // 3. Register transaction in 'transactions'
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        type: 'debit',
        amount: totalPendingSalary,
        description: `AMB অটো স্যালারি পে - ${config.companyName} প্রতিষ্ঠানের ${pendingEmployeesCount} জন কর্মচারীর মাসিক স্যালারি পেমেন্ট সম্পন্ন`,
        category: 'Salary',
        status: 'approved',
        createdAt: new Date().toISOString()
      });

      // 4. Create internal payment log
      addDoc(collection(db, 'admin_notifications'), {
        title: '💼 নতুন অটো সেলারি পে সম্পন্ন',
        message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) মোট ৳${totalPendingSalary.toLocaleString('bn-BD')} টাকা অটো সেলারি পে সম্পন্ন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        amount: totalPendingSalary,
        type: 'salary_disbursed',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      await addDoc(collection(db, 'salary_payments'), {
        userId: user.uid,
        companyName: config.companyName,
        totalEmployees: pendingEmployeesCount,
        amountPaid: totalPendingSalary,
        payDate: config.payDate,
        payTime: config.payTime,
        createdAt: new Date().toISOString()
      });

      // 5. Create automated inbox notification for the user
      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: user.uid,
        title: 'বেতন পরিশোধ সফল!',
        body: `আপনার ${config.companyName} প্রতিষ্ঠানের ${pendingEmployeesCount} জন স্টাফের মোট ৳ ${formatMoney(totalPendingSalary)} বেতন আপনার ওয়ালেট থেকে সফলভাবে পরিশোধ করা হয়েছে।`,
        read: false,
        isPersonal: true,
        category: 'Salary',
        createdAt: new Date().toISOString()
      });

      // 6. Success
      setPaymentSuccess(true);
      setPin('');
      syncLiveProfile(); // Refresh profile values
      setTimeout(() => {
        setActiveTab('dashboard');
      }, 500);

    } catch (err) {
      console.error('Payment Error:', err);
      setPinError('পেমেন্ট প্রসেস করতে কারিগরি সমস্যা হয়েছে।');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    try {
      await setDoc(doc(db, 'salary_configs', user.uid), {
        ...config,
        userId: user.uid
      }, { merge: true });
      console.log('কনফিগারেশন সফলভাবে আপডেট হয়েছে!');
    } catch (err) {
      console.error('Error saving configs:', err);
      console.error('কনফিগারেশন সেভ করতে সমস্যা হয়েছে।');
    }
  };

  const triggerResetStatus = async () => {
    if (!user?.uid) return;
    if (confirm('আপনি কি সকল কর্মচারীর পেমেন্ট স্ট্যাটাস পুনরায় "পেন্ডিং" করতে চান যাতে আপনি নতুন করে বেতন পাঠাতে পারেন?')) {
      try {
        const empQuery = query(collection(db, 'salary_employees'), where('userId', '==', user.uid));
        const snapshot = await getDocs(empQuery);
        const batchPromises = snapshot.docs.map((docSnap, _idx) => {
          return updateDoc(doc(db, 'salary_employees', docSnap.id), {
            status: 'Pending'
          });
        });
        await Promise.all(batchPromises);
        setPaymentSuccess(false);
        console.log('সকল কর্মচারীর স্যালারি স্ট্যাটাস সফলভাবে পেন্ডিং করা হয়েছে!');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClearAllEmployees = async () => {
    if (!user?.uid) return;
    if (confirm('আপনি কি নিশ্চিতভাবে আপনার সকল কর্মচারীর তথ্য ডিলিট করতে চান? এটি রিভার্স করা যাবে না এবং ডেমো সম্পূর্ণ মুছে যাবে।')) {
      try {
        setLoading(true);
        const empQuery = query(collection(db, 'salary_employees'), where('userId', '==', user.uid));
        const snapshot = await getDocs(empQuery);
        const deletePromises = snapshot.docs.map((docSnap, _idx) => deleteDoc(doc(db, 'salary_employees', docSnap.id)));
        await Promise.all(deletePromises);
        setSelectedEmployee(null);
        console.log('সকল কর্মচারীর তথ্য সফলভাবে মুছে ফেলা হয়েছে!');
      } catch (err) {
        console.error('Error clearing employees:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleShareWhatsApp = (emp: Employee) => {
    const overtimeVal = emp.overtimeHours * config.overtimeRate;
    const totalDue = emp.basicSalary + overtimeVal + emp.otherAllowance;
    const text = `*AMB অটো স্যালারি পে*\n\nপ্রিয় ${emp.name},\nআপনার ${config.payDate} তারিখের বেতন পাঠানো হয়েছে।\n\nবেসিক বেতন: ৳ ${formatMoney(emp.basicSalary)}\nওভারটাইম: ${emp.overtimeHours} ঘণ্টা = ৳ ${formatMoney(overtimeVal)}\nঅন্যান্য ভাতা: ৳ ${formatMoney(emp.otherAllowance)}\n*মোট পরিশোধিত:* ৳ ${formatMoney(totalDue)}\nতারিখ ও সময়: ${config.payDate} ${config.payTime}\n\nধন্যবাদান্তে,\n${config.companyName}\nAMB স্যালারি ম্যানেজমেন্ট সিস্টেম`;
    window.open(`https://api.whatsapp.com/send?phone=${emp.phone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f4f6] pb-24 font-sans select-none relative" id="amb-salary-pay-root">
      
      {/* Dynamic Upper Top Green bar like AMB Layout */}
      <div className="bg-[#00a884] bg-gradient-to-r from-[#00a884] via-[#05c39b] to-[#00a884] px-4 pt-4 pb-20 text-white rounded-b-[2rem] shadow-md relative">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
            id="salary-back-btn"
          >
            <ChevronLeft className="w-6 h-6 text-white stroke-[2.5]" />
          </button>
          
          <div className="text-center flex-1">
            <h1 className="text-lg xs:text-xl font-black tracking-tight" id="salary-main-title">
              AMB অটো স্যালারি পে
            </h1>
            <p className="text-[10px] xs:text-[11px] font-bold text-[#cbfef4]/80 tracking-wide mt-0.5">
              কোম্পানি স্যালারি ম্যানেজমেন্ট সিস্টেম
            </p>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border border-white text-[8px] font-extrabold flex items-center justify-center">
              5
            </span>
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="max-w-4xl mx-auto px-3 xs:px-4 -mt-16 relative z-10">
        
        {/* Profile Info block exact replica */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4" id="company-profile-block">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              {/* Brand logo container */}
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
                <span className="font-black text-xs text-[#00a884]">{config.companyName.substring(0, 3).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-black text-slate-800 leading-tight">
                    {config.companyName}
                  </h3>
                  <div className="w-4 h-4 bg-[#00a884] rounded-full flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                  </div>
                </div>
                <p className="text-[10.5px] font-extrabold text-slate-400 mt-1">
                  Company ID: {config.companyId}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10.5px] font-black text-slate-500">Al Mayadin Wallet Balance</span>
                  <div className="flex items-center gap-1 text-[#00a884] font-black text-sm">
                    <span>৳</span>
                    <span>{formatMoney(user?.balance || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button 
                onClick={() => setActiveTab('payment')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#e6f7f4] border border-[#00a884]/40 hover:bg-[#cbfef4] text-[#00a884] text-xs font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                <DollarSign className="w-4 h-4 stroke-[2.5]" />
                বেতন পাঠান
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Salary Report
              </button>
            </div>

          </div>
        </div>

        {/* -------------------- TAB 1: DASHBOARD -------------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4" id="dashboard-tab-content">
            
            {/* Summary Stat Grid - 4 in 1 Row */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2" id="summary-stats-grid">
              
              <div className="bg-white rounded-xl p-2 sm:p-3 border border-slate-100 shadow-3xs text-center flex flex-col justify-between min-h-[85px]">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
                  <Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="mt-1">
                  <span className="text-[8.5px] sm:text-[10px] font-extrabold text-slate-400 block truncate">মোট কর্মচারী</span>
                  <span className="text-[11px] sm:text-[13px] font-black text-slate-800 mt-0.5 block">{totalEmployees} জন</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2 sm:p-3 border border-slate-100 shadow-3xs text-center flex flex-col justify-between min-h-[85px]">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="mt-1">
                  <span className="text-[8.5px] sm:text-[10px] font-extrabold text-slate-400 block truncate">মাসিক স্যালারি</span>
                  <span className="text-[11px] sm:text-[13px] font-black text-slate-800 mt-0.5 block truncate">৳ {formatMoney(totalMonthlySalary)}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2 sm:p-3 border border-slate-100 shadow-3xs text-center flex flex-col justify-between min-h-[85px]">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-50 flex items-center justify-center mx-auto text-orange-600">
                  <Calendar className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="mt-1">
                  <span className="text-[8.5px] sm:text-[10px] font-extrabold text-slate-400 block truncate">বেতন পে ডেট</span>
                  <span className="text-[9.5px] sm:text-[11.5px] font-black text-slate-800 mt-0.5 block truncate">{config.payDate}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2 sm:p-3 border border-slate-100 shadow-3xs text-center flex flex-col justify-between min-h-[85px]">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                  <Clock className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="mt-1">
                  <span className="text-[8.5px] sm:text-[10px] font-extrabold text-slate-400 block truncate">পেমেন্ট সময়</span>
                  <span className="text-[9.5px] sm:text-[11.5px] font-black text-slate-800 mt-0.5 block truncate">{config.payTime}</span>
                </div>
              </div>

            </div>

            {/* Payment Status Bar */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-100 shadow-3xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-[#00a884] shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9.5px] font-extrabold text-slate-400 block">পেমেন্ট স্ট্যাটাস</span>
                  <span className={`text-[11.5px] font-black ${pendingEmployeesCount === 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {paymentStatusText}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">কুইক অ্যাকশন</h4>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                <button 
                  onClick={() => {
                    setEditingEmployeeId(null);
                    setEmployeeForm({
                      employeeId: `EMP00${employees.length + 1}`,
                      name: '',
                      designation: '',
                      basicSalary: 15000,
                      overtimeHours: 0,
                      otherAllowance: 0,
                      phone: '',
                      status: 'Pending'
                    });
                    setShowAddModal(true);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-1.5 shadow-3xs">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 leading-tight">কর্মচারী যোগ করুন</span>
                </button>

                <button 
                  onClick={() => setActiveTab('employees')}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-1.5 shadow-3xs">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 leading-tight">স্যালারি সেট করুন</span>
                </button>

                <button 
                  onClick={() => setActiveTab('employees')}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 mb-1.5 shadow-3xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 leading-tight">ওভারটাইম ম্যানেজ</span>
                </button>

                <button 
                  onClick={() => setActiveTab('settings')}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-1.5 shadow-3xs">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 leading-tight">পে শিডিউল</span>
                </button>

                <button 
                  onClick={() => setActiveTab('reports')}
                  className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-[#00a884] mb-1.5 shadow-3xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[9.5px] font-black text-slate-700 leading-tight">রিপোর্ট দেখুন</span>
                </button>
              </div>
            </div>

            {/* Success Banner matching exact style */}
            {pendingEmployeesCount === 0 && (
              <div className="bg-[#e6f7f4] border border-[#00a884]/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-3xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0">
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                  <div>
                    <h5 className="text-[13.5px] font-black text-slate-800">
                      বেতন সফলভাবে পাঠানো হয়েছে
                    </h5>
                    <p className="text-[10.5px] font-bold text-slate-500 mt-0.5">
                      {config.payDate} {config.payTime} সময়ে {totalEmployees} জন কর্মচারীর বেতন পাঠানো হয়েছে।
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('reports')}
                  className="bg-[#00a884] hover:bg-[#05c39b] text-white text-[11px] font-black px-3.5 py-1.5 rounded-lg transition-all shadow-sm shrink-0"
                >
                  রিপোর্ট দেখুন
                </button>
              </div>
            )}

            {/* Employee List Table Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-[14px] font-black text-slate-800">
                  কর্মচারী তালিকা
                </h4>
                <button 
                  onClick={() => setActiveTab('employees')}
                  className="text-[11px] font-black text-[#00a884] hover:underline"
                >
                  সব দেখুন
                </button>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-extrabold uppercase tracking-wide border-b border-slate-100">
                      <th className="py-2.5 px-4 font-black">কর্মচারীর নাম ও ID</th>
                      <th className="py-2.5 px-3 font-black">পদবি</th>
                      <th className="py-2.5 px-3 font-black">মাসিক বেতন</th>
                      <th className="py-2.5 px-3 font-black">ওভারটাইম</th>
                      <th className="py-2.5 px-3 font-black">মোট পাওনা</th>
                      <th className="py-2.5 px-4 font-black text-center">স্ট্যাটাস ও অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[12px] text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 font-bold text-slate-400">
                          লোড হচ্ছে...
                        </td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 font-bold text-slate-400">
                          কোনো কর্মচারী নিবন্ধিত নেই।
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp, idx) => {
                        const overtimeVal = emp.overtimeHours * config.overtimeRate;
                        const totalDue = emp.basicSalary + overtimeVal + emp.otherAllowance;
                        const isSelected = selectedEmployee?.id === emp.id;

                        return (
                          <tr 
                            key={`${emp.id || idx}-${idx}`}
                            onClick={() => setSelectedEmployee(emp)}
                            className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${isSelected ? 'bg-slate-50 font-medium' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                  <span className="font-extrabold text-[10px] text-slate-500">
                                    {emp.name.substring(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-black text-slate-800 block text-[12.5px]">{emp.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400 block">{emp.employeeId}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-slate-600 font-bold">{emp.designation}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-slate-800">৳ {formatMoney(emp.basicSalary)}</span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[10.5px]">
                                <span className="font-bold text-slate-700 block">{emp.overtimeHours} ঘণ্টা</span>
                                <span className="text-slate-400 font-extrabold">৳ {formatMoney(overtimeVal)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-black text-[#00a884] text-[13px]">৳ {formatMoney(totalDue)}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[9.5px] font-black leading-none ${
                                  emp.status === 'Paid' 
                                    ? 'bg-[#e6f7f4] text-[#00a884] border border-[#00a884]/30' 
                                    : 'bg-amber-50 text-amber-600 border border-amber-500/20'
                                }`}>
                                  {emp.status === 'Paid' ? 'পেইড' : 'পেন্ডিং'}
                                </span>
                                {emp.status === 'Pending' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePaySingleEmployee(emp);
                                    }}
                                    className="bg-[#00a884] hover:bg-[#05c39b] text-white text-[9px] font-black px-2 py-0.5 rounded shadow-2xs transition-transform active:scale-95"
                                  >
                                    বেতন দিন
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Employee Detailed Breakdown Area */}
            {selectedEmployee && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" id="employee-breakdown-panel">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-3">
                  <h4 className="text-[13px] font-black text-slate-800">
                    {selectedEmployee.name} ({selectedEmployee.employeeId}) - স্যালারি বিবরণ
                  </h4>
                  <span className={`text-[10.5px] font-black px-2 py-0.5 rounded ${
                    selectedEmployee.status === 'Paid' ? 'bg-[#e6f7f4] text-[#00a884]' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {selectedEmployee.status === 'Paid' ? 'পেইড সফল' : 'পেমেন্ট পেন্ডিং'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase">বেসিক বেতন</span>
                    <span className="text-[14px] font-black text-slate-800 mt-1 block">৳ {formatMoney(selectedEmployee.basicSalary)}</span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase">ওভারটাইম বিবরণ</span>
                    <span className="text-[12px] font-black text-slate-800 mt-1 block">
                      {selectedEmployee.overtimeHours} ঘণ্টা × ৳ {config.overtimeRate}/ঘণ্টা
                    </span>
                    <span className="text-[13px] font-black text-[#00a884] mt-0.5 block">
                      = ৳ {formatMoney(selectedEmployee.overtimeHours * config.overtimeRate)}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase">অন্যান্য ভাতা</span>
                    <span className="text-[14px] font-black text-slate-800 mt-1 block">৳ {formatMoney(selectedEmployee.otherAllowance)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-50">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 block">মোট পাওনা</span>
                    <span className="text-[16px] font-black text-[#00a884] mt-0.5 block">
                      ৳ {formatMoney(selectedEmployee.basicSalary + (selectedEmployee.overtimeHours * config.overtimeRate) + selectedEmployee.otherAllowance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 block">পেমেন্ট সময়</span>
                    <span className="text-[11.5px] font-black text-slate-600 mt-1 block">
                      {selectedEmployee.status === 'Paid' ? (selectedEmployee.lastPaymentDate || config.payDate) + ' ' + (selectedEmployee.lastPaymentTime || config.payTime) : 'পেন্ডিং'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 block">পেমেন্ট মাধ্যম</span>
                    <span className="text-[12px] font-black text-slate-600 mt-1 block">
                      {selectedEmployee.status === 'Paid' ? 'Al Mayadin Wallet' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notification and Slip mockup layout side-by-side like screenshot */}
            {selectedEmployee && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch" id="notification-mockup-section">
                
                {/* 1. Mobile phone mockup */}
                <div className="md:col-span-5 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
                  <h4 className="text-[12.5px] font-black text-slate-800 mb-3 border-b border-slate-50 pb-2">
                    কর্মচারী নোটিফিকেশন ({selectedEmployee.name})
                  </h4>
                  
                  {/* Phone screen simulator */}
                  <div className="w-full max-w-[240px] mx-auto bg-black rounded-3xl p-2.5 shadow-lg border-4 border-slate-800 relative">
                    {/* Ear speaker / camera notch */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-b-xl z-20 flex items-center justify-center">
                      <div className="w-6 h-1 bg-slate-800 rounded-full"></div>
                    </div>

                    <div className="bg-slate-900 aspect-[9/16] rounded-2xl p-2 overflow-hidden text-white font-sans flex flex-col justify-between relative z-10 select-none">
                      {/* Top status bar */}
                      <div className="flex justify-between items-center text-[8px] opacity-80 pt-1">
                        <span className="font-bold">10:01</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[6px]">4G</span>
                          <div className="w-3.5 h-1.5 border border-white rounded-xs p-px flex items-center">
                            <div className="bg-white h-full w-2.5"></div>
                          </div>
                        </div>
                      </div>

                      {/* Floating push notification card */}
                      <div className="mt-8 bg-slate-800/90 backdrop-blur-md rounded-xl p-2 border border-slate-700/50 text-left shadow-md">
                        <div className="flex items-center gap-1.5 mb-1 justify-between">
                          <div className="flex items-center gap-1">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#00a884] flex items-center justify-center text-[7px] font-black text-white">
                              AMB
                            </div>
                            <span className="text-[8px] font-black text-slate-300">AMB অ্যাপ</span>
                          </div>
                          <span className="text-[7px] text-slate-400 font-bold">Just now</span>
                        </div>
                        <h6 className="text-[9px] font-black text-white leading-tight">
                          আপনার {config.payDate.split(' ')[1] || 'জুন'} মাসের বেতন পাঠানো হয়েছে
                        </h6>
                        <p className="text-[7.5px] text-slate-300 mt-1 leading-snug line-clamp-2">
                          ৳ {formatMoney(selectedEmployee.basicSalary + (selectedEmployee.overtimeHours * config.overtimeRate) + selectedEmployee.otherAllowance)} (বেসিক: ৳{formatMoney(selectedEmployee.basicSalary)} + ওভারটাইম: ৳{formatMoney(selectedEmployee.overtimeHours * config.overtimeRate)})
                        </p>
                      </div>

                      {/* Blank bottom area representing a locked screen background */}
                      <div className="flex-1"></div>

                      {/* Lock screen Clock */}
                      <div className="text-center mb-10">
                        <span className="text-2xl font-black block tracking-tight">10:01</span>
                        <span className="text-[8px] font-bold text-slate-400">Wednesday, 25 June</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Structured Slip Receipt */}
                <div className="md:col-span-7 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div className="border-b border-slate-100 pb-3 mb-3">
                    <h4 className="text-[13px] font-black text-slate-800">
                      স্যালারি পে স্লিপ / Receipt
                    </h4>
                  </div>

                  {/* Green-accent receipt panel exact replica */}
                  <div className="bg-[#e6f7f4]/40 border border-[#00a884]/20 rounded-xl p-4 flex-1 flex flex-col justify-between font-mono relative overflow-hidden">
                    
                    {/* Watermark badge icon of AMB */}
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 text-[#00a884]/5 pointer-events-none select-none">
                      <BookOpen className="w-full h-full" />
                    </div>

                    <div className="space-y-2 relative z-10 text-[11px] xs:text-[12px] text-slate-700">
                      <div>
                        <span className="font-extrabold text-slate-800 text-[13px] block">প্রিয় {selectedEmployee.name},</span>
                        <span className="text-[10px] font-bold text-slate-500 mt-0.5 block">আপনার {config.payDate.split(' ')[1] || 'জুন'} মাসের বেতন পাঠানো হয়েছে।</span>
                      </div>

                      <div className="border-t border-dashed border-[#00a884]/30 my-2"></div>

                      <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-slate-500">বেসিক বেতনঃ</span>
                        <span className="font-black text-slate-800">৳ {formatMoney(selectedEmployee.basicSalary)}</span>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-slate-500">ওভারটাইমঃ</span>
                        <span className="font-black text-slate-800">
                          {selectedEmployee.overtimeHours} ঘণ্টা = ৳ {formatMoney(selectedEmployee.overtimeHours * config.overtimeRate)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-slate-500">অন্যান্য ভাতাঃ</span>
                        <span className="font-black text-slate-800">৳ {formatMoney(selectedEmployee.otherAllowance)}</span>
                      </div>

                      <div className="border-t border-dashed border-[#00a884]/30 my-2"></div>

                      <div className="flex justify-between items-center py-1.5 text-[#00a884] bg-[#e6f7f4] px-2 rounded-lg">
                        <span className="font-black">মোট পরিশোধিতঃ</span>
                        <span className="font-black text-[13.5px]">
                          ৳ {formatMoney(selectedEmployee.basicSalary + (selectedEmployee.overtimeHours * config.overtimeRate) + selectedEmployee.otherAllowance)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10.5px] text-slate-500 pt-1.5">
                        <span>তারিখঃ {config.payDate}</span>
                        <span>সময়ঃ {config.payTime}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-[#00a884]/20 flex items-center justify-between text-[10px] text-slate-500">
                      <span>ধন্যবাদ! AMB অটো স্যালারি পে সিস্টেম</span>
                      
                      {/* Send via WhatsApp action */}
                      <button 
                        onClick={() => handleShareWhatsApp(selectedEmployee)}
                        className="flex items-center gap-1 bg-[#25d366] hover:bg-[#20ba5a] text-white font-black px-3 py-1.5 rounded-lg transition-transform active:scale-95 shadow-sm font-sans"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white stroke-none" />
                        WhatsApp পাঠান
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* -------------------- TAB 2: EMPLOYEES -------------------- */}
        {activeTab === 'employees' && (
          <div className="space-y-4" id="employees-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h4 className="text-[14px] font-black text-slate-800">
                  কর্মচারী ডিরেক্টরি ও বেতন বিবরণী
                </h4>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingEmployeeId(null);
                      setEmployeeForm({
                        employeeId: `EMP00${employees.length + 1}`,
                        name: '',
                        designation: '',
                        basicSalary: 15000,
                        overtimeHours: 0,
                        otherAllowance: 0,
                        phone: '',
                        status: 'Pending'
                      });
                      setShowAddModal(true);
                    }}
                    className="flex items-center gap-1 bg-[#e6f7f4] border border-[#00a884]/40 hover:bg-[#cbfef4] text-[#00a884] text-xs font-black px-3 py-1.5 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    নতুন কর্মচারী
                  </button>
                </div>
              </div>

              {/* Reset & Clear Options */}
              <div className="mb-4 bg-amber-50/50 border border-amber-500/10 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600">বেতন চক্র পুনরায় রিসেট করুন বা ডেমো সাফ করুনঃ</span>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={triggerResetStatus}
                    className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white text-[10.5px] font-black px-3 py-1.5 rounded-lg transition-transform active:scale-95 shrink-0"
                  >
                    স্ট্যাটাস পেন্ডিং করুন
                  </button>
                  <button 
                    onClick={handleClearAllEmployees}
                    className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white text-[10.5px] font-black px-3 py-1.5 rounded-lg transition-transform active:scale-95 shrink-0"
                  >
                    সব ডিলিট করুন (সাফ)
                  </button>
                </div>
              </div>

              {/* Employee table/grid with delete/edit triggers */}
              <div className="space-y-2">
                {employees.map((emp, idx) => {
                  const overtimeVal = emp.overtimeHours * config.overtimeRate;
                  const total = emp.basicSalary + overtimeVal + emp.otherAllowance;

                  return (
                    <div 
                      key={`${emp.id || idx}-${idx}`}
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-3xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00a884]/10 text-[#00a884] flex items-center justify-center font-black text-xs shrink-0">
                          {emp.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-[13.5px]">{emp.name}</span>
                            <span className="text-[9.5px] font-black text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded leading-none">
                              {emp.employeeId}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {emp.designation} • মোবাইলঃ {emp.phone}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                            <span>বেসিকঃ <strong className="text-slate-800 font-extrabold">৳{formatMoney(emp.basicSalary)}</strong></span>
                            <span>ওভারটাইমঃ <strong className="text-slate-800 font-extrabold">{emp.overtimeHours} ঘণ্টা (৳{formatMoney(overtimeVal)})</strong></span>
                            <span>ভাতাঃ <strong className="text-slate-800 font-extrabold">৳{formatMoney(emp.otherAllowance)}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action side */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">মোট পাওনা</span>
                          <span className="text-[14px] font-black text-[#00a884]">৳ {formatMoney(total)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleEditClick(emp)}
                            className="w-7 h-7 bg-white hover:bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 transition-all active:scale-90"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(emp.id)}
                            className="w-7 h-7 bg-white hover:bg-red-50 rounded-full border border-slate-200 flex items-center justify-center text-red-500 hover:border-red-200 transition-all active:scale-90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* -------------------- TAB 3: PAY PAYMENT -------------------- */}
        {activeTab === 'payment' && (
          <div className="space-y-4" id="payment-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h4 className="text-[14px] font-black text-slate-800 mb-2">
                বেতন বিতরণ পেমেন্ট গেটওয়ে
              </h4>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                আপনার প্রতিষ্ঠানের মোট {totalEmployees} জন কর্মচারীর মধ্যে পেন্ডিং থাকা সকল কর্মচারীর মাসিক স্যালারি পেমেন্ট এক ক্লিকে সরাসরি আপনার AMB ওয়ালেট থেকে পরিশোধ করুন।
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3.5 mb-4">
                <div className="flex justify-between items-center text-[12px] text-slate-600">
                  <span>মোট পেন্ডিং কর্মচারীঃ</span>
                  <span className="font-extrabold text-slate-800">{pendingEmployeesCount} জন (সর্বমোট: {totalEmployees} জন)</span>
                </div>
                <div className="flex justify-between items-center text-[12px] text-slate-600">
                  <span>পেন্ডিং পেমেন্ট অ্যামাউন্টঃ</span>
                  <span className="font-black text-slate-800 text-[14.5px]">৳ {formatMoney(totalPendingSalary)}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] text-[#00a884]">
                  <span>আপনার কারেন্ট ওয়ালেট ব্যালেন্সঃ</span>
                  <span className="font-black text-[14.5px]">৳ {formatMoney(user?.balance || 0)}</span>
                </div>

                <div className="border-t border-slate-200 pt-3"></div>

                <div className="flex justify-between items-center text-[13px] font-black text-slate-800">
                  <span>সর্বমোট প্রদেয় (পেন্ডিং স্যালারি)ঃ</span>
                  <span className="text-[#00a884] text-[16px]">৳ {formatMoney(totalPendingSalary)}</span>
                </div>
              </div>

              {pendingEmployeesCount === 0 ? (
                <div className="bg-[#e6f7f4] border border-[#00a884]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#00a884] mx-auto mb-2" />
                  <p className="text-[12.5px] font-black text-slate-800">এই মাসের সকল কর্মচারীর বেতন সফলভাবে পরিশোধিত!</p>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-3 text-[#00a884] text-xs font-black underline"
                  >
                    ড্যাশবোর্ডে ফিরে যান
                  </button>
                </div>
              ) : (
                <div className="space-y-3" id="salary-payment-form">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-600">
                        4-ডিজিট সিকিউরিটি পিন (Security PIN) নিশ্চিত করুন *
                      </label>
                      <span className="text-[10px] font-black text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded border border-[#00a884]/20 animate-pulse">
                        আপনার পিনঃ {user?.pin || '1234'}
                      </span>
                    </div>
                    <input 
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 4-digit PIN"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-center font-bold tracking-[0.5em] text-slate-800 text-lg focus:outline-none focus:border-[#00a884] transition-all"
                    />
                  </div>

                  {pinError && (
                    <p className="text-[11px] font-bold text-red-500 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {pinError}
                    </p>
                  )}

                  <button 
                    onClick={handleProcessPayment}
                    disabled={processingPayment || pin.length < 4}
                    className="w-full bg-[#00a884] hover:bg-[#05c39b] disabled:bg-slate-300 text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                  >
                    {processingPayment ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Check className="w-5 h-5 stroke-[2.5]" />
                        বেতন পেমেন্ট কনফার্ম করুন
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* -------------------- TAB 4: REPORTS -------------------- */}
        {activeTab === 'reports' && (
          <div className="space-y-4" id="reports-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h4 className="text-[14px] font-black text-slate-800 mb-3">
                বেতন বিতরণ রিপোর্ট ও হিস্ট্রি
              </h4>

              <div className="border border-slate-150 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-150 text-[11px] font-black text-slate-500">
                  ডিসবার্সমেন্ট হিস্ট্রি
                </div>
                <div className="divide-y divide-slate-100 text-[12px] text-slate-700">
                  {paymentHistory.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 font-bold">
                      কোনো পেমেন্ট হিস্ট্রি পাওয়া যায়নি। প্রথম বেতন পরিশোধ করার পর এখানে ইতিহাস দেখা যাবে।
                    </div>
                  ) : (
                    paymentHistory.map((hist, idx) => (
                      <div key={`${hist.id || hist.createdAt || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-black text-slate-800 block">{hist.companyName || config.companyName} - বেতন বিতরণ</span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5 block">
                            তারিখঃ {hist.payDate} • পেমেন্ট সময়ঃ {hist.payTime} • স্টাফঃ {hist.totalEmployees || 0} জন
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-[#00a884] text-[13.5px] block">৳ {formatMoney(hist.amountPaid || 0)}</span>
                          <span className="text-[9.5px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            সফলভাবে প্রেরিত
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* -------------------- TAB 5: SETTINGS -------------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-4" id="settings-tab-content">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h4 className="text-[14px] font-black text-slate-800 mb-3">
                কোম্পানি ও ওভারটাইম সেটিংস
              </h4>

              <form onSubmit={handleSaveConfig} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    প্রতিষ্ঠানের নাম (Company Name) *
                  </label>
                  <input 
                    type="text"
                    required
                    value={config.companyName}
                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-800 text-[13px] focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    কোম্পানি আইডি (Company ID) *
                  </label>
                  <input 
                    type="text"
                    required
                    value={config.companyId}
                    onChange={(e) => setConfig({ ...config, companyId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-800 text-[13px] focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      ওভারটাইম প্রতি ঘণ্টা রেট (৳) *
                    </label>
                    <input 
                      type="number"
                      required
                      value={config.overtimeRate}
                      onChange={(e) => setConfig({ ...config, overtimeRate: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-800 text-[13px] focus:outline-none focus:border-[#00a884] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      স্যালারি পে ডেট *
                    </label>
                    <input 
                      type="text"
                      required
                      value={config.payDate}
                      onChange={(e) => setConfig({ ...config, payDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-800 text-[13px] focus:outline-none focus:border-[#00a884] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    পেমেন্ট ডেলিভারি সময় (Time) *
                  </label>
                  <input 
                    type="text"
                    required
                    value={config.payTime}
                    onChange={(e) => setConfig({ ...config, payTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-800 text-[13px] focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-[#00a884] hover:bg-[#05c39b] text-white font-black py-3 rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  সেটিংস সেভ করুন
                </button>
              </form>

            </div>
          </div>
        )}

      </div>

      {/* -------------------- MODAL: ADD/EDIT EMPLOYEE -------------------- */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4 font-sans overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md p-5 shadow-xl relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-black text-slate-800 mb-4 border-b border-slate-50 pb-2">
                {editingEmployeeId ? 'কর্মচারী তথ্য পরিবর্তন' : 'নতুন কর্মচারী নিবন্ধন'}
              </h3>

              <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-left text-[12.5px]">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    কর্মচারী আইডি (Employee ID) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. EMP005"
                    value={employeeForm.employeeId}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    পূর্ণ নাম (Employee Name) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. রাকিবুল ইসলাম"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    পদবি (Designation) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. সেলস এক্সিকিউটিভ"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      মাসিক বেসিক বেতন (৳) *
                    </label>
                    <input 
                      type="number"
                      required
                      placeholder="e.g. 25000"
                      value={employeeForm.basicSalary || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, basicSalary: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      ওভারটাইম সময় (ঘণ্টা)
                    </label>
                    <input 
                      type="number"
                      placeholder="e.g. 10"
                      value={employeeForm.overtimeHours || ''}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, overtimeHours: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    অন্যান্য বোনাস/ভাতা (৳)
                  </label>
                  <input 
                    type="number"
                    placeholder="e.g. 1500"
                    value={employeeForm.otherAllowance || ''}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, otherAllowance: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    মোবাইল নম্বর (WhatsApp) *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 01712345678"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-[#00a884] font-bold"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-2.5 rounded-xl transition-all"
                  >
                    বন্ধ করুন
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#00a884] hover:bg-[#05c39b] text-white font-black py-2.5 rounded-xl transition-all shadow-md"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
