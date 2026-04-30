import { useState, useEffect, useRef } from 'react'
import StepLayout from './StepLayout'
import { geminiJSON } from '../utils/groq'
import { jdParsePrompt } from '../utils/prompts'

async function parseJobInfo(apiKey, jd, resumeText) {
  const { prompt, temperature, maxOutputTokens } = jdParsePrompt(jd, resumeText)
  return geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }, true)
}

// ── JD auto-fetch ─────────────────────────────────────────────────────────────
const PROXY_URL = 'https://script.google.com/macros/s/AKfycbyX0WyiuiG86e2NDpoQnzSPj_ThW986bpK52m4GlFZ-vMSDo1RJ1P0GLGSHMvDnfZwWjg/exec'

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchJDFromUrl(url) {
  // LinkedIn: linkedin.com/jobs/view/{id} OR ?currentJobId={id}
  const liMatch = url.match(/linkedin\.com\/jobs\/view\/(\d+)/i)
    || url.match(/[?&]currentJobId=(\d+)/i)
  if (liMatch) {
    const jobId = liMatch[1]
    const proxied = `${PROXY_URL}?url=${encodeURIComponent(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`)}`
    const res = await fetch(proxied)
    const html = await res.text()
    const text = stripHtml(html)
    if (text.length < 100) throw new Error('Could not extract job description from LinkedIn')
    return text
  }

  // Greenhouse: boards.greenhouse.io/{company}/jobs/{id} or job-boards.greenhouse.io/...
  const ghMatch = url.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i)
  if (ghMatch) {
    const [, company, jobId] = ghMatch
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`)
    if (!res.ok) throw new Error('Could not fetch job from Greenhouse')
    const data = await res.json()
    const header = [data.title, data.location?.name].filter(Boolean).join(' · ')
    const body = stripHtml(data.content || '')
    const text = [header, body].filter(Boolean).join('\n\n')
    if (text.length < 100) throw new Error('Could not extract job description from Greenhouse')
    return text
  }

  throw new Error('URL not supported — try a LinkedIn or Greenhouse job URL')
}

const JD_STYLES = `
@keyframes jd-slide-spring {
  0%   { opacity: 0; transform: translateY(-14px) scale(0.97); }
  60%  { opacity: 1; transform: translateY(3px) scale(1.005); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes jd-msg-in {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes badge-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.18); }
  70%  { transform: scale(0.96); }
  100% { transform: scale(1); }
}
@keyframes chip-fly-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
`

const JD_PARSE_MESSAGES = [
  'Reading the job posting...',
  'Extracting requirements...',
  'Matching your skills...',
  'Finding the gaps...',
]

const seniorityColors = {
  Internship: 'text-slate-400 bg-slate-800 border-slate-600',
  Entry:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Mid:        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Senior:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Lead:       'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Director:   'text-purple-400 bg-purple-500/10 border-purple-500/20',
}

export default function StepJobDescription({ value, onChange, onNext, onBack, onOpenSettings, apiKey, resumeText, userMode, healthScore, onJobInfoParsed }) {
  const isReady = value.trim().length > 50
  const [jobInfo, setJobInfo]         = useState(null)
  const [parseStatus, setParseStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [parseError, setParseError]   = useState('')
  const [collapsed, setCollapsed]     = useState(false)
  const [focused, setFocused]         = useState(false)
  const [msgIdx, setMsgIdx]           = useState(0)
  const [msgVisible, setMsgVisible]   = useState(true)
  const debounceRef = useRef(null)
  const msgIntervalRef = useRef(null)

  // URL auto-fetch
  const [urlInput, setUrlInput]           = useState('')
  const [urlStatus, setUrlStatus]         = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [urlError, setUrlError]           = useState('')

  async function handleFetchUrl() {
    if (!urlInput.trim()) return
    setUrlStatus('loading')
    setUrlError('')
    try {
      const text = await fetchJDFromUrl(urlInput.trim())
      onChange(text)
      setUrlStatus('success')
    } catch (e) {
      setUrlError(e.message || 'Could not fetch job description')
      setUrlStatus('error')
    }
  }

  // Reset collapsed when user edits JD or clears it
  useEffect(() => {
    if (value.trim().length < 50) setCollapsed(false)
  }, [value])

  useEffect(() => {
    if (!apiKey || value.trim().length < 50) {
      setJobInfo(null)
      setParseStatus('idle')
      onJobInfoParsed?.(null)
      return
    }
    setParseStatus('loading')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      parseJobInfo(apiKey, value, resumeText)
        .then(info => { setJobInfo(info); setParseStatus('done'); setCollapsed(true); onJobInfoParsed?.(info) })
        .catch(e => { setParseError(e.message || 'Could not analyze JD. You can still proceed.'); setParseStatus('error') })
    }, 1200)
    return () => clearTimeout(debounceRef.current)
  }, [value, apiKey, resumeText])

  // Cycle loading messages while parsing
  useEffect(() => {
    if (parseStatus === 'loading') {
      setMsgIdx(0)
      setMsgVisible(true)
      msgIntervalRef.current = setInterval(() => {
        setMsgVisible(false)
        setTimeout(() => {
          setMsgIdx(i => (i + 1) % JD_PARSE_MESSAGES.length)
          setMsgVisible(true)
        }, 180)
      }, 950)
    } else {
      clearInterval(msgIntervalRef.current)
    }
    return () => clearInterval(msgIntervalRef.current)
  }, [parseStatus])

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const hasCard   = parseStatus === 'done' && jobInfo && !jobInfo.isInsufficient && value.trim().length >= 50

  return (
    <StepLayout
      step={2} totalSteps={3}
      title="Paste the job description"
      subtitle="Copy the full JD from LinkedIn, Indeed, or any job board."
      onBack={onBack}
      onNext={onNext}
      nextLabel={parseStatus === 'loading' ? 'Analyzing JD...' : 'Analyze & Tailor'}
      nextDisabled={!isReady || parseStatus === 'loading'}
      onOpenSettings={onOpenSettings}
    >
      <style>{JD_STYLES}</style>
      <div className="space-y-3">

        {/* ── URL auto-fetch ── */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlStatus('idle') }}
              onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
              placeholder="Paste a LinkedIn or Greenhouse job URL to auto-fill..."
              className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/70 transition-colors"
            />
            <button
              onClick={handleFetchUrl}
              disabled={!urlInput.trim() || urlStatus === 'loading'}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors shrink-0 flex items-center gap-2"
            >
              {urlStatus === 'loading' ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : 'Fetch'}
            </button>
          </div>
          {urlStatus === 'success' && (
            <p className="text-emerald-400 text-xs px-1 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)"/><path d="M6 10.5l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Job description fetched — review and edit below if needed
            </p>
          )}
          {urlStatus === 'error' && (
            <p className="text-red-400 text-xs px-1">{urlError} — paste the JD manually below instead.</p>
          )}
          {urlStatus === 'idle' && (
            <p className="text-slate-600 text-xs px-1">Works with LinkedIn & Greenhouse job URLs</p>
          )}
        </div>

        {/* ── Textarea ── */}
        <div className="relative">
          {collapsed ? (
            /* Collapsed state — JD loaded */
            <div
              className="bg-slate-900 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ animation: 'jd-slide-spring 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)" />
                  <path d="M6 10.5l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-white text-sm font-medium">Job description loaded</p>
                  <p className="text-slate-500 text-sm">{wordCount} words · {value.length} chars</p>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(false)}
                className="text-slate-500 hover:text-slate-300 text-sm underline transition-colors shrink-0"
              >
                Edit
              </button>
            </div>
          ) : (
            /* Expanded textarea */
            <>
              <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Paste the full job description here..."
                rows={12}
                className="w-full bg-slate-900 border text-white placeholder-slate-600 rounded-xl px-5 py-4 text-sm focus:outline-none resize-none transition-all duration-200"
                style={{
                  borderColor: focused ? 'rgba(59,130,246,0.7)' : 'rgb(51,65,85)',
                  boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.10), inset 0 0 0 1px rgba(59,130,246,0.2)' : 'none',
                }}
              />
              {value.length > 0 && (
                <p className="absolute bottom-3 right-4 text-sm text-slate-600">{wordCount}w · {value.length} chars</p>
              )}
            </>
          )}
        </div>

        {/* ── Status line below textarea ── */}
        {parseStatus === 'loading' && (
          <div className="flex items-center gap-2.5 px-1 py-0.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <p
              key={msgIdx}
              className="text-blue-300 text-sm font-medium"
              style={{ animation: 'jd-msg-in 0.22s ease-out both', opacity: msgVisible ? 1 : 0, transition: 'opacity 0.18s' }}
            >
              {JD_PARSE_MESSAGES[msgIdx]}
            </p>
          </div>
        )}

        {!isReady && value.length > 0 && parseStatus === 'idle' && (
          <p className="text-slate-500 text-sm px-1">Paste more of the job description for better results</p>
        )}

        {parseStatus === 'error' && (
          <div className="flex items-center justify-between px-1">
            <p className="text-red-400 text-sm">{parseError}</p>
            <button
              onClick={() => {
                if (!apiKey || value.trim().length < 50) return
                setParseStatus('loading')
                parseJobInfo(apiKey, value, resumeText)
                  .then(info => { setJobInfo(info); setParseStatus('done'); setCollapsed(true); onJobInfoParsed?.(info) })
                  .catch(e => { setParseError(e.message || 'Could not analyze JD. You can still proceed.'); setParseStatus('error') })
              }}
              className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-3"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Insufficient JD warning ── */}
        {parseStatus === 'done' && jobInfo?.isInsufficient && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-amber-400 text-sm font-medium">Job description looks incomplete</p>
              <p className="text-amber-400/70 text-sm mt-1">The tailoring may be less targeted. For best results, paste the full JD including responsibilities and requirements. You can still proceed.</p>
            </div>
          </div>
        )}

        {/* ── Rich JD analysis panel ── */}
        {hasCard && (
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden"
            style={{ animation: 'jd-slide-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >

            {/* Role header */}
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {jobInfo.title && <span className="text-white text-sm font-semibold">{jobInfo.title}</span>}
                {jobInfo.seniority && (
                  <span className={`text-sm px-2 py-0.5 rounded-full border font-medium ${seniorityColors[jobInfo.seniority] || seniorityColors.Mid}`}>
                    {jobInfo.seniority}
                  </span>
                )}
                {jobInfo.overallMatch && (
                  <span
                    className={`text-sm px-2 py-0.5 rounded-full border font-medium ${
                      jobInfo.overallMatch === 'strong'   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      jobInfo.overallMatch === 'moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                                            'text-red-400 bg-red-500/10 border-red-500/20'
                    }`}
                    style={{ animation: 'badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}
                  >
                    {jobInfo.overallMatch === 'strong' ? 'Strong match' : jobInfo.overallMatch === 'moderate' ? 'Moderate match' : 'Weak match'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                {jobInfo.company              && <span>{jobInfo.company}</span>}
                {jobInfo.location             && <><span>·</span><span>{jobInfo.location}</span></>}
                {jobInfo.experienceYearsRequired && <><span>·</span><span>{jobInfo.experienceYearsRequired}</span></>}
                {jobInfo.salary               && <><span>·</span><span className="text-emerald-400 font-medium">{jobInfo.salary}</span></>}
              </div>
              {jobInfo.whatThisRoleWants && (
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">💡 {jobInfo.whatThisRoleWants}</p>
              )}
            </div>

            {/* Skills match */}
            {(jobInfo.mustHaveSkills?.length > 0 || jobInfo.niceToHaveSkills?.length > 0) && (
              <div className="px-4 py-3 space-y-3">

                {jobInfo.mustHaveSkills?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">
                      Must-have — {jobInfo.mustHaveSkills.filter(s => s.inResume).length}/{jobInfo.mustHaveSkills.length} in your resume
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {jobInfo.mustHaveSkills.map((s, i) => (
                        <span
                          key={i}
                          title={s.note || ''}
                          className={`text-sm px-2.5 py-1 rounded-full border font-medium cursor-default ${
                            s.inResume
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}
                          style={{ animation: `chip-fly-in 0.3s ease-out ${i * 40}ms both` }}
                        >
                          {s.inResume ? '✓' : '✗'} {s.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {jobInfo.niceToHaveSkills?.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">
                      Nice-to-have — {jobInfo.niceToHaveSkills.filter(s => s.inResume).length}/{jobInfo.niceToHaveSkills.length} in your resume
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {jobInfo.niceToHaveSkills.map((s, i) => (
                        <span
                          key={i}
                          title={s.note || ''}
                          className={`text-sm px-2.5 py-1 rounded-full border cursor-default ${
                            s.inResume
                              ? 'text-slate-300 bg-slate-800 border-slate-600'
                              : 'text-slate-500 bg-slate-900 border-slate-700'
                          }`}
                          style={{ animation: `chip-fly-in 0.3s ease-out ${i * 35}ms both` }}
                        >
                          {s.inResume ? '✓' : '○'} {s.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Smart warnings */}
            {(() => {
              const warnings = []
              if (jobInfo.reachLevel === 'reach')
                warnings.push('This looks like a reach application — significant gaps in required experience. Tailoring will help but set realistic expectations.')
              else if (jobInfo.reachLevel === 'stretch')
                warnings.push('This is a stretch role — a few gaps exist but tailoring can bridge them effectively.')

              const seniorityLevels = ['Internship','Entry','Mid','Senior','Lead','Director']
              const jdLevel  = seniorityLevels.indexOf(jobInfo.seniority)
              const modeMap  = { fresh_grad: 0, standard: 2, switcher: 2, gap: 2, senior: 4, freelance: 2 }
              const userLevel = modeMap[userMode] ?? 2
              if (jdLevel !== -1 && jdLevel - userLevel >= 2)
                warnings.push(`You selected "${userMode === 'fresh_grad' ? 'Fresh Graduate' : userMode}" but this is a ${jobInfo.seniority} role — this may be a significant reach.`)

              if (healthScore !== null && healthScore < 50 && ['Senior','Lead','Director'].includes(jobInfo.seniority))
                warnings.push(`Your resume quality score is ${healthScore}/100 — consider strengthening it before applying to a ${jobInfo.seniority} role.`)

              return warnings.length > 0 ? (
                <div className="border-t border-slate-800 px-4 py-3 space-y-2">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex gap-2 text-sm text-amber-400">
                      <span className="shrink-0 mt-0.5">⚠</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              ) : null
            })()}
          </div>
        )}

      </div>
    </StepLayout>
  )
}
