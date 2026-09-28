# Admin Panel Design and Development Guidelines (এডমিন প্যানেল তৈরির সম্পূর্ণ নির্দেশনা)

This file contains the strict guidelines and instructions from the system owner regarding the architecture, behavior, and visual layout of the Admin Panel. These rules are automatically loaded by the AI system and must be strictly followed on every single turn.

---

## ১. হুবহু লেআউট ও ডিজাইন বজায় রাখা (Exact Replica Layout & Design)
- **বাংলা:** বর্তমান সদস্যদের অ্যাপে মোট ১২টি সেকশন রয়েছে। Admin Panel-এও একই ১২টি সেকশন, হুবহু একই ডিজাইন, একই Layout, একই Button, একই Workflow এবং একই নিয়ম বজায় থাকবে। কোনো Section, Design বা Function পরিবর্তন করা যাবে না। অর্থাৎ সদস্যদের অ্যাপের হুবহু একটি Admin Version তৈরি করতে হবে।
- **English:** The members' app currently contains exactly 12 sections. The Admin Panel must preserve the exact same 12 sections, identical design, identical layout, buttons, workflows, and rules. No section, design component, or core function should be modified or simplified. It must be a faithful replica of the members' app tailored for administrative capabilities.

---

## ২. পারমিশন ও ফুল কন্ট্রোল (Permission & Full Administrative Control)
- **বাংলা:** মূল পার্থক্য শুধু Permission-এ হবে। সাধারণ সদস্যরা শুধুমাত্র অনুমোদিত কাজগুলো করতে পারবে। কিন্তু Admin ১২টি সেকশনের প্রতিটিতে সব তথ্য, লেখা, সেটিংস, ব্যালেন্স, নিয়ম ও কনটেন্ট Add, Edit, Update এবং Delete করতে পারবে।
- **English:** The core difference lies strictly in access permissions. Members can only interact based on standard roles. Meanwhile, the Admin has full read/write privileges (Add, Edit, Update, and Delete) over all texts, settings, balances, rules, notices, banners, and product/service catalogs across all 12 sections.

---

## ৩. রিয়েল-টাইম সিঙ্ক ও অটোমেটিক নোটিফিকেশন (Real-Time Sync & Automated Notifications)
- **বাংলা:** Admin যেকোনো সেকশনে কোনো গুরুত্বপূর্ণ পরিবর্তন করে Submit করার সঙ্গে সঙ্গে সেই পরিবর্তন সদস্যদের অ্যাপে রিয়েল-টাইমে অটোমেটিক আপডেট হবে। যদি পরিবর্তনটি সদস্যকে প্রভাবিত করে (যেমন: ব্যালেন্সে টাকা যোগ/কর্তন, নাম পরিবর্তন, NID পরিবর্তন, মোবাইল নম্বর পরিবর্তন বা অন্য কোনো গুরুত্বপূর্ণ তথ্য), তাহলে সদস্যের অ্যাপে অটোমেটিক Notification যাবে এবং হোম স্ক্রিনের উপরের ডান পাশে থাকা Notification-এ দেখা যাবে। একই সঙ্গে সব পরিবর্তন Activity Log/Transaction History-তে স্বয়ংক্রিয়ভাবে সংরক্ষণ হবে।
- **English:** Any changes submitted by the Admin must sync in real-time with the members' app. If a modification directly affects a member (e.g., wallet balance add/deduct, name changes, NID updates, phone number corrections, or status changes), an automated notification must immediately be dispatched to that user's inbox (visible via the top-right notification bell icon on their home screen). Simultaneously, the event must be logged under Transaction History and the Activity Log.

---

## ৪. কোরের ১২টি সার্ভিস সেকশন (Core 12 Service Sections to Preserve)
1. **BNB সমবায় / কোম্পানি পোর্টাল (BNB Management Company Investor / Deposit & Savings)**
2. **BNB নিরাপদ লেনদেন / গ্রুপ বাই ডিল (BNB Safe Deals & Escrow)**
3. **BNB কর্জে হাসানা / সুদমুক্ত ঋণ (BNB Qard Hasana Welfare Fund)**
4. **BNB লেনদেন / রেমিট্যান্স লাইভ (BNB Live Transactions & Remittance)**
5. **safi সাফি / ইন-হাউস ব্র্যান্ড (Safi Premium Brand Products)**
6. **BNB টেলিকম / রিচার্জ ও ড্রাইভ অফার (BNB Telecom Airtime & Packs)**
7. **BNB সুপার শপ / শপ অর্ডার (BNB Super Shop & Orders)**
8. **BNB রেশন কার্ড / ভর্তুকি মেম্বারশিপ (BNB Ration Card System)**
9. **BNB কুরিয়ার / পার্সেল ও লজিস্টিকস (BNB Instant Courier)**
10. **BNB এজেন্ট / ক্যারিয়ার ক্যারিয়ার (BNB Agent & Representative Portal)**
11. **BNB লক্ষ্যমাত্রা / কোম্পানি প্রোফাইল (BNB Target & Corporate Guide)**
12. **BNB বাংলাদেশ এডমিন প্যানেল (BNB Bangladesh National Gateway & Verification)**

---

## ৫. সততা ও আর্কিটেকচারাল ডিসিপ্লিন (Honesty & Architectural Discipline)
- **No Mock or Simulated Code:** Never write mock API layers or fake local variables for saved actions. Every save button must update the Firestore collections (`users`, `transactions`, `user_notifications`, `app_config`, etc.) in real-time.
- **Auto-Notifications on Balance Change:** Any balance adjustment (like our automatic add/deduct mechanism) must specify the precise reason (রিজেক্ট বা বোনাসের কারণ) and record it as Credit/Debit logs with real-time UI notifications.
