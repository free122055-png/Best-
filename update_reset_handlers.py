with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_handlers = """  const handleApproveAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id;
    if (!targetUid) {
      requestAlert('ত্রুটি', 'ইউজার আইডি ডাটাবেজে পাওয়া যায়নি!');
      return;
    }

    setUsers(prev => prev.map(u => (u.uid === targetUid || u.id === targetUid) ? {
      ...u,
      isAppLocked: false,
      appLockResetRequested: false,
      appLockResetStatus: 'approved'
    } : u));

    if (editingUser && (editingUser.uid === targetUid || editingUser.id === targetUid)) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false } : null);
    }

    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        isAppLocked: false,
        appLockResetRequested: false,
        appLockResetStatus: 'approved'
      });

      const reqRef = doc(db, 'app_lock_requests', targetUid);
      await setDoc(reqRef, { status: 'approved' }, { merge: true }).catch(() => {});

      // Send automated notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUid,
        title: '🔒 অ্যাপ লক আনলক এপ্রুভ করা হয়েছে',
        message: 'এডমিন কর্তৃক আপনার অ্যাপ লক সফলভাবে আনলক করা হয়েছে। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
        createdAt: new Date().toISOString(),
        read: false,
        type: 'security'
      }).catch(() => {});

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সফলভাবে আনলক করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error approving app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAdminInstantUnlockUser = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId;
    if (!targetUid) {
      requestAlert('ত্রুটি', 'ইউজার আইডি ডাটাবেজে পাওয়া যায়নি!');
      return;
    }

    setUsers(prev => prev.map(u => (u.uid === targetUid || u.id === targetUid) ? {
      ...u,
      isAppLocked: false,
      appLockResetRequested: false,
      appLockResetStatus: 'approved'
    } : u));

    if (editingUser && (editingUser.uid === targetUid || editingUser.id === targetUid)) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false } : null);
    }

    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        isAppLocked: false,
        appLockResetRequested: false,
        appLockResetStatus: 'approved'
      });

      const reqRef = doc(db, 'app_lock_requests', targetUid);
      await setDoc(reqRef, { status: 'approved' }, { merge: true }).catch(() => {});

      // Send automated notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUid,
        title: '🔓 এডমিন কর্তৃক অ্যাপ লক আনলক করা হয়েছে',
        message: 'এডমিন আপনার অ্যাকাউন্টের গোপন সিকিউরিটি লক তাৎক্ষণিকভাবে খুলে দিয়েছেন। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
        createdAt: new Date().toISOString(),
        read: false,
        type: 'security'
      }).catch(() => {});

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সফলভাবে আনলক করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error instant unlocking user:", err);
      requestAlert('ত্রুটি', 'আনলক করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleRejectAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id;
    if (!targetUid) return;

    setUsers(prev => prev.map(u => (u.uid === targetUid || u.id === targetUid) ? {
      ...u,
      appLockResetRequested: false,
      appLockResetStatus: 'rejected'
    } : u));

    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        appLockResetRequested: false,
        appLockResetStatus: 'rejected'
      });

      const reqRef = doc(db, 'app_lock_requests', targetUid);
      await setDoc(reqRef, { status: 'rejected' }, { merge: true }).catch(() => {});

      requestAlert('সফল', `সদস্য ${targetUser.name || ''}-এর আনলক রিকোয়েস্ট বাতিল করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error rejecting app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };"""

new_handlers = """  const handleApproveAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    // 1. Optimistic UI update across all possible identifiers
    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any,
          pin: '1234',
          appLockCode: ''
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false, pin: '1234', appLockCode: '' } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any,
          pin: '1234',
          appLockCode: '',
          appLockResetApprovedAt: new Date().toISOString()
        }).catch(async () => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                isAppLocked: false,
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'approved',
                pin: '1234',
                appLockCode: ''
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'approved', approvedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } else if (targetPhone) {
        const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
        const snap = await getDocs(qP);
        for (const d of snap.docs) {
          await updateDoc(d.ref, {
            isAppLocked: false,
            appLockResetRequested: false,
            forgotPinRequested: false,
            pinResetRequested: false,
            appLockResetStatus: 'approved',
            pin: '1234',
            appLockCode: ''
          });
        }
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'approved', approvedAt: new Date().toISOString() }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '🔒 অ্যাপ লক আনলক এপ্রুভ করা হয়েছে',
          message: 'এডমিন কর্তৃক আপনার অ্যাপ লক সফলভাবে আনলক করা হয়েছে এবং ডিফল্ট পিন ১২৩৪ সেট করা হয়েছে। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সফলভাবে আনলক করা হয়েছে (ডিফল্ট পিন: ১২৩৪)!`);
    } catch (err: any) {
      console.error("Error approving app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleAdminInstantUnlockUser = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditIsAppLocked(false);
      setEditingUser(prev => prev ? { ...prev, isAppLocked: false, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          isAppLocked: false,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'approved',
          appLockResetRequestedAt: null as any
        }).catch(async () => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                isAppLocked: false,
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'approved'
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'approved' }, { merge: true }).catch(() => {});
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'approved' }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '🔓 এডমিন কর্তৃক অ্যাপ লক আনলক করা হয়েছে',
          message: 'এডমিন আপনার অ্যাকাউন্টের গোপন সিকিউরিটি লক তাৎক্ষণিকভাবে খুলে দিয়েছেন। এখন আপনি সরাসরি অ্যাপে প্রবেশ করতে পারবেন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর অ্যাপ লক সরাসরি আনলক করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error instant unlocking user:", err);
      requestAlert('ত্রুটি', 'আনলক করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const handleRejectAppLockReset = async (targetUser: User) => {
    const targetUid = targetUser.uid || (targetUser as any).id || (targetUser as any).docId || (targetUser as any)._id;
    const targetPhone = targetUser.phone;

    // 1. Optimistic UI update across all possible identifiers immediately
    setUsers(prev => prev.map(u => {
      const match = (targetUid && (u.uid === targetUid || u.id === targetUid || (u as any).docId === targetUid)) ||
                    (targetPhone && u.phone === targetPhone);
      if (match) {
        return {
          ...u,
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'rejected',
          appLockResetRequestedAt: null as any
        };
      }
      return u;
    }));

    if (editingUser && ((targetUid && (editingUser.uid === targetUid || editingUser.id === targetUid)) || (targetPhone && editingUser.phone === targetPhone))) {
      setEditingUser(prev => prev ? { ...prev, appLockResetRequested: false, forgotPinRequested: false, pinResetRequested: false, appLockResetStatus: 'rejected', appLockResetRequestedAt: null as any } : null);
    }

    try {
      if (targetUid) {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          appLockResetRequested: false,
          forgotPinRequested: false,
          pinResetRequested: false,
          appLockResetStatus: 'rejected',
          appLockResetRequestedAt: null as any,
          appLockResetRejectedAt: new Date().toISOString()
        }).catch(async (e) => {
          if (targetPhone) {
            const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
            const snap = await getDocs(qP);
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                appLockResetRequested: false,
                forgotPinRequested: false,
                pinResetRequested: false,
                appLockResetStatus: 'rejected',
                appLockResetRequestedAt: null as any
              });
            }
          }
        });

        const reqRef = doc(db, 'app_lock_requests', targetUid);
        await setDoc(reqRef, { status: 'rejected', rejectedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      } else if (targetPhone) {
        const qP = query(collection(db, 'users'), where('phone', '==', targetPhone));
        const snap = await getDocs(qP);
        for (const d of snap.docs) {
          await updateDoc(d.ref, {
            appLockResetRequested: false,
            forgotPinRequested: false,
            pinResetRequested: false,
            appLockResetStatus: 'rejected',
            appLockResetRequestedAt: null as any
          });
        }
      }

      if (targetPhone) {
        const qReq = query(collection(db, 'app_lock_requests'), where('phone', '==', targetPhone));
        const snapReq = await getDocs(qReq).catch(() => null);
        if (snapReq) {
          for (const d of snapReq.docs) {
            await updateDoc(d.ref, { status: 'rejected', rejectedAt: new Date().toISOString() }).catch(() => {});
          }
        }
      }

      if (targetUid) {
        await addDoc(collection(db, 'user_notifications'), {
          userId: targetUid,
          title: '❌ অ্যাপ লক রিসেট বাতিল',
          message: 'এডমিন কর্তৃক আপনার অ্যাপ লক রিসেট রিকোয়েস্ট বাতিল করা হয়েছে। প্রয়োজনে সঠিক পিন দিয়ে আনলক করুন বা হেল্পলাইনে যোগাযোগ করুন।',
          createdAt: new Date().toISOString(),
          read: false,
          type: 'security'
        }).catch(() => {});
      }

      requestAlert('সফল', `সদস্য ${targetUser.name || targetUser.phone || ''}-এর আনলক রিকোয়েস্ট সফলভাবে বাতিল করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error rejecting app lock reset:", err);
      requestAlert('ত্রুটি', 'স্টেটাস আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    }
  };"""

if old_handlers in text:
    text = text.replace(old_handlers, new_handlers, 1)
    with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated reset handlers successfully!")
else:
    print("Could not match old_handlers!")
