import fetch from 'node-fetch';

async function run() {
  const payload = {
    amount: 10,
    userId: "admin_master",
    phone: "01700000000"
  };
  const res = await fetch('http://localhost:3000/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("Create Response:", data);
}
run();
