import { useState } from 'react'
import ResumePreview from './ResumePreview'
import { getApplications, getSavedResumes, addApplication, updateApplication, deleteApplication, daysSince, timeAgo } from '../utils/storage'
import { geminiJSON, compoundSearch } from '../utils/groq'
import { followUpEmailPrompt } from '../utils/prompts'
import ModelWidget from './ModelWidget'

const STATUSES = [
  { id: 'applied',    label: 'Applied',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'screened',   label: 'Screened',   color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { id: 'interview',  label: 'Interview',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'offer',      label: 'Offer',      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'rejected',   label: 'Rejected',   color: 'text-red-400 bg-red-500/10 border-red-500/20' },
]

function statusMeta(id) { return STATUSES.find(s => s.id === id) || STATUSES[0] }

async function generateFollowUp(apiKey, app) {
  const { prompt, temperature, maxOutputTokens } = followUpEmailPrompt(app)
  return geminiJSON(apiKey, prompt, { temperature, maxOutputTokens })
}

function NoteInput({ appId, initialValue, onSave }) {
  const [value, setValue] = useState(initialValue)
  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => onSave(appId, value)}
      placeholder="Add notes..."
      className="w-full bg-slate-800 border border-slate-700 focus:border-slate-600 text-slate-400 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors placeholder:text-slate-700 mb-2"
    />
  )
}

function AddAppModal({ onSave, onClose }) {
  const [company, setCompany] = useState('')
  const [role, setRole]       = useState('')
  const [score, setScore]     = useState('')

  function handleSave() {
    if (!company.trim() || !role.trim()) return
    onSave({ company: company.trim(), role: role.trim(), matchScore: score ? parseInt(score) : null })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Track application</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Company name</label>
            <input autoFocus value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe"
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Role title</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Frontend Engineer"
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">ATS match score (optional)</label>
            <input value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 82" type="number" min="0" max="100"
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!company.trim() || !role.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Add</button>
        </div>
      </div>
    </div>
  )
}

function FollowUpModal({ app, apiKey, onClose }) {
  const [status, setStatus]   = useState('idle') // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail]     = useState(null)
  const [copied, setCopied]   = useState(false)

  async function generate() {
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await generateFollowUp(apiKey, app)
      setEmail(result)
      setStatus('done')
    } catch (e) {
      setErrorMsg(e.message || 'Generation failed. Try again.')
      setStatus('error')
    }
  }

  function copy() {
    const text = `Subject: ${email.subject}\n\n${email.body}`
    const doFallback = () => {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(el)
      el.focus(); el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(doFallback)
    } else {
      doFallback()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-bold">Follow-up Email</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
        <p className="text-slate-500 text-sm mb-4">{app.company} — {app.role} · Applied {daysSince(app.dateApplied)} days ago</p>

        {status === 'idle' && (
          <button onClick={generate} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            Generate follow-up email
          </button>
        )}
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-blue-400 text-sm py-4 justify-center">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Writing your email...
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2">
            <p className="text-red-400 text-sm">{errorMsg}</p>
            <button onClick={generate} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Try again</button>
          </div>
        )}
        {status === 'done' && email && (
          <div className="space-y-3">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-500 text-sm mb-1">Subject</p>
              <p className="text-white text-sm font-medium">{email.subject}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-500 text-sm mb-1">Body</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{email.body}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={generate} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">Regenerate</button>
              <button onClick={copy} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${copied ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                {copied ? '✓ Copied!' : 'Copy email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyResearchModal({ app, apiKey, onClose }) {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState('')
  const [error, setError]   = useState('')

  async function research() {
    setStatus('loading')
    setError('')
    try {
      const text = await compoundSearch(apiKey,
        `Research the company "${app.company}" for a job candidate preparing for an interview for the role "${app.role}". Provide a concise, practical overview covering:
1. What the company does (products, services, business model)
2. Tech stack and tools they use
3. Company culture and values
4. Recent news or achievements (last 6-12 months)
5. Interview process and tips (if publicly known)

Use clear section headers. Keep each section to 2-3 sentences. Focus on what would help someone ace an interview.`,
        { maxOutputTokens: 800 }
      )
      setResult(text)
      setStatus('done')
    } catch (e) {
      setError(e.message || 'Research failed. Try again.')
      setStatus('error')
    }
  }

  // Simple inline markdown renderer for the modal
  function renderLine(line, i) {
    if (/^\d+\./.test(line.trim())) {
      const content = line.replace(/^\d+\.\s*/, '')
      return <p key={i} className="text-slate-300 text-sm leading-relaxed font-semibold mt-3 mb-1">{content.replace(/\*\*/g, '')}</p>
    }
    const parts = []; const re = /\*\*(.+?)\*\*/g; let last = 0, m
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      parts.push(<strong key={m.index} className="text-white">{m[1]}</strong>)
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return line.trim() ? <p key={i} className="text-slate-300 text-sm leading-relaxed">{parts}</p> : <div key={i} className="h-1.5" />
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold">Company Research</h3>
            <span className="text-xs px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">Web search</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
        <p className="text-slate-500 text-sm mb-4 shrink-0">{app.company} — {app.role}</p>

        {status === 'idle' && (
          <button onClick={research} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shrink-0">
            Research {app.company}
          </button>
        )}
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-blue-400 text-sm py-4 justify-center shrink-0">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Searching the web...
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2 shrink-0">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={research} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Try again</button>
          </div>
        )}
        {status === 'done' && result && (
          <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
            {result.split('\n').map((line, i) => renderLine(line, i))}
          </div>
        )}
        {status === 'done' && (
          <button onClick={research} className="mt-4 w-full py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors shrink-0">↺ Re-research</button>
        )}
      </div>
    </div>
  )
}

function Analytics({ apps }) {
  const total = apps.length
  if (total === 0) return (
    <div className="text-center py-12">
      <p className="text-slate-500 text-sm">No applications yet — add some to see analytics.</p>
    </div>
  )

  const byStatus = Object.fromEntries(STATUSES.map(s => [s.id, apps.filter(a => a.status === s.id).length]))
  const responded   = total - byStatus.applied
  const responseRate = Math.round((responded / total) * 100)
  const interviewRate = Math.round(((byStatus.interview + byStatus.offer) / total) * 100)
  const offerRate    = Math.round((byStatus.offer / total) * 100)
  const scored = apps.filter(a => a.matchScore != null)
  const avgScore = scored.length ? Math.round(scored.reduce((s, a) => s + a.matchScore, 0) / scored.length) : null

  const stats = [
    { label: 'Total Applied', value: total, color: 'text-white' },
    { label: 'Response Rate', value: `${responseRate}%`, color: responseRate >= 30 ? 'text-emerald-400' : responseRate >= 15 ? 'text-amber-400' : 'text-red-400' },
    { label: 'Interview Rate', value: `${interviewRate}%`, color: interviewRate >= 20 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Offer Rate', value: `${offerRate}%`, color: offerRate > 0 ? 'text-emerald-400' : 'text-slate-400' },
    ...(avgScore != null ? [{ label: 'Avg Match Score', value: `${avgScore}%`, color: avgScore >= 70 ? 'text-emerald-400' : 'text-amber-400' }] : []),
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-slate-500 text-sm mt-1 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline Breakdown</p>
        <div className="space-y-2">
          {STATUSES.map(s => {
            const count = byStatus[s.id] || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`text-sm font-medium w-16 shrink-0 ${s.color.split(' ')[0]}`}>{s.label}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${s.color.split(' ')[0].replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm text-slate-500 w-8 text-right shrink-0">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ApplicationTracker({ onBack, apiKey, onLoadVersion }) {
  const [apps, setApps]         = useState(() => getApplications())
  const [savedResumes, setSavedResumes] = useState(() => getSavedResumes())
  const [previewResume, setPreviewResume] = useState(null)
  const [tab, setTab]           = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [followUp, setFollowUp] = useState(null)
  const [research, setResearch] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  function refresh() { setApps(getApplications()); setSavedResumes(getSavedResumes()) }

  function handleAdd(data) {
    addApplication(data)
    refresh()
    setShowAdd(false)
  }

  function handleStatusChange(id, status) {
    updateApplication(id, { status })
    refresh()
  }

  function handleNoteSave(id, notes) {
    updateApplication(id, { notes })
    refresh()
  }

  function handleDelete(id) {
    deleteApplication(id)
    setDeleteConfirm(null)
    refresh()
  }

  const followUps = apps.filter(a => a.status === 'applied' && daysSince(a.dateApplied) >= 7)

  const filtered = tab === 'all'      ? apps
    : tab === 'active'   ? apps.filter(a => !['offer', 'rejected'].includes(a.status))
    : tab === 'followups' ? followUps
    : apps

  const TABS = [
    { id: 'all',       label: `All (${apps.length})` },
    { id: 'active',    label: `Active (${apps.filter(a => !['offer','rejected'].includes(a.status)).length})` },
    { id: 'followups', label: `Follow-ups${followUps.length > 0 ? ` (${followUps.length})` : ''}`, highlight: followUps.length > 0 },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white text-sm transition-colors">← Back</button>
            <div className="w-px h-4 bg-slate-700" />
            <div>
              <h1 className="text-white font-bold text-base">Application Tracker</h1>
              <p className="text-slate-500 text-sm">{apps.length} application{apps.length !== 1 ? 's' : ''} tracked</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelWidget />
            <button
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Add Application
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 px-4">
        <div className="max-w-3xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-500 text-white'
                  : t.highlight
                    ? 'border-transparent text-amber-400 hover:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {tab === 'analytics' ? (
          <Analytics apps={apps} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            {tab === 'followups' ? (
              <>
                <p className="text-4xl mb-3">✓</p>
                <p className="text-white font-semibold mb-1">No follow-ups needed</p>
                <p className="text-slate-500 text-sm">Applications older than 7 days with no response will appear here.</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">📋</p>
                <p className="text-white font-semibold mb-1">No applications yet</p>
                <p className="text-slate-500 text-sm mb-5">Start tracking your job applications here.</p>
                <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                  + Add your first application
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tab === 'followups' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-2">
                <p className="text-amber-400 text-sm font-semibold">These applications have had no update in 7+ days. Consider following up.</p>
              </div>
            )}
            {filtered.map(app => {
              const meta = statusMeta(app.status)
              const days = daysSince(app.dateApplied)
              return (
                <div key={app.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{app.role}</p>
                      <p className="text-slate-400 text-sm">{app.company}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.matchScore != null && (
                        <span className="text-sm text-slate-500">{app.matchScore}%</span>
                      )}
                      <span className={`text-sm px-2.5 py-1 rounded-full border font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-slate-500 text-sm">{timeAgo(app.dateApplied)}</span>
                    {days >= 7 && app.status === 'applied' && (
                      <span className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {days}d — follow up?
                      </span>
                    )}
                  </div>

                  {/* Status selector */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {STATUSES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleStatusChange(app.id, s.id)}
                        className={`text-sm px-2.5 py-1 rounded-full border transition-colors ${
                          app.status === s.id ? s.color : 'border-slate-700 text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Notes */}
                  <NoteInput appId={app.id} initialValue={app.notes} onSave={handleNoteSave} />

                  {/* Linked resume */}
                  {app.versionId && (() => {
                    const linked = savedResumes.find(r => r.sessionId === app.versionId)
                    return linked ? (
                      <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-500 mb-0.5">Linked resume</p>
                          <p className="text-sm text-slate-300 truncate">{linked.company} · {linked.role}</p>
                        </div>
                        <button
                          onClick={() => setPreviewResume(linked)}
                          className="text-sm text-blue-400 hover:text-blue-300 shrink-0 ml-3 transition-colors"
                        >
                          Preview →
                        </button>
                      </div>
                    ) : null
                  })()}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFollowUp(app)}
                      className="flex-1 text-sm py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      Follow-up email
                    </button>
                    <button
                      onClick={() => setResearch(app)}
                      className="flex-1 text-sm py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      🔍 Research
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(app.id)}
                      className="text-sm py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && <AddAppModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}

      {previewResume && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl my-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">{previewResume.company} · {previewResume.role}</p>
              <button onClick={() => setPreviewResume(null)} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            <ResumePreview data={previewResume.resumeData} hideDownload />
          </div>
        </div>
      )}

      {research && (
        <CompanyResearchModal
          app={research}
          apiKey={apiKey}
          onClose={() => setResearch(null)}
        />
      )}

      {followUp && (
        <FollowUpModal
          app={{ ...followUp, candidateName: savedResumes.find(r => r.sessionId === followUp.versionId)?.resumeData?.name }}
          apiKey={apiKey}
          onClose={() => setFollowUp(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center">
            <p className="text-white font-semibold mb-2">Remove this application?</p>
            <p className="text-slate-400 text-sm mb-5">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
