const fs = require('fs');

let c = fs.readFileSync('src/components/SamityScreen.tsx', 'utf8');

const withdraw_target = "      await addDoc(collection(db, 'transactions'), newTx);\n      setFormSuccess('আপনার সমবায় সঞ্চয় উত্তোলনের আবেদনটি সফলভাবে জমা দেওয়া হয়েছে!";
const withdraw_replacement = `      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '💸 নতুন সমবায় সঞ্চয় উত্তোলন আবেদন',
        message: \`\${user.name || 'সদস্য'} (\${user.memberId || 'N/A'}) সমবায় সঞ্চয় ফান্ড হতে ৳\${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন করেছেন।\`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'samity_withdraw',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      setFormSuccess('আপনার সমবায় সঞ্চয় উত্তোলনের আবেদনটি সফলভাবে জমা দেওয়া হয়েছে!`;

if (c.includes(withdraw_target)) {
  c = c.replace(withdraw_target, withdraw_replacement);
  console.log('Replaced withdraw admin notification');
}

const loan_target = "      await addDoc(collection(db, 'transactions'), newTx);\n      setFormSuccess('সফল! আপনার সমবায় লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে।";
const loan_replacement = `      await addDoc(collection(db, 'transactions'), newTx);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন সমবায় লোন আবেদন',
        message: \`\${user.name || 'সদস্য'} (\${user.memberId || 'N/A'}) ৳\${amt.toLocaleString('bn-BD')} টাকা সমবায় লোন আবেদন করেছেন (উদ্দেশ্য: \${loanApplyPurpose})।\`,
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        userPhone: user.phone || '',
        amount: amt,
        type: 'samity_loan_apply',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      setFormSuccess('সফল! আপনার সমবায় লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে।`;

if (c.includes(loan_target)) {
  c = c.replace(loan_target, loan_replacement);
  console.log('Replaced loan admin notification');
}

c = c.replace('AMB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর নীতি অনুযায়ী', 'BNB কোম্পানি ইনভেস্টর নীতি অনুযায়ী');

fs.writeFileSync('src/components/SamityScreen.tsx', c, 'utf8');
console.log('Done!');
