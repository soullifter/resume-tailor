import { useState, useEffect, useRef } from 'react'
import { hasSavedResumes, hasApplications, getSavedResumes } from '../utils/storage'
import ModelWidget from './ModelWidget'

const LANDING_STYLES = `
  @keyframes float-chip {
    0%   { transform: translateY(0) translateX(0); opacity: 0; }
    8%   { opacity: 0.55; }
    92%  { opacity: 0.35; }
    100% { transform: translateY(-160px) translateX(12px); opacity: 0; }
  }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes score-flash {
    0%, 100% { transform: scale(1); }
    40%       { transform: scale(1.18); filter: drop-shadow(0 0 12px #10b981); }
  }
  @keyframes btn-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
    50%       { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
  }
`

const TICKER_ITEMS = [
  "✓  Rohan's score jumped 42 → 88",
  "✓  Sara landed 3 interviews after tailoring",
  "✓  1,247 resumes tailored today",
  "✓  Marcus: 4 keywords → 13 keywords",
  "✓  Priya got shortlisted at Google",
  "✓  James's ATS score +31 points",
  "✓  Ana went from 0 callbacks to 4",
  "✓  80 full rewrites free every day",
  "✓  Diego landed his first dev job",
  "✓  Meera switched careers successfully",
]

function Ticker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="overflow-hidden border-b border-slate-800/50 bg-slate-900/50 py-2 select-none">
      <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'ticker-scroll 35s linear infinite' }}>
        {doubled.map((item, i) => (
          <span key={i} className="text-xs text-slate-500 shrink-0 tracking-wide">{item}</span>
        ))}
      </div>
    </div>
  )
}

const TYPEWRITER_WORDS = ['ignored', 'filtered', 'rejected']

function TypewriterWord() {
  const [idx, setIdx]           = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [erasing, setErasing]   = useState(false)
  useEffect(() => {
    const word = TYPEWRITER_WORDS[idx]
    if (!erasing) {
      if (displayed.length < word.length) {
        const t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 90)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setErasing(true), 1600)
      return () => clearTimeout(t)
    } else {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 50)
        return () => clearTimeout(t)
      }
      setIdx(i => (i + 1) % TYPEWRITER_WORDS.length)
      setErasing(false)
    }
  }, [displayed, erasing, idx])
  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
      {displayed}<span className="text-red-400 animate-pulse ml-0.5">|</span>
    </span>
  )
}

const FLOAT_CHIPS = [
  { label: 'React',          left: '6%',  delay: 0,   dur: 9  },
  { label: 'Leadership',     left: '18%', delay: 2.5, dur: 11 },
  { label: '$2M Revenue',    left: '32%', delay: 1,   dur: 10 },
  { label: 'TypeScript',     left: '50%', delay: 3.5, dur: 8  },
  { label: 'AWS',            left: '65%', delay: 0.5, dur: 9  },
  { label: 'Managed 12',     left: '76%', delay: 2,   dur: 12 },
  { label: 'Python',         left: '88%', delay: 1.5, dur: 10 },
  { label: 'SQL',            left: '42%', delay: 4,   dur: 11 },
]

function FloatingChips() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {FLOAT_CHIPS.map((c, i) => (
        <span
          key={i}
          className="absolute bottom-8 text-xs px-2.5 py-1 rounded-full border bg-slate-900/70 border-slate-700/40 text-slate-500"
          style={{ left: c.left, animation: `float-chip ${c.dur}s ease-in-out ${c.delay}s infinite` }}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}

function ScoreDelta() {
  const [ref, inView] = useInView(0.1)
  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-2">
      <div
        className="text-emerald-400 text-3xl font-black"
        style={inView ? { animation: 'score-flash 0.8s ease 0.8s 1' } : {}}
      >
        +33
      </div>
      <div className="text-slate-600 text-xs">points</div>
      <svg className="h-4 w-4 text-slate-600 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </div>
  )
}

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, inView]
}

function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  )
}

function Counter({ to, suffix = '', duration = 1800 }) {
  const [ref, inView] = useInView()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.floor(ease * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, to, duration])
  return <span ref={ref}>{val}{suffix}</span>
}

function AnimatedRing({ score, color, label }) {
  const [ref, inView] = useInView(0.1)
  const [displayed, setDisplayed] = useState(0)
  const circumference = 2 * Math.PI * 36

  useEffect(() => {
    if (!inView) return
    const start = Date.now()
    const duration = 1600
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.floor(ease * score))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, score])

  const offset = circumference - (displayed / 100) * circumference

  return (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="7" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.05s' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{displayed}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(v => !v)}
      className="w-full text-left bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-5 py-4 transition-all"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-white text-sm font-medium">{q}</span>
        <span className={`text-slate-400 text-lg font-light transition-transform duration-200 shrink-0 ${open ? 'rotate-45' : ''}`}>+</span>
      </div>
      {open && <p className="text-slate-400 text-sm mt-3 leading-relaxed text-left">{a}</p>}
    </button>
  )
}

const KEYWORDS = [
  { kw: 'React',         s: 'match'   },
  { kw: 'TypeScript',    s: 'match'   },
  { kw: 'JavaScript',    s: 'match'   },
  { kw: 'Git',           s: 'match'   },
  { kw: 'Node.js',       s: 'partial' },
  { kw: 'REST APIs',     s: 'partial' },
  { kw: 'CI/CD',         s: 'partial' },
  { kw: 'GraphQL',       s: 'missing' },
  { kw: 'AWS',           s: 'missing' },
  { kw: 'Kubernetes',    s: 'missing' },
  { kw: 'System Design', s: 'missing' },
]

const BULLETS = [
  {
    before: 'Responsible for building React components for the dashboard',
    after:  'Led development of 15+ React/TypeScript dashboard components, reducing page load time by 40%',
  },
  {
    before: 'Helped the team migrate to TypeScript',
    after:  'Drove TypeScript migration across 40K+ lines of JavaScript, eliminating 200+ production runtime errors',
  },
]

function MiniRing({ score, color, size = 56, stroke = 5 }) {
  const r = (size / 2) - stroke
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{score}%</span>
      </div>
    </div>
  )
}

function FakeBar() {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      <div className="w-3 h-3 rounded-full bg-red-500/40" />
      <div className="w-3 h-3 rounded-full bg-amber-500/40" />
      <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
      <div className="flex-1 bg-slate-800 rounded h-4 mx-2 opacity-50" />
    </div>
  )
}

const DEMO_STEPS = [
  { label: 'Resume Health', emoji: '🩺' },
  { label: 'Job Match',     emoji: '🎯' },
  { label: 'ATS Score',     emoji: '📊' },
  { label: 'AI Rewrite',    emoji: '✍️' },
  { label: 'Interview Prep',emoji: '🎤' },
  { label: 'Cover Letter',  emoji: '📝' },
  { label: 'Job Tracker',   emoji: '📋' },
  { label: 'Quality Check', emoji: '✅' },
]

function ProductDemo({ onStart }) {
  const [step, setStep] = useState(0)
  const [animScore, setAnimScore] = useState(61)
  const [ref, inView] = useInView(0.1)

  useEffect(() => {
    if (step !== 2) { setAnimScore(61); return }
    const start = Date.now(), dur = 1400
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setAnimScore(Math.round(61 + ease * 27))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [step])

  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
      {/* Tab bar */}
      <div className="flex items-center justify-center flex-wrap gap-1 mb-5">
        {DEMO_STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              step === i
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{s.emoji}</span>{s.label}
          </button>
        ))}
      </div>

      {/* App window */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        <FakeBar />

        {/* ── Step 0: Resume Health ── */}
        {step === 0 && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-start gap-3 bg-slate-800/70 border border-slate-700 rounded-xl p-4">
              <div className="w-10 h-12 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-red-400 text-xs font-bold">PDF</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">Alex_Chen_Resume.pdf</p>
                <p className="text-slate-400 text-xs mt-0.5">Software Engineer · 2 pages · 847 words</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 text-xs">Parsed successfully</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg width="56" height="56" className="-rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="5" />
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#f59e0b" strokeWidth="5"
                    strokeDasharray={`${2*Math.PI*22}`} strokeDashoffset={`${2*Math.PI*22*(1-0.72)}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">72</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Resume Health: 72 / 100</p>
                <p className="text-slate-400 text-xs mt-0.5 mb-2">Needs Work — ATS flags detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {['⚠ No LinkedIn URL', '⚠ Low metric density', '⚠ Weak verbs in 3 bullets'].map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actionable Fixes</p>
              {[
                'Add your LinkedIn URL to the contact section',
                '4 of 6 bullets in Role 1 have no metrics — add numbers',
                'Replace "Responsible for" with a strong verb like "Led" or "Built"',
              ].map((fix, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-400">
                  <span className="text-amber-400 shrink-0">→</span>{fix}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Job Match ── */}
        {step === 1 && (
          <div className="px-5 pb-5 space-y-3">
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-white font-semibold">Senior Frontend Engineer · Stripe</span><br /><br />
                You'll work with{' '}
                <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1 rounded">React</span>{', '}
                <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1 rounded">TypeScript</span>{', and '}
                <span className="text-amber-400 font-medium bg-amber-500/10 px-1 rounded">GraphQL</span>{' '}
                to build checkout experiences. Experience with{' '}
                <span className="text-red-400 font-medium bg-red-500/10 px-1 rounded">Kubernetes</span>{' and '}
                <span className="text-red-400 font-medium bg-red-500/10 px-1 rounded">AWS</span>{' '}
                is a strong plus.
              </p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-emerald-400 text-xs font-semibold">Auto-detected · Moderate match</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['Role', 'Sr. Frontend Eng.'], ['Company', 'Stripe'], ['Seniority', 'Senior']].map(([k, v]) => (
                  <div key={k}><p className="text-slate-500 text-xs">{k}</p><p className="text-white text-xs font-semibold mt-0.5">{v}</p></div>
                ))}
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">💡 This role wants someone who can own the full payment UX — from component design to performance at scale.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: ATS Score ── */}
        {step === 2 && (
          <div className="px-5 pb-5 space-y-4">
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <MiniRing score={61} color="#ef4444" />
                <span className="text-xs text-slate-500">Original</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-emerald-400 font-black text-xl">+{animScore - 61}</span>
                <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-1">
                <MiniRing score={animScore} color="#10b981" />
                <span className="text-xs text-slate-500">Tailored</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Keyword Heatmap</p>
              <div className="flex flex-wrap gap-1.5">
                {KEYWORDS.map(({ kw, s }) => (
                  <span key={kw} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    s === 'match'   ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                    s === 'partial' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                                      'bg-red-500/15 border-red-500/30 text-red-400'
                  }`}>
                    {s === 'match' ? '✓' : s === 'partial' ? '~' : '✗'} {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: AI Rewrite ── */}
        {step === 3 && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI-Rewritten Bullets</p>
            <div className="space-y-2">
              {BULLETS.map(({ before, after }, i) => (
                <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <span className="text-red-400 font-bold text-xs shrink-0 mt-0.5">−</span>
                    <span className="text-xs text-slate-500 line-through leading-relaxed">{before}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-emerald-400 font-bold text-xs shrink-0 mt-0.5">+</span>
                    <span className="text-xs text-emerald-300 leading-relaxed">{after}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2.5 text-xs text-blue-400">
              Also rewrites your summary, reorders skills by JD relevance, and weaves in missing keywords naturally.
            </div>
          </div>
        )}

        {/* ── Step 4: Interview Prep ── */}
        {step === 4 && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">10 Role-Specific Questions</p>
              <span className="text-xs text-slate-500">Generated for Stripe SWE</span>
            </div>
            {[
              {
                q: 'Tell me about a time you improved frontend performance under a hard deadline.',
                type: 'behavioral', diff: 'hard',
                tip: 'Use your 40% load time reduction at your last role as the STAR example — that metric will land well here.',
                avoid: 'Don\'t just describe what you did — state the measurable result clearly.',
              },
              {
                q: 'How would you design a checkout component that handles 10,000 concurrent users?',
                type: 'scenario', diff: 'hard',
                tip: 'Lead with your approach to state management, then talk about lazy loading and optimistic UI.',
                avoid: 'Don\'t skip the tradeoffs — interviewers at Stripe expect nuance.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${item.diff === 'hard' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>{item.diff}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border text-slate-400 bg-slate-800 border-slate-600">{item.type}</span>
                </div>
                <p className="text-white text-xs font-medium leading-relaxed">{item.q}</p>
                <p className="text-emerald-400 text-xs leading-relaxed">💡 {item.tip}</p>
                <p className="text-slate-500 text-xs leading-relaxed">✗ Avoid: {item.avoid}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 5: Cover Letter ── */}
        {step === 5 && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Generated Cover Letter</p>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Stripe · SWE</span>
            </div>
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>Stripe's bet on rebuilding financial infrastructure from first principles is exactly the kind of problem I've spent my career on. As a Senior Engineer at Acme Corp, I reduced checkout abandonment by 23% by redesigning the payment flow in React and TypeScript — the same stack your team uses at scale.</p>
              <p className="text-slate-400">Over the past four years I've shipped payment UIs handling $40M+ in annual transactions, led a TypeScript migration across 40K lines of JavaScript, and mentored a team of five engineers. The systems thinking required for Stripe's scale is something I've been deliberately building toward.</p>
              <p className="text-slate-400">I'd welcome a conversation about how my background maps to the challenges your payments infrastructure team is tackling.</p>
            </div>
            <p className="text-xs text-slate-500 text-center">Tailored to the JD · No clichés · 3 focused paragraphs</p>
          </div>
        )}

        {/* ── Step 6: Job Tracker ── */}
        {step === 6 && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Application Tracker</p>
              <span className="text-xs text-slate-500">4 active · 1 offer</span>
            </div>
            <div className="space-y-2">
              {[
                { company: 'Stripe',   role: 'Sr. Frontend Eng.',  stage: 'Final Round', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', days: 12 },
                { company: 'Airbnb',   role: 'React Developer',    stage: 'Technical',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',           days: 8  },
                { company: 'Figma',    role: 'SWE II',             stage: 'Applied',     color: 'text-slate-400 bg-slate-800 border-slate-600',              days: 3  },
                { company: 'Vercel',   role: 'Frontend Eng.',      stage: 'Offer 🎉',    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',      days: 21 },
              ].map((app, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-white text-xs font-semibold">{app.company}</p>
                    <p className="text-slate-500 text-xs">{app.role} · {app.days}d ago</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${app.color}`}>{app.stage}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center">Track status · Get AI follow-up emails · See response rate</p>
          </div>
        )}

        {/* ── Step 7: Quality Check ── */}
        {step === 7 && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pre-Submit Quality Check</p>
            <div className="space-y-2">
              <div className="text-xs px-3 py-2.5 rounded-lg border text-red-400 bg-red-500/10 border-red-500/20">
                <span className="font-semibold">Unfilled Placeholder</span>
                <span className="opacity-60 font-normal ml-2">SWE at Acme · Bullet 3</span>
                <p className="mt-1 opacity-80">Fill in [X] with your actual team size before submitting.</p>
              </div>
              <div className="text-xs px-3 py-2.5 rounded-lg border text-blue-400 bg-blue-500/10 border-blue-500/20">
                <span className="font-semibold">Add Metrics</span>
                <span className="opacity-60 font-normal ml-2">SWE at Acme · Bullet 5</span>
                <p className="mt-1 opacity-80">"Improved API response time" — add the % or ms improvement (e.g. by 40%).</p>
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-xs font-semibold">Submit Readiness</p>
                <p className="text-slate-400 text-xs mt-0.5">Fix 2 items above, then you're good to go</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-amber-400">74</span>
                <span className="text-xs px-2 py-1 rounded-full border text-amber-300 bg-amber-500/20 border-amber-500/30 font-semibold">⚠ Needs Work</span>
              </div>
            </div>
            <button
              onClick={onStart}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              Try all 16 tools — Free →
            </button>
          </div>
        )}
      </div>

      {/* Nav dots + arrows */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-slate-500 hover:text-white text-sm transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <div className="flex gap-1.5 items-center">
          {DEMO_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === i ? 'w-5 bg-blue-400' : 'w-1.5 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
        {step < DEMO_STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Next →
          </button>
        ) : (
          <button onClick={onStart} className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors">
            Try it free →
          </button>
        )}
      </div>
    </div>
  )
}

const GearIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const MODEL_CAPACITY = [
  { name: 'Best Quality',   resumes: 5,  tokens: '100K', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { name: 'High Capacity',  resumes: 25, tokens: '500K', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { name: 'Balanced',       resumes: 25, tokens: '500K', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
  { name: 'Basic',          resumes: 25, tokens: '500K', color: 'text-slate-300 border-slate-600 bg-slate-800' },
]
const TOTAL_RESUMES = MODEL_CAPACITY.reduce((s, m) => s + m.resumes, 0) // 80

function CapacityToast({ onDismiss }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])
  function dismiss() { setVisible(false); setTimeout(onDismiss, 400) }

  return (
    <div className={`fixed bottom-6 left-1/2 z-50 transition-all duration-500 ${visible ? 'opacity-100 -translate-x-1/2 translate-y-0' : 'opacity-0 -translate-x-1/2 translate-y-8 pointer-events-none'}`}
      style={{ width: 'min(96vw, 560px)' }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-white font-bold text-sm">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{TOTAL_RESUMES} full resume rewrites</span>
                {' '}free every day
              </p>
              <p className="text-slate-400 text-xs mt-0.5">Across 4 AI models · 1.6M tokens combined · Resets at midnight UTC</p>
            </div>
            <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors text-lg leading-none shrink-0 mt-0.5">×</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MODEL_CAPACITY.map(m => (
              <div key={m.name} className={`border rounded-xl px-3 py-2 text-center ${m.color}`}>
                <p className="font-black text-base leading-none">{m.resumes}</p>
                <p className="text-xs opacity-80 mt-0.5 font-medium leading-tight">{m.name}</p>
                <p className="text-xs opacity-50 mt-0.5">{m.tokens} tok</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage({ onStart, onChangeKey, onGoToVersions, onGoToTracker }) {
  const savedCount = getSavedResumes().length
  const [showToast, setShowToast] = useState(true)
  return (
    <div className="bg-slate-950 text-white overflow-x-hidden">
      <style>{LANDING_STYLES}</style>

      {showToast && <CapacityToast onDismiss={() => setShowToast(false)} />}

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <span className="text-white font-bold text-sm">ResumeTailor</span>
          </div>
          <div className="flex items-center gap-2">
            {savedCount > 0 && (
              <button
                onClick={onGoToVersions}
                className="text-slate-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
              >
                My Resumes ({savedCount})
              </button>
            )}
            {hasApplications() && (
              <button
                onClick={onGoToTracker}
                className="text-slate-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
              >
                Tracker
              </button>
            )}
            <ModelWidget />
            <button onClick={onChangeKey} className="text-slate-500 hover:text-slate-300 transition-colors" title="API Settings">
              <GearIcon />
            </button>
            <button
              onClick={onStart}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-blue-500/25"
            >
              Get Started →
            </button>
          </div>
        </div>
      </nav>

      {/* ── TICKER ── */}
      <div className="fixed top-[57px] left-0 right-0 z-40">
        <Ticker />
      </div>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-28 pb-16 overflow-hidden">
        {/* Grid bg */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }} />
        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-600/6 rounded-full blur-3xl pointer-events-none" />
        <FloatingChips />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-4 py-1.5 rounded-full mb-3">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Free · AI-Powered · Your data never leaves your browser
          </div>

          {/* Capacity strip */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <span className="text-slate-500 text-xs">Free daily capacity:</span>
            {MODEL_CAPACITY.map(m => (
              <span key={m.name} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${m.color}`}>
                <span className="font-black">{m.resumes}</span> {m.name}
              </span>
            ))}
            <span className="text-white text-xs font-black bg-gradient-to-r from-blue-500/20 to-emerald-500/20 border border-blue-500/30 px-2.5 py-1 rounded-full">
              = {TOTAL_RESUMES} resumes/day free
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-6">
            Your resume is being
            <span className="block" style={{ minHeight: '1.15em' }}>
              <TypewriterWord />
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-emerald-400">
              before anyone reads it
            </span>
          </h1>

          <p className="text-slate-400 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            75% of resumes never reach a human.{' '}
            <span className="text-white font-medium">We fix that — free.</span>
            <br className="hidden sm:block" />
            <span className="text-slate-500 text-base">16 AI tools · tailored resume · interview prep · job tracker.</span>
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={onStart}
              style={{ animation: 'btn-glow 2.5s ease-in-out infinite' }}
              className="group relative bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-10 py-4 rounded-xl text-base transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/30 flex items-center gap-2"
            >
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              Fix My Resume — Free
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <p className="text-slate-500 text-sm">No account · No credit card · 2 min setup</p>
          </div>

          {/* Feature pill strip */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-3xl mx-auto">
            {[
              { label: 'ATS Match Score',       color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
              { label: 'Keyword Heatmap',        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
              { label: 'AI Resume Rewrite',      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Resume Health Score',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Language Polish',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Bullet Rewriter',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Quality Check',          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { label: 'Length Trimmer',         color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { label: '3 PDF Templates',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
              { label: 'Cover Letter',           color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
              { label: 'LinkedIn About',         color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
              { label: 'Interview Questions',    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              { label: 'Save Versions',          color: 'text-slate-300 bg-slate-800 border-slate-600' },
              { label: 'Application Tracker',    color: 'text-slate-300 bg-slate-800 border-slate-600' },
              { label: 'Follow-up Emails',       color: 'text-slate-300 bg-slate-800 border-slate-600' },
              { label: 'Custom AI Instructions', color: 'text-slate-300 bg-slate-800 border-slate-600' },
            ].map(({ label, color }) => (
              <span key={label} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${color}`}>
                ✓ {label}
              </span>
            ))}
          </div>

          {/* Animated score visual */}
          <FadeIn delay={300}>
            <div className="inline-flex flex-wrap items-center justify-center gap-6 sm:gap-8 bg-slate-900/80 border border-slate-800 rounded-2xl px-6 sm:px-10 py-6 backdrop-blur-sm shadow-2xl shadow-black/20">
              <AnimatedRing score={54} color="#ef4444" label="Before tailoring" />
              <ScoreDelta />
              <AnimatedRing score={87} color="#10b981" label="After tailoring" />
              <div className="text-left border-l border-slate-800 pl-6 hidden sm:block">
                <p className="text-white text-sm font-semibold">Real improvement</p>
                <p className="text-slate-500 text-xs mt-1 max-w-32">Sample resume against a SWE job description</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── STAT BAR ── */}
      <section className="border-y border-slate-800 bg-slate-900/40">
        <div className="max-w-4xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { to: 75, suffix: '%', label: 'Resumes filtered before a human sees them', color: 'from-red-400 to-orange-400' },
            { to: 16, suffix: '+', label: 'AI tools, all free', color: 'from-blue-400 to-blue-300' },
            { to: 30, suffix: 's', label: 'To a tailored resume', color: 'from-emerald-400 to-teal-400' },
            { to: 100, suffix: '%', label: 'Free, forever', color: 'from-violet-400 to-purple-400' },
          ].map(({ to, suffix, label, color }, i) => (
            <FadeIn key={i} delay={i * 100}>
              <p className={`text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${color} mb-2`}>
                <Counter to={to} suffix={suffix} />
              </p>
              <p className="text-slate-500 text-xs leading-relaxed">{label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="max-w-2xl mx-auto px-4 py-20">
        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">See it in action</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Watch what happens to your resume</h2>
            <p className="text-slate-400 text-sm">Click through the steps — this is exactly what the tool does with your resume.</p>
          </div>
        </FadeIn>
        <ProductDemo onStart={onStart} />
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-3xl mx-auto px-4 py-24">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">From upload to interview-ready in minutes</h2>
          </div>
        </FadeIn>
        <div className="space-y-4">
          {[
            {
              badge: '⚙', badgeBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
              title: 'Grab your free API key — 2 min',
              desc: 'Sign up at console.groq.com (no credit card). Create a key, paste it in. Done. Your resume goes directly to AI — never through any server we own.',
              note: '🔒 That\'s why it\'s private.',
              link: true,
            },
            {
              badge: '1', badgeBg: 'bg-gradient-to-br from-blue-500 to-blue-400',
              title: 'Drop your resume',
              desc: 'Upload your PDF. We scan it instantly — score your resume health, spot weak spots, and show you exactly what needs fixing.',
            },
            {
              badge: '2', badgeBg: 'bg-gradient-to-br from-violet-500 to-purple-500',
              title: 'Paste the job posting',
              desc: 'From LinkedIn, Indeed, anywhere. We auto-read the role, company, and must-have skills in seconds.',
            },
            {
              badge: '3', badgeBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
              title: 'Get your resume — apply with confidence',
              desc: 'AI rewrites every bullet for this exact role. Edit, check quality, pick a template, download. Done.',
            },
          ].map(({ badge, badgeBg, title, desc, note, link }, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="flex gap-5 bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all">
                <div className={`w-11 h-11 rounded-xl ${badgeBg} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg mt-0.5`}>
                  {badge}
                </div>
                <div>
                  <p className="text-white font-semibold mb-1.5">{title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  {note && <p className="text-amber-400/80 text-xs mt-2">{note}</p>}
                  {link && (
                    <a
                      href="https://console.groq.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 underline transition-colors"
                    >
                      Open Groq Console →
                    </a>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-900/30 border-y border-slate-800 py-24">
        <div className="max-w-4xl mx-auto px-4">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">What you get</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">16 AI tools. One free product.</h2>
              <p className="text-slate-400">Everything you need to go from application to offer — all in your browser.</p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🎯', border: 'hover:border-blue-500/30 hover:shadow-blue-500/5', title: 'See your chances instantly', desc: 'Match score tells you how well you fit before you apply.' },
              { icon: '🔑', border: 'hover:border-violet-500/30 hover:shadow-violet-500/5', title: 'Spot every missing keyword', desc: 'Green = got it · Amber = close · Red = missing. One glance.' },
              { icon: '✍️', border: 'hover:border-emerald-500/30 hover:shadow-emerald-500/5', title: 'AI rewrites it for the role', desc: 'Every bullet, your summary, your skills — rebuilt for this exact job.' },
              { icon: '⚡', border: 'hover:border-amber-500/30 hover:shadow-amber-500/5', title: 'Fix weak writing instantly', desc: 'Kills passive voice, weak verbs, and filler. One click.' },
              { icon: '📄', border: 'hover:border-rose-500/30 hover:shadow-rose-500/5', title: 'Download a beautiful PDF', desc: '3 clean templates. Edit anything. Download. Done.' },
              { icon: '🎤', border: 'hover:border-teal-500/30 hover:shadow-teal-500/5', title: 'Nail the interview', desc: '10 role-specific questions, STAR tips, cover letter, and LinkedIn bio — all generated.' },
              { icon: '💾', border: 'hover:border-indigo-500/30 hover:shadow-indigo-500/5', title: 'Save every version', desc: 'One resume per company. Reload and re-tailor anytime.' },
              { icon: '📋', border: 'hover:border-cyan-500/30 hover:shadow-cyan-500/5', title: 'Track every application', desc: 'Log it, update stages, get AI follow-up emails, see your stats.' },
            ].map(({ icon, border, title, desc }, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className={`group bg-slate-900 border border-slate-800 ${border} rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                  <div className="text-2xl mb-3">{icon}</div>
                  <p className="text-white text-sm font-semibold mb-1.5 leading-snug">{title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Who it's for</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Built for every job seeker</h2>
            <p className="text-slate-400 text-sm">Tell us your situation — the AI changes its entire approach for you.</p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {[
            { emoji: '🎓', label: 'Fresh Graduates',      labelColor: 'text-blue-400',    border: 'hover:border-blue-500/30',    desc: 'Internships and projects become power bullets. Education leads. No penalty for short history.' },
            { emoji: '🔄', label: 'Career Switchers',     labelColor: 'text-violet-400',  border: 'hover:border-violet-500/30',  desc: 'Your old experience maps into new-field language. Your past is an asset, not a liability.' },
            { emoji: '⏸️', label: 'Employment Gap',       labelColor: 'text-amber-400',   border: 'hover:border-amber-500/30',   desc: 'Gaps get framed professionally. Focus stays on what you bring today.' },
            { emoji: '👔', label: 'Senior / Executive',   labelColor: 'text-emerald-400', border: 'hover:border-emerald-500/30', desc: 'Leadership-first format. Executive summary, scope signals, early roles trimmed.' },
            { emoji: '💼', label: 'Freelance / Contract', labelColor: 'text-orange-400',  border: 'hover:border-orange-500/30',  desc: 'Contracts grouped as "Independent Consultant". Impact over client count. No job-hopping optics.' },
            { emoji: '✏️', label: 'No Resume Yet',        labelColor: 'text-rose-400',    border: 'hover:border-rose-500/30',    desc: 'Fill in a simple form — we build your first resume and tailor it on the spot.' },
          ].map(({ emoji, label, labelColor, border, desc }, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className={`bg-slate-900 border border-slate-800 ${border} rounded-2xl p-5 transition-all hover:shadow-lg h-full`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{emoji}</span>
                  <span className={`${labelColor} font-semibold text-sm`}>{label}</span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="border-y border-slate-800 bg-slate-900/30">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { icon: '🔒', title: 'Browser-only', desc: 'Your resume never leaves your device' },
              { icon: '🆓', title: 'Free forever', desc: 'Bring your own free Groq key' },
              { icon: '🚫', title: 'No account needed', desc: 'No email, no signup, no tracking' },
              { icon: '🛡️', title: 'Zero data storage', desc: 'No server. Nothing is ever stored.' },
            ].map(({ icon, title, desc }, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div>
                  <div className="text-2xl mb-2">{icon}</div>
                  <p className="text-white text-sm font-semibold mb-1">{title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-2xl mx-auto px-4 py-24">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-white">Questions answered</h2>
          </div>
        </FadeIn>
        <div className="space-y-3">
          {[
            { q: 'Is this really free?', a: 'Yes, completely. Bring your own Groq API key (free, no credit card). Across 4 AI models you get ~80 full resume rewrites per day. We charge nothing, ever.' },
            { q: 'What is a Groq API key and how do I get one?', a: (<>A free key that unlocks fast AI. Go to <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline transition-colors">console.groq.com</a>, sign up (no credit card), hit &quot;API Keys&quot; → &quot;Create&quot;. Takes 2 minutes. Paste it in once — done.</>) },
            { q: 'Is my resume safe?', a: 'Nobody except you sees it. Your resume goes from your browser directly to Groq\'s AI — never through any server we own. We have no database, no backend.' },
            { q: 'My resume is a Word file. Can I use this?', a: 'PDF only for now. Open your Word doc → File → Save as PDF. Takes 10 seconds.' },
            { q: 'How is this different from Jobscan or Rezi?', a: 'Those charge monthly and store your data. This is free, no account, runs in your browser, and has more tools — interview prep, cover letters, job tracker, quality checks.' },
            { q: 'Does it work on mobile?', a: 'Yes. For uploading and editing in detail, a laptop is better — but everything works on mobile.' },
            { q: 'I\'m getting a "503" or overloaded error.', a: 'Not broken — Groq\'s free tier gets busy sometimes. Wait 30 seconds, hit Try again. Always resolves.' },
          ].map((item, i) => (
            <FadeIn key={i} delay={i * 50}>
              <FAQItem {...item} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative overflow-hidden border-t border-slate-800 py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-emerald-950/30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 text-center">
          <FadeIn>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-5">Ready to get shortlisted?</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
              Your next application
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                deserves better
              </span>
            </h2>
            <p className="text-slate-400 text-base mb-10 leading-relaxed">
              Stop sending the same resume to every job. Tailor it, fix it, and apply with confidence.
            </p>
            <button
              onClick={onStart}
              className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold px-12 py-4 rounded-xl text-base transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20"
            >
              Tailor My Resume — Free
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <p className="text-slate-600 text-xs mt-4">No account · No credit card · Free forever</p>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 py-6 text-center">
        <p className="text-slate-700 text-xs">Built with care · Runs entirely in your browser · No data stored · No tracking</p>
      </footer>

    </div>
  )
}
