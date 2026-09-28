import { db } from './firebase';
import { doc, getDoc, getDocFromServer, updateDoc, increment } from 'firebase/firestore';

export async function handleUserUsage(userId: string) {
  const userRef = doc(db, 'users', userId);
  
  // 1. Fetch fresh data directly from server to avoid stale cache
  let userSnap;
  try {
    userSnap = await getDocFromServer(userRef);
  } catch (err) {
    console.warn("Failed to fetch from server, falling back to cache:", err);
    userSnap = await getDoc(userRef);
  }
  
  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  const userData = userSnap.data();
  console.log("Current user data:", userData);
  
  const isPro = userData.isPro === true || userData.isPro === 'true'; // Account for string variations
  const usageCount = Number(userData.usageCount) || 0;
  const limit = Number(userData.limit) || 5;

  console.log(`Checking usage - isPro: ${isPro}, usageCount: ${usageCount}, limit: ${limit}`);

  // 3. Unlimited use if isPro = true
  if (isPro) {
    console.log('User is PRO, unlimited access granted.');
    // Optional: Still increment usage for analytics, or just return true
    await updateDoc(userRef, {
      usageCount: increment(1)
    });
    return true; 
  }

  // 2. Block if usageCount >= limit
  if (usageCount >= limit) {
    console.log('Usage limit reached. Blocked.');
    return false; // Block user
  }

  // 1. Increase usageCount if not blocked
  await updateDoc(userRef, {
    usageCount: increment(1)
  });
  console.log('Usage allowed and incremented.');
  
  return true;
}

export async function handlePaymentSuccess(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Payment success update isPro = true
    await updateDoc(userRef, {
      isPro: true
    });
    
    console.log(`Payment success for ${userId}. isPro set to true.`);
    
    // Fetch fresh data from server to verify
    const verifySnap = await getDocFromServer(userRef);
    console.log("Verified fresh data after payment:", verifySnap.data());
    
    return true;
  } catch (error) {
    console.error("Error updating pro status:", error);
    return false;
  }
}

