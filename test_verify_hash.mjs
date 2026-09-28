import fetch from 'node-fetch';

async function run() {
  const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
      'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
    },
    body: JSON.stringify({ transaction_id: 'e6fa8d32a3b44f256c4fea0c389e47ee' })
  });
  const data = await verifyResponse.json();
  console.log("Verify Response:", data);
}
run();
