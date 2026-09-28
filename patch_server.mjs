import fs from 'fs';

const serverCode = fs.readFileSync('server.ts', 'utf8');

// The new function string
const helperFn = `
// ==========================================
// Centralized Idempotent Payment Processor
// ==========================================
async function processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, rawVerifyData) {
  if (!db) throw new Error('database_disconnected');
  if (!verifiedUserId) throw new Error('user_not_found_in_verification');
  
  const depositAmount = parseFloat(verifiedAmount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const txDocRef = doc(db, 'transactions', \`NP_\${transaction_id}\`);
  const userDocRef = doc(db, 'users', verifiedUserId);

  return await runTransaction(db, async (t) => {
    // 1. Idempotency Check
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      return { alreadyProcessed: true, amount: txSnap.data().amount };
    }

    // 2. Fetch User Data
    const userDoc = await t.get(userDocRef);
    if (!userDoc.exists()) {
      throw new Error('user_not_found');
    }

    const userData = userDoc.data();
    const currentBalance = Number(userData.balance) || 0;
    const currentMainBalance = Number(userData.mainBalance) || 0;
    
    // 3. Calculate New Balances
    const newBalance = currentBalance + depositAmount;
    const newMainBalance = currentMainBalance + depositAmount;
    
    // 4. Update User
    t.update(userDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance
    });

    // 5. Create Transaction Record
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: verifiedUserId,
      userName: userData.name || 'Anonymous User',
      userPhone: userData.phone || '',
      memberId: userData.memberId || 'BNB000000',
      amount: depositAmount,
      type: 'add_money',
      status: 'success',
      paymentMethod: 'NagorikPay Gateway',
      phone: userData.phone || '',
      senderPhone: userData.phone || '',
      senderInfo: 'NagorikPay Gateway',
      accountNumber: userData.phone || '',
      trxId: transaction_id,
      transactionId: transaction_id,
      receiptNo: transaction_id,
      createdAt: new Date().toISOString(),
      description: \`NagorikPay পেমেন্ট গেটওয়ের মাধ্যমে ৳\${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।\`
    });

    // 6. Send Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: verifiedUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: \`নাগরিকপে গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳\${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।\`,
      message: \`নাগরিকপে গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳\${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।\`,
      screen: 'wallet',
      createdAt: new Date().toISOString(),
      read: false
    });

    return { alreadyProcessed: false, newBalance, amount: depositAmount };
  });
}
`;

// Find where to insert it (just before the startServer function)
const startServerIndex = serverCode.indexOf('async function startServer()');
let newCode = serverCode.substring(0, startServerIndex) + helperFn + '\n' + serverCode.substring(startServerIndex);

// Now rewrite the callback
const callbackRegex = /app\.all\('\/api\/payment\/nagorikpay-callback'.*?app\.all\('\/api\/payment\/nagorikpay-cancel'/s;
const newCallback = `app.all('/api/payment/nagorikpay-callback', async (req, res) => {
    try {
      const db = getDb();
      const transaction_id = req.query.transaction_id || req.body.transaction_id || req.query.invoice_id || req.body.invoice_id;
      
      if (!transaction_id) {
        console.error('No transaction_id provided in callback');
        return res.redirect('/?payment_status=failed&error=missing_transaction_id');
      }

      // Verify with NagorikPay
      const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
          'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
        },
        body: JSON.stringify({ transaction_id })
      });

      const verifyData: any = await verifyResponse.json();
      console.log('NagorikPay callback verification API response:', JSON.stringify(verifyData));

      const statusUpper = String(verifyData?.status || '').toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === 'true' || statusUpper === 'TRUE' || statusUpper === 'SUCCESS' || statusUpper === 'APPROVED';

      if (!isVerified) {
        console.error('NagorikPay transaction verification failed:', verifyData);
        return res.redirect(\`/?payment_status=failed&error=verification_failed\`);
      }

      // Extract verified details strictly from gateway response (NOT url)
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount;

      // If missing, we MUST fail according to the strict rule (No guessing from URL)
      if (!verifiedUserId || !verifiedAmount) {
         console.error('CRITICAL: verifyData missing userId or amount!', verifyData);
         return res.redirect(\`/?payment_status=failed&error=missing_verification_metadata\`);
      }

      try {
        const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
        
        if (txResult.alreadyProcessed) {
          console.log(\`Transaction \${transaction_id} already processed via callback. Idempotency protected.\`);
        } else {
          console.log(\`Callback successfully credited user \${verifiedUserId} with ৳\${txResult.amount}. New Balance: ৳\${txResult.newBalance}\`);
        }
        return res.redirect(\`/?payment_status=success&amount=\${txResult.amount}\`);
      } catch (err: any) {
        console.error('Error processing callback payment:', err.message);
        return res.redirect(\`/?payment_status=failed&error=\${encodeURIComponent(err.message || 'processing_failed')}\`);
      }

    } catch (error: any) {
      console.error('Error in /api/payment/nagorikpay-callback:', error);
      return res.redirect(\`/?payment_status=failed&error=\${encodeURIComponent(error.message || 'callback_error')}\`);
    }
  });

  // 3. NagorikPay Cancel Callback Endpoint
  app.all('/api/payment/nagorikpay-cancel'`;

newCode = newCode.replace(callbackRegex, newCallback);

// Now rewrite the webhook
const webhookRegex = /app\.post\('\/api\/payment\/nagorikpay-webhook'.*?\}\);/s;
const newWebhook = `app.post('/api/payment/nagorikpay-webhook', async (req, res) => {
    console.log('NagorikPay payment webhook received:', req.body);
    try {
      const db = getDb();
      // NagorikPay webhook might send transaction_id directly in the body
      const transaction_id = req.body.transaction_id || req.body.invoice_id || req.body.trx_id;

      if (!transaction_id) {
         return res.status(400).json({ error: 'missing_transaction_id' });
      }

      // Verify with NagorikPay (always re-verify webhook payloads to avoid spoofing)
      const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
          'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
        },
        body: JSON.stringify({ transaction_id })
      });

      const verifyData: any = await verifyResponse.json();
      console.log('NagorikPay webhook verification API response:', JSON.stringify(verifyData));

      const statusUpper = String(verifyData?.status || '').toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === 'true' || statusUpper === 'TRUE' || statusUpper === 'SUCCESS' || statusUpper === 'APPROVED';

      if (!isVerified) {
        return res.status(400).json({ error: 'verification_failed' });
      }

      // Extract verified details strictly from gateway response
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount;

      if (!verifiedUserId || !verifiedAmount) {
         return res.status(400).json({ error: 'missing_verification_metadata', verifyData });
      }

      const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
      
      if (txResult.alreadyProcessed) {
        console.log(\`Webhook ignored transaction \${transaction_id} as it was already processed.\`);
      } else {
        console.log(\`Webhook successfully credited user \${verifiedUserId} with ৳\${txResult.amount}.\`);
      }
      
      return res.status(200).json({ received: true, status: 'processed', transaction_id });
    } catch (err: any) {
      console.error('Error processing webhook payment:', err);
      return res.status(500).json({ error: err.message });
    }
  });`;

newCode = newCode.replace(webhookRegex, newWebhook);

fs.writeFileSync('server.ts', newCode);
console.log("Successfully patched server.ts");
