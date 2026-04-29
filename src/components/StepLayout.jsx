import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModelWidget from './ModelWidget'

const HINT_KEY = 'rt_gear_hint_seen'

function GearHint({ onOpenSettings }) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(HINT_KEY))

  function dismiss() {
    localStorage.setItem(HINT_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null
  return (
    <div className="flex items-center justify-between gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 mb-3 text-sm"
      style={{ animation: 'content-slide-in 0.4s ease-out both' }}>
      <div className="flex items-center gap-2 min-w-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-slate-300">
          Tap the <button onClick={() => { dismiss(); onOpenSettings?.() }} className="text-blue-400 underline font-medium">gear icon ⚙</button> for API key · AI model · export &amp; backup your data
        </span>
      </div>
      <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors shrink-0">✕</button>
    </div>
  )
}

const STEP_LABELS = ['Upload Resume', 'Job Description', 'Review & Download']

const LAYOUT_STYLES = `
@keyframes step-active-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50%       { box-shadow: 0 0 0 4px rgba(59,130,246,0.35); }
}
@keyframes check-stroke {
  from { stroke-dashoffset: 10; }
  to   { stroke-dashoffset: 0; }
}
@keyframes content-slide-in {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes btn-press {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(0.95); }
}
`

export default function StepLayout({ step, totalSteps, title, subtitle, children, onBack, onNext, nextLabel = 'Continue', nextDisabled = false, hideNext = false, onOpenSettings }) {
  const navigate = useNavigate()
  const progress = (step / totalSteps) * 100

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <style>{LAYOUT_STYLES}</style>
      {/* Top bar */}
      <div className="border-b border-slate-800/60 px-6 pt-4 pb-4">
        <div className="max-w-xl mx-auto">
          {/* Brand + settings */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Go to home"
            >
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">R</span>
              </div>
              <span className="text-white font-bold text-sm">ResumeTailor</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm hidden sm:block">{Math.round(progress)}%</span>
              <ModelWidget />
              {onOpenSettings && (
                <button onClick={onOpenSettings} title="API Key Settings" className="text-slate-600 hover:text-slate-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mb-3">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1
              const isActive = stepNum === step
              const isDone = stepNum < step
              return (
                <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`flex items-center gap-1.5 shrink-0 ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 relative ${
                        isDone ? 'bg-emerald-500 text-white' :
                        isActive ? 'bg-blue-600 text-white' :
                        'bg-slate-800 text-slate-600'
                      }`}
                      style={isActive ? { animation: 'step-active-glow 2s ease-in-out infinite' } : {}}
                    >
                      {isDone ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            strokeDasharray="10" strokeDashoffset="0"
                            style={{ animation: 'check-stroke 0.4s ease-out both' }} />
                        </svg>
                      ) : stepNum}
                    </div>
                    <span className="text-sm font-medium hidden sm:block truncate">{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 transition-colors duration-500 ${isDone ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-10">
        <div className="w-full max-w-xl mx-auto">
          <GearHint onOpenSettings={onOpenSettings} />

          <div key={step} style={{ animation: 'content-slide-in 0.35s ease-out both' }}>
            <div className="mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h2>
              {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
            </div>

            {children}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {onBack ? (
              <button onClick={onBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
                ← Back
              </button>
            ) : <div />}
            {!hideNext && (
              <button
                onClick={onNext}
                disabled={nextDisabled}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                {nextLabel} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
