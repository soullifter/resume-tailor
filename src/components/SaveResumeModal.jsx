import { useState } from 'react'

export default function SaveResumeModal({ onSave, onClose, defaultCompany = '', defaultRole = '' }) {
  const [company, setCompany] = useState(defaultCompany)
  const [role, setRole]       = useState(defaultRole)

  function handleSave() {
    if (!company.trim() || !role.trim()) return
    onSave({ company: company.trim(), role: role.trim() })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-bold text-base">Save this resume</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>
        <p className="text-slate-500 text-xs mb-5 leading-relaxed">
          Saved to your browser — no account needed. Reload or re-tailor any time.
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Company name</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Stripe"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Role title</label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!company.trim() || !role.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
