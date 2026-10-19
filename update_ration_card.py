with open('src/components/RationCardView.tsx', 'r') as f:
    code = f.read()

start_marker = '  // Reusable 100% accurate visual representation of the Digital Ration Card'
end_marker = '  const rationItems: RationItem[]'

start_pos = code.find(start_marker)
end_pos = code.find(end_marker, start_pos)

new_func = """  // Reusable 100% accurate visual representation of the Digital Ration Card
  const renderBeautifulRationCard = (rcData: any, scaleClass = "") => {
    const cNo = rcData?.cardNo || liveUser?.memberId || 'BNB00000001';
    
    const cardType = rcData?.cardType || previewCardType || 'green_white';
    
    // Theme mapping for 4 color variations
    const isRed = cardType === 'red_white' || cardType === 'red';
    const isBlue = cardType === 'blue_white' || cardType === 'blue';
    const isGreen = cardType === 'green_white' || cardType === 'green' || (!isRed && !isBlue && !cardType);
    const isBlack = cardType === 'black_white' || cardType === 'black';

    let mainColorHex = "#006A4E"; // Default Green (#006A4E) from official mockup

    if (isRed) {
      mainColorHex = "#DC2626";
    } else if (isBlue) {
      mainColorHex = "#2563EB";
    } else if (isGreen) {
      mainColorHex = "#006A4E";
    } else if (isBlack) {
      mainColorHex = "#1E293B";
    }

    const mainColorClean = mainColorHex.replace('#', '');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=${mainColorClean}&data=${encodeURIComponent(`https://businessnetworkbangladesh.com/verify-ration?id=${cNo}`)}`;
    
    return (
      <RationCardContainer>
        {/* Interactive Color Switcher Controls - Red, Green, Blue, Black */}
        <div className="mb-3 flex justify-center items-center gap-2 px-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-black text-slate-700 mr-1 shrink-0 flex items-center gap-1">
            <span>🎨</span>
            <span>কার্ড কালারঃ</span>
          </span>
          {[
            { id: 'green_white', label: 'সবুজ', color: 'bg-[#006A4E]', ring: 'ring-[#006A4E]' },
            { id: 'red_white', label: 'লাল', color: 'bg-red-600', ring: 'ring-red-500' },
            { id: 'blue_white', label: 'নীল', color: 'bg-blue-600', ring: 'ring-blue-500' },
            { id: 'black_white', label: 'সাদা-কালো', color: 'bg-slate-800', ring: 'ring-slate-700' }
          ].map((ct) => {
            const isActive = (previewCardType === ct.id) || (isGreen && ct.id === 'green_white') || (isRed && ct.id === 'red_white') || (isBlue && ct.id === 'blue_white') || (isBlack && ct.id === 'black_white');
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => setPreviewCardType(ct.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white scale-105 ring-2 ' + ct.ring
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${ct.color}`} />
                <span>{ct.label}</span>
              </button>
            );
          })}
        </div>

        {/* Printable Digital Ration Card Canvas (720x405) */}
        <div 
          ref={cardRef}
          id="bnb-ration-card-canvas"
          className={`w-[720px] h-[405px] text-zinc-900 rounded-[1.5rem] shadow-2xl overflow-hidden font-sans flex flex-col justify-between border-[5px] p-0 relative select-none bg-white ${scaleClass}`}
          style={{ borderColor: mainColorHex }}
        >
          {/* 1. Top Header */}
          <div className="flex flex-row justify-between items-center px-6 py-3.5 border-b border-slate-100/80 bg-white">
            {/* Left: App Logo + Title */}
            <div className="flex items-center gap-3">
              <div 
                className="w-13 h-13 rounded-2xl flex items-center justify-center shadow-xs shrink-0 overflow-hidden p-1.5" 
                style={{ backgroundColor: mainColorHex }}
              >
                <img 
                  src="/bnb_logo.png" 
                  alt="BNB Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="text-left font-sans">
                <h2 className="text-[26px] font-black leading-none tracking-tight" style={{ color: mainColorHex }}>
                  BNB
                </h2>
                <p className="text-[10px] text-slate-800 font-extrabold tracking-wider leading-none mt-1 uppercase">
                  BNB BUSINESS NETWORK BANGLADESH
                </p>
              </div>
            </div>
            
            {/* Right: Card Title + Tagline */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-[22px] font-black tracking-tight leading-none" style={{ color: mainColorHex }}>
                <span>BNB RATION CARD</span>
                <span className="text-lg">💎</span>
              </div>
              <p className="text-[11px] text-slate-600 font-extrabold mt-1">
                সবার জন্য পুষ্টিকর খাদ্য, সুস্থ ও সমৃদ্ধ আগামী
              </p>
            </div>
          </div>

          {/* 2. Middle Body Content */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center flex-1 bg-white">
            {/* Photo Column (Left) */}
            <div className="col-span-3 flex items-center justify-center">
              <div 
                className="w-[125px] h-[155px] border-2 rounded-[1.5rem] overflow-hidden flex flex-col items-center justify-center relative shadow-xs bg-slate-50 p-1" 
                style={{ borderColor: `${mainColorHex}40` }}
              >
                {rcData?.photoUrl || rcData?.photo || liveUser?.profilePic ? (
                  <img
                    src={rcData?.photoUrl || rcData?.photo || liveUser?.profilePic}
                    alt="Member"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-[1.25rem]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-30">
                    <User className="w-16 h-16" style={{ color: mainColorHex }} />
                  </div>
                )}
                <div 
                  className="absolute bottom-1 px-3 py-0.5 rounded-full text-[9.5px] font-black text-white leading-none shadow-xs" 
                  style={{ backgroundColor: mainColorHex }}
                >
                  সদস্য ফটো
                </div>
              </div>
            </div>

            {/* Member Details Column (Center) */}
            <div className="col-span-6 space-y-3 text-left pl-1">
              {/* Name */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs" 
                  style={{ backgroundColor: mainColorHex }}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold leading-none">নাম</p>
                  <p className="text-[15px] font-black leading-tight mt-0.5 text-slate-900 uppercase truncate">
                    {rcData?.userName || rcData?.name || liveUser?.name || 'MD RASEL MIA'}
                  </p>
                </div>
              </div>

              {/* Mobile */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs" 
                  style={{ backgroundColor: mainColorHex }}
                >
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold leading-none">মোবাইল নাম্বার</p>
                  <p className="text-[15px] font-mono font-black leading-tight mt-0.5 text-slate-900">
                    {rcData?.phone || liveUser?.phone || '01600664081'}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-2.5">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5" 
                  style={{ backgroundColor: mainColorHex }}
                >
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold leading-none">ঠিকানার বিবরণ</p>
                  <p className="text-[11.5px] font-bold leading-snug mt-0.5 text-slate-900 line-clamp-2">
                    {rcData?.address || (rcData?.village ? `Village: ${rcData.village}, Upazila: ${rcData.upazila}, District: ${rcData.district}` : 'Village: যশোর, Upazila: যশোর সদর, District: যশোর')}
                  </p>
                </div>
              </div>
            </div>

            {/* QR Verification Column (Right) */}
            <div className="col-span-3 flex flex-col items-center justify-center border-l border-slate-100 pl-3">
              <div 
                className="bg-white p-2 border-2 rounded-[1.5rem] shadow-xs flex flex-col items-center shrink-0 w-32" 
                style={{ borderColor: mainColorHex }}
              >
                <div className="relative flex items-center justify-center mb-1">
                  <img 
                    src={qrUrl} 
                    alt="QR" 
                    className="w-22 h-22 object-contain"
                  />
                </div>
                <div 
                  className="text-white w-full text-[9px] font-black py-1 px-1 rounded-full flex items-center justify-center gap-1 shadow-2xs" 
                  style={{ backgroundColor: mainColorHex }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>সদস্য যাচাইকরণ</span>
                </div>
              </div>
              <p className="text-[9px] font-bold text-slate-500 mt-1">QR স্ক্যান করে যাচাই করুন</p>
            </div>
          </div>

          {/* 3. Bottom Key Information Strip */}
          <div className="grid grid-cols-4 gap-0 border-t border-slate-100 px-6 py-2.5 items-center bg-slate-50/60">
            {/* Card No */}
            <div className="border-r border-slate-200/80 pr-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 shrink-0">
                <FileText className="w-4 h-4" style={{ color: mainColorHex }} />
              </div>
              <div>
                <span className="text-[9.5px] text-slate-400 block font-bold leading-none">কার্ড নম্বর</span>
                <span className="text-[12px] font-mono font-black uppercase block tracking-tight mt-0.5" style={{ color: mainColorHex }}>
                  {cNo}
                </span>
              </div>
            </div>

            {/* Issue Date */}
            <div className="border-r border-slate-200/80 px-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 shrink-0">
                <Calendar className="w-4 h-4" style={{ color: mainColorHex }} />
              </div>
              <div>
                <span className="text-[9.5px] text-slate-400 block font-bold leading-none">ইস্যুর তারিখ</span>
                <span className="text-[12px] font-mono font-black text-slate-900 block mt-0.5">
                  {rcData?.issueDate || '07/06/2026'}
                </span>
              </div>
            </div>

            {/* Expiry Date */}
            <div className="border-r border-slate-200/80 px-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 shrink-0">
                <ShieldCheck className="w-4 h-4" style={{ color: mainColorHex }} />
              </div>
              <div>
                <span className="text-[9.5px] text-slate-400 block font-bold leading-none">মেয়াদ শেষ</span>
                <span className="text-[12px] font-mono font-black text-slate-900 block mt-0.5">
                  {rcData?.expiryDate || '06/06/2027'}
                </span>
                <span className="text-[8.5px] font-bold block mt-0.5" style={{ color: mainColorHex }}>
                  ১ বছর পর রিনিউ
                </span>
              </div>
            </div>

            {/* Signature */}
            <div className="pl-2 flex flex-col items-center justify-center">
              <span 
                className="text-[17px] font-bold tracking-wider italic select-none block h-5 truncate" 
                style={{ fontFamily: "'Dancing Script', cursive, sans-serif", color: mainColorHex }}
              >
                {rcData?.signature || 'S. Hasan'}
              </span>
              <div className="w-full border-t border-slate-200 pt-0.5 mt-0.5 text-center">
                <span className="text-[9.5px] font-bold text-slate-400 block">কর্তৃপক্ষের স্বাক্ষর</span>
              </div>
            </div>
          </div>

          {/* 4. Bottom Solid Footer Bar */}
          <div className="text-white px-6 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: mainColorHex }}>
            <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
              <QrCode className="w-4 h-4 text-white opacity-90 shrink-0" />
              <p className="text-[9.5px] text-white/95 leading-tight font-bold truncate">
                BNB এর এই স্পেশাল প্রিন্ট কার্ডধারী ন্যায্যমূল্যে নিত্যপ্রয়োজনীয় পণ্য গ্রহণের যোগ্যতা রাখেন। এই কার্ড অন্যকে হস্তান্তরযোগ্য নয়।
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-white/15 px-2.5 py-1 rounded-full border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[9px] font-black text-white">নিরাপদ লেনদেন, বিশ্বস্ত সেবা</span>
            </div>
          </div>
        </div>
      </RationCardContainer>
    );
  };

  """

updated_code = code[:start_pos] + new_func + code[end_pos:]

with open('src/components/RationCardView.tsx', 'w') as f:
    f.write(updated_code)

print('Updated RationCardView.tsx cleanly via script!')
