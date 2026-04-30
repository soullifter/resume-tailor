import { useState, useEffect, useRef, useMemo } from 'react'
import StepLayout from './StepLayout'
import { geminiJSON, geminiScore, checkInjection } from '../utils/groq'
import { analysisPrompt, generationPrompt, scorePrompt } from '../utils/prompts'

// ── Styles ──────────────────────────────────────────────────────────────────

const ANALYZE_STYLES = `
@keyframes stage-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes score-count-glow {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
@keyframes verdict-up {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes card-stagger {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes kw-bounce-in {
  0%   { opacity: 0; transform: scale(0.5) translateX(-6px); }
  65%  { transform: scale(1.12) translateX(2px); }
  100% { opacity: 1; transform: scale(1) translateX(0); }
}
@keyframes gen-btn-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
  50%       { box-shadow: 0 0 18px 4px rgba(16,185,129,0.28); }
}
@keyframes gen-item-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes gen-new-text {
  from { opacity: 0; max-width: 0; }
  to   { opacity: 1; max-width: 100%; }
}
@keyframes kw-float-in {
  from { opacity: 0; transform: translateY(12px) scale(0.75); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toast-slide-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes confetti-burst {
  0%   { opacity: 1; transform: translate(0,0) rotate(0deg) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.5); }
}
@keyframes progress-creep {
  from { width: 0%; }
  to   { width: var(--w); }
}
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  18%       { transform: translateX(-7px); }
  36%       { transform: translateX(7px); }
  54%       { transform: translateX(-4px); }
  72%       { transform: translateX(4px); }
  90%       { transform: translateX(-2px); }
}
`

// ── Helper components ────────────────────────────────────────────────────────

function CountUpNumber({ target, duration = 1100, className = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <span className={className}>{val}</span>
}

function ConfettiBurst({ active }) {
  const pieces = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    color: ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'][i % 6],
    dx: (Math.random() - 0.5) * 140,
    dy: -(Math.random() * 90 + 30),
    rot: Math.random() * 720 - 360,
    size: Math.random() * 7 + 4,
    delay: Math.random() * 250,
  })), [])
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      {pieces.map(p => (
        <div key={p.id} className="absolute rounded-sm"
          style={{
            left: '50%', top: '40%',
            width: p.size, height: p.size,
            background: p.color,
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
            animation: `confetti-burst 0.85s ease-out ${p.delay}ms both`,
          }}
        />
      ))}
    </div>
  )
}

// 4-stage analysis cinematic
const ANALYSIS_STAGES = [
  'Reading your resume',
  'Scanning the job posting',
  'Finding your keywords',
  'Calculating your match',
]
function AnalysisCinematic() {
  const [active, setActive]   = useState(0)
  const [done, setDone]       = useState([])
  useEffect(() => {
    const timers = ANALYSIS_STAGES.map((_, i) =>
      i === 0 ? null : setTimeout(() => {
        setDone(d => [...d, i - 1])
        setActive(i)
      }, i * 900)
    )
    return () => timers.forEach(t => t && clearTimeout(t))
  }, [])
  return (
    <div className="space-y-3 py-3 px-1">
      {ANALYSIS_STAGES.map((stage, i) => {
        const isDone   = done.includes(i)
        const isActive = active === i && !isDone
        return (
          <div key={i} className="flex items-center gap-3"
            style={{ animation: `stage-in 0.35s ease-out ${i * 120}ms both` }}>
            {isDone ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
                <circle cx="9" cy="9" r="8" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.12)" />
                <path d="M5.5 9.5l2.5 2.5 4.5-4.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : isActive ? (
              <span className="relative flex h-[18px] w-[18px] shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex h-[18px] w-[18px] rounded-full border border-blue-400 bg-blue-500/20 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                </span>
              </span>
            ) : (
              <span className="h-[18px] w-[18px] rounded-full border border-slate-700 bg-slate-800/60 shrink-0" />
            )}
            <span className={`text-sm transition-colors duration-400 ${isDone ? 'text-emerald-400' : isActive ? 'text-white font-medium' : 'text-slate-600'}`}>
              {stage}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Generation cinematic — the big show
const GEN_PHASES = [
  { id: 'bullets',  label: 'Rewriting your bullets...',   icon: '✍️' },
  { id: 'keywords', label: 'Weaving in keywords...',       icon: '🔑' },
  { id: 'summary',  label: 'Crafting your summary...',     icon: '📝' },
  { id: 'skills',   label: 'Polishing your skills...',     icon: '⚡' },
  { id: 'final',    label: 'Final touches...',             icon: '✨' },
]
const FAKE_OLD = ['Worked on frontend tasks', 'Helped with team deliverables', 'Assisted with product features', 'Managed various projects']
const FAKE_NEW = ['Built React dashboard cutting load by 40%', 'Led 6-engineer cross-functional team', 'Shipped 3 features ahead of schedule', 'Architected TypeScript migration (50K LOC)']
const FAKE_KWS = ['React', 'TypeScript', 'Leadership', 'CI/CD', 'GraphQL', 'Agile', 'Python', 'AWS']
const FAKE_SKILLS = ['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL', 'Python', 'Docker', 'Agile']

function GenerationCinematic() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const DURATIONS = [3800, 3200, 2800, 2800, 99999]
    let idx = 0
    const advance = () => {
      if (idx < GEN_PHASES.length - 1) {
        idx++
        setPhaseIdx(idx)
        setTimeout(advance, DURATIONS[idx])
      }
    }
    const t = setTimeout(advance, DURATIONS[0])
    return () => clearTimeout(t)
  }, [])

  // Slowly creep progress bar in final phase
  useEffect(() => {
    if (phaseIdx !== GEN_PHASES.length - 1) return
    let p = 0
    const iv = setInterval(() => {
      p = Math.min(p + (Math.random() * 1.5 + 0.5), 92)
      setProgress(p)
    }, 300)
    return () => clearInterval(iv)
  }, [phaseIdx])

  const phase = GEN_PHASES[phaseIdx]

  return (
    <div className="px-5 pb-5 pt-2 space-y-4">
      {/* Phase label */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <p key={phaseIdx} className="text-white text-sm font-medium" style={{ animation: 'stage-in 0.3s ease-out both' }}>
          {phase.icon} {phase.label}
        </p>
      </div>

      {/* Phase visual */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 min-h-[88px] overflow-hidden">
        {phaseIdx === 0 && (
          <div className="space-y-2.5">
            {FAKE_OLD.map((old, i) => (
              <div key={i} className="space-y-0.5" style={{ animation: `gen-item-in 0.35s ease-out ${i * 180}ms both` }}>
                <p className="text-sm text-slate-600 line-through leading-snug">{old}</p>
                <p className="text-sm text-emerald-400 leading-snug overflow-hidden whitespace-nowrap"
                  style={{ animation: `gen-new-text 0.7s ease-out ${i * 180 + 400}ms both` }}>
                  → {FAKE_NEW[i]}
                </p>
              </div>
            ))}
          </div>
        )}
        {phaseIdx === 1 && (
          <div className="flex flex-wrap gap-1.5">
            {FAKE_KWS.map((kw, i) => (
              <span key={kw}
                className="px-2.5 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm rounded-full font-medium"
                style={{ animation: `kw-float-in 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 140}ms both` }}>
                ✓ {kw}
              </span>
            ))}
          </div>
        )}
        {phaseIdx === 2 && (
          <div className="space-y-2">
            <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400/60 rounded-full" style={{ animation: 'progress-creep 1.2s ease-out both', '--w': '85%' }} />
            </div>
            <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400/60 rounded-full" style={{ animation: 'progress-creep 1.4s ease-out 0.2s both', '--w': '65%' }} />
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed overflow-hidden whitespace-nowrap"
              style={{ animation: 'gen-new-text 1.8s ease-out 0.4s both' }}>
              Results-driven engineer with 5+ years building scalable systems...
            </p>
            <p className="text-sm text-slate-500 leading-relaxed overflow-hidden whitespace-nowrap"
              style={{ animation: 'gen-new-text 1.8s ease-out 1.2s both' }}>
              Proven track record of delivering high-impact features at scale...
            </p>
          </div>
        )}
        {phaseIdx === 3 && (
          <div className="flex flex-wrap gap-1.5">
            {FAKE_SKILLS.map((sk, i) => (
              <span key={sk}
                className="px-2 py-1 bg-slate-700 border border-slate-600 text-slate-300 text-sm rounded-lg font-medium"
                style={{ animation: `kw-float-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 100}ms both` }}>
                {sk}
              </span>
            ))}
          </div>
        )}
        {phaseIdx === 4 && (
          <div className="space-y-3 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Building your resume...</span>
              <span className="text-white font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 text-center">Almost there — polishing every line...</p>
          </div>
        )}
      </div>

      {/* Completed stages mini-list */}
      <div className="flex gap-3 flex-wrap">
        {GEN_PHASES.slice(0, phaseIdx).map(p => (
          <span key={p.id} className="text-sm text-emerald-500/70 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4.5" stroke="#10b981" strokeWidth="1" fill="rgba(16,185,129,0.15)" />
              <path d="M3 5.5l1.5 1.5 2.5-3" stroke="#10b981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {p.label.replace('...', '')}
          </span>
        ))}
      </div>
    </div>
  )
}

function MatchScoreRing({ score }) {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const glowColor = score >= 75 ? 'rgba(16,185,129,0.2)' : score >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
  const label = score >= 75 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match'
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative w-20 h-20" style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}>
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="7" />
          <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <CountUpNumber target={score} className="text-xl font-bold text-white" />
          <span className="text-sm font-bold text-white">%</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

const verdictConfig = {
  yes:        { label: 'Apply with confidence', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  borderline: { label: 'Worth a shot',          bg: 'bg-amber-500/10 border-amber-500/30',    text: 'text-amber-400',   dot: 'bg-amber-400'   },
  no:         { label: 'Big gap',               bg: 'bg-red-500/10 border-red-500/20',        text: 'text-red-400',     dot: 'bg-red-400'     },
}

export default function StepAnalyzeGenerate({
  apiKey, resumeText, jobDescription,
  userMode = 'standard',
  jobInfo, healthScore,
  onNext, onBack, onResumeGenerated, onMatchScore, onTailoredScore, onOpenSettings
}) {
  const [phase, setPhase] = useState('idle')
  const [analysis, setAnalysis] = useState(null)
  const [atsScore, setAtsScore] = useState(null)
  const [error, setError] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => { runAnalysis() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runAnalysis() {
    setPhase('analyzing')
    setError('')
    try {
      const { prompt, temperature, maxOutputTokens } = analysisPrompt(resumeText, jobDescription, userMode, jobInfo, healthScore)
      const { prompt: sp, temperature: st, maxOutputTokens: sm } = scorePrompt(resumeText, jobDescription, userMode)

      // Run both in parallel
      const [result, ats] = await Promise.all([
        geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }),
        geminiScore(apiKey, sp, { temperature: st, maxOutputTokens: sm }).catch(() => null),
      ])

      setAnalysis(result)
      setAtsScore(ats)
      onMatchScore?.(ats)  // ATS before score → used for before/after comparison on download page
      setPhase('analyzed')
    } catch (e) {
      setPhase('error')
      setError(`Analysis failed: ${e.message}`)
    }
  }

  async function runGeneration() {
    setPhase('generating')
    setError('')
    try {
      // Injection check on custom instructions (non-blocking fail open)
      if (customInstructions.trim()) {
        const unsafe = await checkInjection(apiKey, customInstructions)
        if (unsafe) {
          setPhase('error')
          setError('Custom instructions contain disallowed content. Keep instructions focused on resume style and preferences.')
          return
        }
      }
      const { prompt, temperature, maxOutputTokens } = generationPrompt(resumeText, jobDescription, analysis, userMode, jobInfo, customInstructions)
      const resume = await geminiJSON(apiKey, prompt, { temperature, maxOutputTokens })
      const tailoredText = [
        resume.summary,
        resume.experience?.map(e => [e.title, e.company, ...(e.bullets || [])].join(' ')).join(' '),
        resume.skills?.join(' ')
      ].filter(Boolean).join('\n')
      const { prompt: sp, temperature: st, maxOutputTokens: sm } = scorePrompt(tailoredText, jobDescription, userMode)
      geminiScore(apiKey, sp, { temperature: st, maxOutputTokens: sm })
        .then(score => onTailoredScore?.(score))
        .catch(() => {})
      // Strip trailing periods from all bullets (resume convention)
      const stripDots = arr => (arr || []).map(b => typeof b === 'string' ? b.replace(/\.+$/, '') : b)
      const cleaned = {
        ...resume,
        experience: (resume.experience || []).map(e => ({ ...e, bullets: stripDots(e.bullets) })),
        projects:   (resume.projects   || []).map(p => ({ ...p, bullets: stripDots(p.bullets) })),
        extraSections: (resume.extraSections || []).map(s => ({ ...s, items: stripDots(s.items) })),
      }
      setPhase('done')
      onResumeGenerated(cleaned)
      setShowToast(true)
      setShowConfetti(true)
      setTimeout(() => setShowToast(false), 4000)
      setTimeout(() => setShowConfetti(false), 1200)
    } catch (e) {
      setPhase('error')
      setError(`Generation failed: ${e.message}`)
    }
  }

  const analyzed = phase === 'analyzed' || phase === 'generating' || phase === 'done' || (phase === 'error' && analysis !== null)
  const verdict  = analysis ? (verdictConfig[analysis.worthApplying] || verdictConfig.borderline) : null

  return (
    <StepLayout
      step={3} totalSteps={3}
      title={phase === 'done' ? 'Resume ready!' : 'Analyzing & tailoring'}
      subtitle={
        phase === 'analyzing'  ? 'Comparing your resume against the job...' :
        phase === 'analyzed'   ? 'Review below, then generate your tailored resume.' :
        phase === 'generating' ? 'Rebuilding your resume for this job...' :
        phase === 'done'       ? 'Tailored and ready to download.' :
        "We'll find gaps first, then rewrite your resume."
      }
      onBack={onBack}
      onOpenSettings={onOpenSettings}
      onNext={phase === 'done' ? onNext : undefined}
      nextLabel="View & Download →"
      hideNext={phase !== 'done'}
    >
      <style>{ANALYZE_STYLES}</style>

      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5"
          style={{ animation: 'toast-slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <span>⚡</span> Resume ready!
        </div>
      )}

      <div className="space-y-4">

        {/* ── Step 1: Analyze ── */}
        <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${analyzed ? 'border-emerald-500/30' : 'border-slate-700'}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${analyzed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                {analyzed ? '✓' : '1'}
              </div>
              <span className="text-white text-sm font-medium">Analyze resume</span>
            </div>
          </div>

          {phase === 'analyzing' && (
            <div className="px-5 pb-4">
              <AnalysisCinematic />
            </div>
          )}

          {/* Analysis results */}
          {analyzed && analysis && (
            <div className="border-t border-slate-800 px-5 py-4 space-y-5">

              {/* Scores row */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex gap-5 shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <MatchScoreRing score={analysis.matchScore ?? 0} />
                    <span className="text-slate-500 text-sm">Profile Fit</span>
                  </div>
                  {atsScore !== null && (
                    <div className="flex flex-col items-center gap-1">
                      <MatchScoreRing score={atsScore} />
                      <span className="text-slate-500 text-sm">ATS Score</span>
                      <span className="text-slate-600 text-sm">keyword match ↓</span>
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  {verdict && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${verdict.bg} ${verdict.text}`}
                      style={{ animation: 'verdict-up 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`} />
                      {verdict.label}
                    </div>
                  )}
                  {analysis.worthApplyingReason && (
                    <p className="text-slate-300 text-sm leading-relaxed">{analysis.worthApplyingReason}</p>
                  )}
                  {analysis.summary && (
                    <p className="text-slate-400 text-sm leading-relaxed">{analysis.summary}</p>
                  )}
                </div>
              </div>

              {/* Strengths */}
              {analysis.strengths?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">What's working</p>
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="flex gap-2 text-sm bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2"
                      style={{ animation: `card-stagger 0.4s ease-out ${i * 80}ms both` }}>
                      <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                      <div>
                        <span className="text-emerald-300 font-medium">{s.strength}</span>
                        {s.why && <span className="text-slate-400"> — {s.why}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fixable gaps */}
              {analysis.fixableGaps?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">What we'll fix</p>
                  {analysis.fixableGaps.map((g, i) => (
                    <div key={i} className="flex gap-2 text-sm bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2"
                      style={{ animation: `card-stagger 0.4s ease-out ${i * 80}ms both` }}>
                      <span className="text-amber-400 shrink-0 mt-0.5">~</span>
                      <div>
                        <span className="text-amber-300 font-medium">{g.gap}</span>
                        {g.fix && <p className="text-slate-400 mt-0.5">{g.fix}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hard gaps */}
              {analysis.hardGaps?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">What to work on</p>
                  {analysis.hardGaps.map((g, i) => (
                    <div key={i} className="flex gap-2 text-sm bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2"
                      style={{ animation: `card-stagger 0.4s ease-out ${i * 80}ms both` }}>
                      <span className="text-red-400 shrink-0 mt-0.5">✗</span>
                      <div>
                        <span className="text-red-300 font-medium">{g.gap}</span>
                        {g.toClose && <p className="text-slate-400 mt-0.5">To close: {g.toClose}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Application tip */}
              {analysis.applicationTip && (
                <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2.5">
                  <span className="text-blue-400 shrink-0 text-sm">💡</span>
                  <div>
                    <p className="text-blue-300 text-sm font-semibold mb-0.5">Application tip</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{analysis.applicationTip}</p>
                  </div>
                </div>
              )}

              {/* Keyword coverage */}
              {((analysis.presentKeywords?.length ?? 0) + (analysis.partialKeywords?.length ?? 0) + (analysis.missingKeywords?.length ?? 0)) > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Keyword Coverage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.presentKeywords?.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm rounded-full"
                        style={{ animation: `kw-bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 35}ms both` }}>✓ {kw}</span>
                    ))}
                    {analysis.partialKeywords?.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm rounded-full"
                        style={{ animation: `kw-bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${((analysis.presentKeywords?.length ?? 0) + i) * 35}ms both` }}>~ {kw}</span>
                    ))}
                    {analysis.missingKeywords?.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-full"
                        style={{ animation: `kw-bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${((analysis.presentKeywords?.length ?? 0) + (analysis.partialKeywords?.length ?? 0) + i) * 35}ms both` }}>✗ {kw}</span>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Present</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Partial</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Missing</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step 2: Generate ── */}
        {analyzed && (
          <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${
            phase === 'done'     ? 'border-emerald-500/30' :
            phase === 'analyzed' ? 'border-blue-500/30'    : 'border-slate-700'
          }`}>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${phase === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {phase === 'done' ? '✓' : '2'}
                </div>
                <div className="min-w-0">
                  <span className="text-white text-sm font-medium">Generate tailored resume</span>
                  {phase === 'analyzed' && (
                    <p className="text-slate-500 text-sm mt-0.5">Rewrites every bullet, summary & skills for this JD</p>
                  )}
                </div>
              </div>
              {(phase === 'analyzed' || phase === 'error') && analysis && (
                <button
                  onClick={runGeneration}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-95"
                  style={{ animation: phase === 'analyzed' ? 'gen-btn-glow 2.5s ease-in-out infinite' : 'none' }}
                >
                  {phase === 'error' ? 'Retry' : 'Generate Resume →'}
                </button>
              )}
              {phase === 'done' && <span className="shrink-0 text-emerald-400 text-sm font-medium">Complete</span>}
            </div>

            {/* Priority actions */}
            {(phase === 'analyzed' || phase === 'error') && analysis?.priorityActions?.length > 0 && (
              <div className="border-t border-slate-800 px-5 py-3 space-y-2">
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Top priorities for this rewrite</p>
                {analysis.priorityActions.map((action, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Custom instructions */}
            {(phase === 'analyzed' || phase === 'error') && analysis && (
              <div className="border-t border-slate-800 px-5 py-3">
                {!showInstructions ? (
                  <button
                    onClick={() => setShowInstructions(true)}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    + Add instructions for the AI
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400 font-medium">Instructions for the AI</p>
                      <button onClick={() => setShowInstructions(false)} className="text-slate-600 hover:text-slate-400 text-sm transition-colors">✕</button>
                    </div>
                    <textarea
                      value={customInstructions}
                      onChange={e => setCustomInstructions(e.target.value.slice(0, 300))}
                      placeholder={'e.g. "Focus on my leadership experience" · "Keep it to 1 page" · "I\'m applying as an internal transfer"'}
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                    />
                    <p className="text-slate-600 text-sm text-right">{customInstructions.length}/300</p>
                  </div>
                )}
              </div>
            )}

            {phase === 'generating' && <GenerationCinematic />}

            {phase === 'done' && (
              <div className="relative border-t border-slate-800 px-5 py-4 overflow-visible">
                <ConfettiBurst active={showConfetti} />
                <div className="flex items-center gap-2.5"
                  style={{ animation: 'verdict-up 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.12)" />
                    <path d="M6 10.5l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-emerald-400 text-sm font-semibold">Resume rebuilt — every bullet optimized for this role.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
            style={{ animation: 'error-shake 0.55s ease-out both' }}>
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={analysis ? runGeneration : runAnalysis} className="text-red-400 underline text-sm mt-2">Try again</button>
          </div>
        )}

      </div>
    </StepLayout>
  )
}
