import { useState, useEffect, useRef } from 'react'
import { MODEL_OPTIONS, getRateLimitInfo, getStoredModel, setStoredModel, isModelExhausted } from '../utils/groq'

function fmtPct(remain, total) {
  if (!total) return '~100%'
  return Math.round((remain / total) * 100) + '% left'
}

function pctColor(remain, total, exhausted) {
  if (exhausted) return 'text-red-400'
  if (!total || remain === total) return 'text-slate-500'
  const pct = remain / total
  if (pct <= 0.1) return 'text-red-400'
  if (pct <= 0.5) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function ModelWidget() {
  const [modelId, setModelId]     = useState(getStoredModel)
  const [rl, setRl]               = useState(() => getRateLimitInfo(getStoredModel()))
  const [exhausted, setExhausted] = useState(() => isModelExhausted(getStoredModel()))
  const [open, setOpen]           = useState(false)
  const ref                       = useRef(null)

  useEffect(() => {
    const update = () => {
      const id = getStoredModel()
      setModelId(id)
      setRl(getRateLimitInfo(id))
      setExhausted(isModelExhausted(id))
    }
    window.addEventListener('ratelimit-updated', update)
    return () => window.removeEventListener('ratelimit-updated', update)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function switchModel(id) {
    setStoredModel(id)
    setModelId(id)
    setRl(getRateLimitInfo(id))
    window.dispatchEvent(new CustomEvent('ratelimit-updated'))
    setOpen(false)
  }

  const model     = MODEL_OPTIONS.find(m => m.id === modelId) || MODEL_OPTIONS[0]
  const isDefault = !rl || rl.isDefault
  const tokRemain = rl?.tokRemain ?? model.limitTPD
  const tokTotal  = rl?.tokTotal  ?? model.limitTPD

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      {/* Rate info */}
      <span className={`text-sm hidden sm:block ${pctColor(tokRemain, tokTotal, exhausted)}`}>
        {exhausted ? 'Limit reached' : isDefault ? '~100%' : fmtPct(tokRemain, tokTotal)}
      </span>

      {/* Model button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-sm font-medium border rounded-lg px-2 py-1 transition-colors ${
          exhausted
            ? 'text-red-400 border-red-500/40 hover:border-red-500/60'
            : 'text-slate-400 hover:text-white border-slate-700 hover:border-slate-500'
        }`}
      >
        <span>{model.shortName}</span>
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 sm:absolute sm:inset-x-auto sm:top-8 sm:right-0 sm:w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Switch AI Model</p>
            <span className={`text-sm sm:hidden ${pctColor(tokRemain, tokTotal, exhausted)}`}>
              {exhausted ? 'Limit reached' : isDefault ? '~100% left today' : `${fmtPct(tokRemain, tokTotal)} today`}
            </span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {MODEL_OPTIONS.map((opt, idx) => {
              const optRl      = getRateLimitInfo(opt.id)
              const isActive   = opt.id === modelId
              const exhausted  = isModelExhausted(opt.id)
              const optRemain  = optRl?.tokRemain ?? opt.limitTPD
              const optTotal   = optRl?.tokTotal  ?? opt.limitTPD
              const optDefault = !optRl || optRl.isDefault
              return (
                <button
                  key={opt.id}
                  onClick={() => !exhausted && switchModel(opt.id)}
                  disabled={exhausted}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
                    isActive    ? 'bg-blue-600/20 border-blue-500/30' :
                    exhausted   ? 'opacity-40 cursor-not-allowed border-transparent' :
                    'hover:bg-slate-800 border-transparent'
                  }`}
                >
                  {/* Row 1: index + name */}
                  <div className="flex items-center gap-2">
                    {isActive ? <span className="text-blue-400 text-sm shrink-0">✓</span> : <span className="text-sm text-slate-600 shrink-0">#{idx + 1}</span>}
                    <span className={`text-sm font-semibold ${isActive ? 'text-white' : exhausted ? 'text-slate-500' : 'text-slate-200'}`}>{opt.name}</span>
                  </div>
                  {/* Row 2: tag + token count */}
                  <div className="flex items-center gap-2 mt-1 ml-5">
                    {exhausted
                      ? <span className="text-sm px-1.5 py-0.5 rounded-full border font-medium text-red-400 bg-red-500/10 border-red-500/20">Limit reached</span>
                      : opt.tag && <span className={`text-sm px-1.5 py-0.5 rounded-full border font-medium ${opt.tagColor}`}>{opt.tag}</span>
                    }
                    <span className={`text-sm tabular-nums ${pctColor(optRemain, optTotal, exhausted)}`}>
                      {exhausted ? 'Limit reached' : optDefault ? '~100%' : fmtPct(optRemain, optTotal)}
                    </span>
                  </div>
                  {/* Row 3: description */}
                  <p className="text-sm text-slate-500 mt-1 ml-5 leading-snug">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
