import { useEffect, useState, useRef } from 'react'
import { geminiJSON } from '../utils/groq'
import { healthScorePrompt } from '../utils/prompts'

async function analyzeHealth(apiKey, resumeText, userMode) {
  const { prompt, temperature, maxOutputTokens } = healthScorePrompt(resumeText, userMode)
  return geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }, true)
}

function computeScore(c) {
  let score = 0

  // CONTACT (10pts)
  if (c.contact.hasName)               score += 1
  if (c.contact.hasEmail)              score += 2
  if (c.contact.hasPhone)              score += 2
  if (c.contact.hasLocation)           score += 2
  if (c.contact.hasLinkedin)           score += 2
  if (c.contact.hasPortfolioOrGithub)  score += 1

  // SUMMARY (13pts)
  if (c.summary.present)               score += 3
  if (c.summary.hasSpecificRole)       score += 3
  if (c.summary.hasValueProposition)   score += 4
  if (c.summary.appropriateLength)     score += 2
  if (c.summary.isTooGeneric)          score -= 2

  // EXPERIENCE STRUCTURE (10pts)
  if (c.experience.present)                  score += 2
  if (c.experience.allRolesHaveDates)        score += 3
  if (c.experience.allRolesHaveTitle)        score += 2
  if (c.experience.allRolesHaveCompany)      score += 2
  if (c.experience.showsCareerProgression)   score += 1

  // BULLET QUALITY (42pts — most important)
  const metricMap  = { none: 0, low: 8, some: 18, good: 30, strong: 42 }
  const weakMap    = { none: 0, few: -5, some: -12, many: -20 }
  const arMap      = { none: 0, low: 0, some: 4, most: 8, all: 8 }
  const bulletsMap = { low: 0, fair: 2, good: 5, high: 3 }
  const lengthMap  = { too_short: 0, mixed: 1, good: 3, too_long: 0 }

  score += metricMap[c.experience.metricRatio]          ?? 0
  score += weakMap[c.experience.weakVerbRatio]           ?? 0
  score += arMap[c.experience.actionResultRatio]         ?? 0
  score += bulletsMap[c.experience.avgBulletsPerRole]    ?? 0
  score += lengthMap[c.experience.bulletLengthQuality]   ?? 0
  if (c.experience.hasRepetitivePhrases)  score -= 3

  // SKILLS (8pts)
  if (c.skills.present)                  score += 3
  if (c.skills.hasSpecificSkills)        score += 3
  if (c.skills.isOrganized)             score += 1
  if (c.skills.skillCount === 'good')    score += 1

  // EDUCATION (5pts)
  if (c.education.present)               score += 3
  if (c.education.isComplete)            score += 2

  // WRITING (9pts)
  const passiveMap = { none: 4, few: 2, many: 0 }
  const fillerMap  = { none: 3, few: 1, many: 0 }
  score += passiveMap[c.writing.passiveVoice] ?? 0
  score += fillerMap[c.writing.fillerPhrases]  ?? 0
  if (c.writing.consistentFormatting)    score += 2

  // WORD COUNT (5pts)
  const wcMap = { sparse: 0, light: 2, good: 4, full: 5, long: 3 }
  score += wcMap[c.writing.wordCount] ?? 0

  return Math.min(98, Math.max(5, score))
}

const HEALTH_STYLES = `
@keyframes health-ring-glow {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
@keyframes health-score-in {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
`

function ScoreRing({ score }) {
  const [display, setDisplay]   = useState(0)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const start = performance.now()
    const dur = 1300
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1)
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * score))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [mounted, score])

  // Color tracks the live display value so it shifts as the number climbs
  const color = display >= 80 ? '#10b981' : display >= 60 ? '#f59e0b' : '#ef4444'
  const glowColor = display >= 80 ? 'rgba(16,185,129,0.22)' : display >= 60 ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.22)'
  const label = score >= 80 ? 'Strong' : score >= 60 ? 'Needs Work' : 'Weak'
  const circumference = 2 * Math.PI * 28
  const offset = mounted ? circumference - (score / 100) * circumference : circumference

  return (
    <>
      <style>{HEALTH_STYLES}</style>
      <div className="flex flex-col items-center" style={{ animation: 'health-score-in 0.4s ease-out both' }}>
        <div className="relative w-20 h-20" style={{ filter: `drop-shadow(0 0 8px ${glowColor})`, animation: 'health-ring-glow 2s ease-in-out infinite 1.5s' }}>
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{display}</span>
          </div>
        </div>
        <span className="text-sm font-medium mt-1 transition-colors duration-300" style={{ color }}>{label}</span>
      </div>
    </>
  )
}

export default function ResumeHealthScore({ apiKey, resumeText, onScoreReady, userMode = 'standard' }) {
  const [status, setStatus]   = useState('loading')
  const [data, setData]       = useState(null)
  const [score, setScore]     = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [errMsg, setErrMsg]   = useState('')

  function runAnalysis() {
    if (!resumeText || !apiKey) return
    setStatus('loading')
    setErrMsg('')
    analyzeHealth(apiKey, resumeText, userMode)
      .then(result => {
        const s = computeScore(result)
        setData(result)
        setScore(s)
        setStatus('done')
        onScoreReady?.(s)
      })
      .catch(e => { setErrMsg(e.message || 'Health score check failed.'); setStatus('error') })
  }

  useEffect(() => { runAnalysis() }, [resumeText, apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'error') return (
    <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="text-red-400 text-sm shrink-0">⚠</span>
          <span className="text-red-400 text-sm">{errMsg || 'Health score check failed.'}</span>
        </div>
        <button
          onClick={runAnalysis}
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Try again
        </button>
      </div>
    </div>
  )

  if (status === 'loading') return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
      </span>
      <span className="text-slate-400 text-sm">Scoring your resume...</span>
    </div>
  )

  if (!data || score === null) return null

  const extraSections = data.extraSections?.filter(Boolean) ?? []

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold mb-1">Resume Quality Score</p>
          <p className="text-slate-400 text-sm leading-relaxed">{data.verdict}</p>
          {extraSections.length > 0 && (
            <p className="text-slate-500 text-sm mt-1">
              Also includes: {extraSections.join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-500 hover:text-slate-300 text-sm underline shrink-0 transition-colors"
        >
          {expanded ? 'Less' : 'Details'}
        </button>
      </div>

      {/* Quick weaknesses — show top 2 as readable lines, not pills */}
      {!expanded && data.weaknesses?.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {data.weaknesses.slice(0, 2).map((w, i) => (
            <div key={i} className="flex gap-2 text-sm text-amber-400">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">

          {/* Score breakdown */}
          <div>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Breakdown</p>
            <div className="space-y-2.5">
              {[
                { label: 'Contact Info',         max: 10, val: scoreContact(data),       hint: getContactHint(data) },
                { label: 'Summary',              max: 13, val: scoreSummary(data),       hint: getSummaryHint(data) },
                { label: 'Experience Structure', max: 10, val: scoreExpStructure(data),  hint: getExpStructureHint(data) },
                { label: 'Bullet Quality',       max: 42, val: scoreBullets(data),       hint: getBulletHint(data) },
                { label: 'Skills',               max: 8,  val: scoreSkills(data),        hint: getSkillsHint(data) },
                { label: 'Education',            max: 5,  val: scoreEducation(data),     hint: null },
                { label: 'Writing Quality',      max: 9,  val: scoreWriting(data),       hint: getWritingHint(data) },
                { label: 'Length',               max: 5,  val: scoreLength(data),        hint: getLengthHint(data) },
              ].map(({ label, max, val, hint }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400 text-sm w-36 shrink-0">{label}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, (val / max) * 100))}%` }}
                      />
                    </div>
                    <span className="text-slate-400 text-sm w-12 text-right shrink-0">{Math.min(max, Math.max(0, val))}/{max}</span>
                  </div>
                  {hint && <p className="text-amber-400/80 text-sm ml-36 pl-2">{hint}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          {data.strengths?.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Strengths</p>
              <ul className="space-y-1">
                {data.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-emerald-400">
                    <span className="shrink-0">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {data.weaknesses?.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">What to Fix</p>
              <ul className="space-y-1">
                {data.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-400">
                    <span className="shrink-0">⚠</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-scorers for breakdown bars ────────────────────────────────────────────
function scoreContact(c) {
  let s = 0
  if (c.contact.hasName)              s += 1
  if (c.contact.hasEmail)             s += 2
  if (c.contact.hasPhone)             s += 2
  if (c.contact.hasLocation)          s += 2
  if (c.contact.hasLinkedin)          s += 2
  if (c.contact.hasPortfolioOrGithub) s += 1
  return s
}
function scoreSummary(c) {
  let s = 0
  if (c.summary.present)              s += 3
  if (c.summary.hasSpecificRole)      s += 3
  if (c.summary.hasValueProposition)  s += 4
  if (c.summary.appropriateLength)    s += 2
  if (c.summary.isTooGeneric)         s -= 2
  return s
}
function scoreExpStructure(c) {
  let s = 0
  if (c.experience.present)                 s += 2
  if (c.experience.allRolesHaveDates)       s += 3
  if (c.experience.allRolesHaveTitle)       s += 2
  if (c.experience.allRolesHaveCompany)     s += 2
  if (c.experience.showsCareerProgression)  s += 1
  return s
}
function scoreBullets(c) {
  let s = 0
  const metricMap  = { none: 0, low: 8, some: 18, good: 30, strong: 42 }
  const weakMap    = { none: 0, few: -5, some: -12, many: -20 }
  const arMap      = { none: 0, low: 0, some: 4, most: 8, all: 8 }
  const bulletsMap = { low: 0, fair: 2, good: 5, high: 3 }
  const lengthMap  = { too_short: 0, mixed: 1, good: 3, too_long: 0 }
  s += metricMap[c.experience.metricRatio]        ?? 0
  s += weakMap[c.experience.weakVerbRatio]         ?? 0
  s += arMap[c.experience.actionResultRatio]       ?? 0
  s += bulletsMap[c.experience.avgBulletsPerRole]  ?? 0
  s += lengthMap[c.experience.bulletLengthQuality] ?? 0
  if (c.experience.hasRepetitivePhrases) s -= 3
  return Math.min(42, Math.max(0, s))
}
function scoreSkills(c) {
  let s = 0
  if (c.skills.present)               s += 3
  if (c.skills.hasSpecificSkills)     s += 3
  if (c.skills.isOrganized)           s += 1
  if (c.skills.skillCount === 'good') s += 1
  return s
}
function scoreEducation(c) {
  let s = 0
  if (c.education.present)    s += 3
  if (c.education.isComplete) s += 2
  return s
}
function scoreWriting(c) {
  const passiveMap = { none: 4, few: 2, many: 0 }
  const fillerMap  = { none: 3, few: 1, many: 0 }
  let s = (passiveMap[c.writing.passiveVoice] ?? 0) + (fillerMap[c.writing.fillerPhrases] ?? 0)
  if (c.writing.consistentFormatting) s += 2
  return s
}
function scoreLength(c) {
  const wcMap = { sparse: 0, light: 2, good: 4, full: 5, long: 3 }
  return wcMap[c.writing.wordCount] ?? 0
}

// ── Breakdown hints — shown under low-scoring bars ────────────────────────────
function getContactHint(c) {
  const missing = []
  if (!c.contact.hasEmail)             missing.push('email')
  if (!c.contact.hasPhone)             missing.push('phone')
  if (!c.contact.hasLocation)          missing.push('location')
  if (!c.contact.hasLinkedin)          missing.push('LinkedIn URL')
  if (!c.contact.hasPortfolioOrGithub) missing.push('GitHub/portfolio link')
  return missing.length ? `Add missing fields: ${missing.join(', ')}` : null
}
function getSummaryHint(c) {
  if (!c.summary.present) return 'Add a 2-3 sentence Professional Summary below your contact info'
  if (c.summary.isTooGeneric) return 'Your summary is too generic — mention your specific role, skills, and what you bring'
  if (!c.summary.hasValueProposition) return 'Strengthen your summary — say what value you bring to employers, not just your job title'
  if (!c.summary.hasSpecificRole) return 'Make your summary more specific — mention the type of role you target and your key skill area'
  return null
}
function getExpStructureHint(c) {
  if (!c.experience.present) return 'Add a Work Experience section with your roles'
  if (!c.experience.allRolesHaveDates) return 'Some roles are missing dates — add start and end dates to every position'
  if (!c.experience.allRolesHaveTitle || !c.experience.allRolesHaveCompany) return 'Some roles are missing job title or company name — fill in all fields for every position'
  return null
}
function getBulletHint(c) {
  const hints = []
  if (c.experience.metricRatio === 'none') hints.push('None of your bullets have metrics — add numbers, %, or $ amounts to show impact')
  else if (c.experience.metricRatio === 'low') hints.push('Few bullets have metrics — aim for at least half to include numbers or percentages')
  if (c.experience.weakVerbRatio === 'many' || c.experience.weakVerbRatio === 'some') hints.push('Many bullets start with weak phrases like "Responsible for" — rewrite with strong action verbs')
  if (c.experience.avgBulletsPerRole === 'low') hints.push('Add more bullets per role — aim for at least 3 per position')
  if (c.experience.actionResultRatio === 'none' || c.experience.actionResultRatio === 'low') hints.push('Bullets describe tasks but not outcomes — add the result or impact of each action')
  return hints[0] ?? null
}
function getSkillsHint(c) {
  if (!c.skills.present) return 'Add a dedicated Skills section listing your technical and domain skills'
  if (!c.skills.hasSpecificSkills) return 'Replace generic skills like "Communication" with specific technical skills relevant to your field'
  if (c.skills.skillCount === 'too_few') return 'Add more skills — you have fewer than 5 listed'
  if (c.skills.skillCount === 'too_many') return 'Too many skills listed — trim to the 15-20 most relevant and impactful ones'
  return null
}
function getWritingHint(c) {
  const hints = []
  if (c.writing.passiveVoice === 'many') hints.push('Many passive voice instances — rewrite so you are the subject performing the action')
  if (c.writing.fillerPhrases === 'many' || c.writing.fillerPhrases === 'few') hints.push('Remove filler phrases like "hardworking", "team player", "passionate about" — show don\'t tell')
  if (!c.writing.consistentFormatting) hints.push('Formatting is inconsistent — use the same date format, punctuation, and capitalization throughout')
  return hints[0] ?? null
}
function getLengthHint(c) {
  if (c.writing.wordCount === 'sparse') return 'Resume is very sparse — add more detail to your experience and skills sections'
  if (c.writing.wordCount === 'light') return 'Resume is a bit short — expand your bullet points with more context and outcomes'
  if (c.writing.wordCount === 'long') return 'Resume may be too long — trim weaker bullets to keep the most impactful content'
  return null
}
