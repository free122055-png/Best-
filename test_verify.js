const fetch = require('node-fetch'); // or use built-in fetch if Node >= 18
async function run() {
  const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
      'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
    },
    body: JSON.stringify({ transaction_id: 'MOCK_1234' })
  });
  const data = await verifyResponse.json();
  console.log(data);
}
run();
