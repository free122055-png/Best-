with open('src/components/Dashboard.tsx', 'r') as f:
    code = f.read()

old_pills_block = """          {/* Center: Dual Pill Buttons Container (Yellow Balance & Red Due) - Guaranteed Mobile Screen Containment */}
          <div className="flex items-center rounded-full overflow-hidden shadow-lg shrink-0 mx-auto border-0 bg-transparent max-w-[46%] xs:max-w-none">
            {/* Yellow Main Balance Pill (Displays 'Balance' in English, Tap reveals amount for 3 seconds) */}
            <button
              type="button"
              onClick={handleTapBalance}
              title="Tap to view main balance for 3 seconds"
              className="bg-amber-400 hover:bg-amber-500 px-2.5 xs:px-4 py-2 flex items-center justify-center text-slate-950 font-black text-[13px] xs:text-[15.5px] sm:text-[18px] transition-all cursor-pointer min-w-[75px] xs:min-w-[105px] sm:min-w-[135px] h-9 xs:h-11 rounded-l-full active:scale-98 shadow-xs border-0 truncate"
            >
              <span className="whitespace-nowrap tracking-tight font-black font-sans truncate">
                {showBalance 
                  ? '৳' + (liveUser?.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 }) 
                  : 'Balance'}
              </span>
            </button>

            {/* Red Due Loan Pill (Always Visible - Prominent Outstanding Amount) */}
            <div className="bg-rose-600 px-2.5 xs:px-4 py-2 flex items-center justify-center text-white font-black text-[13px] xs:text-[15.5px] sm:text-[18px] min-w-[75px] xs:min-w-[105px] sm:min-w-[135px] h-9 xs:h-11 rounded-r-full shadow-xs border-0 truncate">
              <span className="whitespace-nowrap tracking-tight font-black font-sans">
                ৳{(liveUser?.dueLoan || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>"""

new_pills_block = """          {/* Center: Dual Pill Buttons Container - Prominent & Large Matching Reference Screenshot Exactly */}
          <div className="flex items-center rounded-full overflow-hidden shadow-xl shrink-0 mx-auto border-0 bg-transparent">
            {/* Yellow Main Balance Pill (Displays 'Balance' in English, Tap reveals amount for 3 seconds) */}
            <button
              type="button"
              onClick={handleTapBalance}
              title="Tap to view main balance for 3 seconds"
              className="bg-amber-400 hover:bg-amber-500 px-4 xs:px-5 sm:px-6 py-2.5 flex items-center justify-center text-slate-950 font-black text-[15px] xs:text-[17px] sm:text-[19px] transition-all cursor-pointer min-w-[95px] xs:min-w-[120px] sm:min-w-[140px] h-10.5 xs:h-12 rounded-l-full active:scale-98 shadow-sm border-0"
            >
              <span className="whitespace-nowrap tracking-tight font-black font-sans">
                {showBalance 
                  ? '৳' + (liveUser?.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 }) 
                  : 'Balance'}
              </span>
            </button>

            {/* Red Due Loan Pill (Always Visible - Prominent Outstanding Amount) */}
            <div className="bg-[#e60049] px-4 xs:px-5 sm:px-6 py-2.5 flex items-center justify-center text-white font-black text-[15px] xs:text-[17px] sm:text-[19px] transition-all min-w-[95px] xs:min-w-[120px] sm:min-w-[140px] h-10.5 xs:h-12 rounded-r-full shadow-sm border-0">
              <span className="whitespace-nowrap tracking-tight font-black font-sans">
                ৳{(liveUser?.dueLoan || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>"""

if old_pills_block in code:
    code = code.replace(old_pills_block, new_pills_block)
    with open('src/components/Dashboard.tsx', 'w') as f:
        f.write(code)
    print('Enlarged balance pills in Dashboard.tsx successfully!')
else:
    print('old_pills_block not matched exactly')
