# -*- coding: utf-8 -*-

with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove inline approve/reject buttons from collapsed card
old_inline_buttons = '''                                {/* Quick inline approve/reject buttons for fast processing even without expanding */}                                {isPending && !isExpanded && (                                  <div className="flex items-center gap-1 shrink-0 ml-auto">                                    <button                                      type="button"                                      onClick={() => handleApproveTransaction(tx)}                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded transition cursor-pointer active:scale-95 shadow-2xs"                                    >                                      ✔️ অনুমোদন                                    </button>                                    <button                                      type="button"                                      onClick={() => {                                        setRejectModalTx(tx);                                        setRejectReasonInput('টাকা জমা হয়নি / একাউন্টে টাকা আসেনি');                                      }}                                      className="px-1.5 py-0.5 bg-white border border-rose-300 text-rose-700 font-bold text-[10px] rounded hover:bg-rose-50 transition cursor-pointer"                                    >                                      ✖️ বাতিল                                    </button>                                  </div>                                )}'''

if old_inline_buttons in code:
    code = code.replace(old_inline_buttons, '')
    print("Successfully removed inline approve/reject buttons from collapsed state!")
else:
    print("Could not find exact old_inline_buttons string, searching regex or substring...")
    import re
    code = re.sub(
        r'\{/\*\s*Quick inline approve/reject buttons[^\}]*\*/\}\s*\{isPending\s*&&\s*!isExpanded\s*&&\s*\(\s*<div className="flex items-center gap-1 shrink-0 ml-auto">[\s\S]*?</div>\s*\)\}',
        '',
        code
    )
    print("Regex replacement executed!")

# 2. Update the Expanded Action Buttons to have clear "✔️ অনুমোদন করুন" and "❌ বাতিল করুন ও কারণ লিখুন"
old_expanded_actions = '''{/* Action Buttons: Green Approve + Red Reject */}                                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap sm:flex-nowrap">                                    {isPending ? (                                      <>                                        <button                                          type="button"                                          onClick={() => handleApproveTransaction(tx)}                                          className="flex-1 py-2 bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-black text-xs rounded-lg shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"                                        >                                          <span>✅</span>                                          <span>✔️ অনুমোদন করুন (Accept)</span>                                        </button>                                        <button                                          type="button"                                          onClick={() => {                                            setRejectModalTx(tx);                                            setRejectReasonInput('টাকা জমা হয়নি / একাউন্টে টাকা আসেনি');                                          }}                                          className="px-3 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-black text-xs rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 shrink-0"                                        >                                          <span>❌</span>                                          <span>✖️ বাতিল</span>                                        </button>                                      </>'''

new_expanded_actions = '''{/* Action Buttons: Green Approve + Red Reject (Shown only when 'আরও দেখুন' is clicked) */}                                  <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">                                    {isPending ? (                                      <>                                        <button                                          type="button"                                          onClick={() => handleApproveTransaction(tx)}                                          className="flex-1 py-2 bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"                                        >                                          <span>✅</span>                                          <span>✔️ অনুমোদন করুন (Accept)</span>                                        </button>                                        <button                                          type="button"                                          onClick={() => {                                            setRejectModalTx(tx);                                            setRejectReasonInput('টাকা জমা হয়নি / একাউন্টে টাকা আসেনি');                                          }}                                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"                                        >                                          <span>❌</span>                                          <span>বাতিল করুন ও কারণ লিখুন (Reject)</span>                                        </button>                                      </>'''

if old_expanded_actions in code:
    code = code.replace(old_expanded_actions, new_expanded_actions)
    print("Successfully updated expanded action buttons!")
else:
    print("Could not find exact old_expanded_actions string, searching regex...")
    import re
    code = re.sub(
        r'\{/\*\s*Action Buttons: Green Approve \+ Red Reject\s*\*/\}\s*<div className="flex items-center gap-1\.5 pt-0\.5 flex-wrap sm:flex-nowrap">\s*\{isPending\s*\?\s*\(\s*<>[\s\S]*?<span>✖️ বাতিল</span>\s*</button>\s*</>',
        new_expanded_actions,
        code
    )

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("AdminPanel.tsx updated successfully!")
