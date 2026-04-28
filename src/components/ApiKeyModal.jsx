import { useState, useRef } from 'react'
import { validateApiKey, MODEL_OPTIONS, getStoredModel, setStoredModel } from '../utils/groq'
import { exportAllData, importAllData } from '../utils/storage'
import { submitFeedback, getLastError, APP_VERSION } from '../utils/feedback'

const STORAGE_KEY = 'resume_tailor_api_key'
export function getStoredApiKey() { return localStorage.getItem(STORAGE_KEY) || '' }

function maskKey(key) {
  if (!key) return ''
  return key.slice(0, 6) + '••••••••••••••••••••' + key.slice(-4)
}

const guideSteps = [
  'Go to console.groq.com and sign up (free — no credit card)',
  'Click "API Keys" in the left sidebar',
  'Click "Create API Key", give it a name',
  'Copy the key (starts with gsk_)',
  'Paste it here and click Verify — done!',
]

function getCurrentPage() {
  const hash = window.location.hash || ''
  if (hash.includes('upload') || hash === '#/')   return 'Upload Resume'
  if (hash.includes('job'))                        return 'Job Description'
  if (hash.includes('analyze'))                    return 'Analyze & Generate'
  if (hash.includes('download'))                   return 'Download'
  if (hash.includes('versions'))                   return 'My Resumes'
  if (hash.includes('tracker'))                    return 'Application Tracker'
  return 'Home'
}

const FEEDBACK_TYPES = ['Bug', 'Suggestion', 'Feature Request']

function FeedbackModal({ onClose }) {
  const [type, setType]           = useState('')
  const [description, setDesc]    = useState('')
  const [email, setEmail]         = useState('')
  const [status, setStatus]       = useState('idle')
  const hasError                  = !!getLastError()

  async function handleSubmit() {
    if (!type || !description.trim()) return
    setStatus('sending')
    try {
      await submitFeedback({ type, description: description.trim(), email: email.trim(), page: getCurrentPage() })
      setStatus('sent')
      setType(''); setDesc(''); setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-60" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-70 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">Send Feedback</span>
            <span className="text-slate-600 text-xs">{APP_VERSION}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          {status === 'sent' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-4 text-xs text-emerald-400 text-center">
              ✓ Thanks! We'll review it soon.
              <button onClick={() => setStatus('idle')} className="block mx-auto mt-1 text-slate-500 underline text-xs">Send another</button>
            </div>
          ) : (
            <>
              {hasError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-400">
                  ⚡ An error was detected — it will be included automatically if you submit a bug report.
                </div>
              )}
              <div className="flex gap-1.5">
                {FEEDBACK_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                      type === t
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t === 'Bug' ? '🐛' : t === 'Suggestion' ? '💡' : '✨'} {t}
                  </button>
                ))}
              </div>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value.slice(0, 500))}
                placeholder={
                  type === 'Bug' ? 'What happened? What were you doing when it broke?' :
                  type === 'Suggestion' ? 'What would make this better?' :
                  type === 'Feature Request' ? 'What feature would you like to see?' :
                  'Select a type above, then describe...'
                }
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs focus:outline-none resize-none transition-colors"
              />
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-xs">{description.length}/500</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional — for follow-up)"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none transition-colors"
              />
              {status === 'error' && (
                <p className="text-red-400 text-xs">Failed to send — check your connection and try again.</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!type || !description.trim() || status === 'sending'}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {status === 'sending' ? (
                  <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending...</>
                ) : 'Send Feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function DataModal({ onClose }) {
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError]   = useState('')
  const fileRef = useRef()

  function handleExport() {
    const data = exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href     = url
    a.download = `resumetailor_backup_${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result)
        if (raw.schemaVersion !== 1) {
          setImportError('⚠ Older backup format — some data may be incomplete, but importing anyway.')
        }
        const result = importAllData(raw)
        setImportResult(result)
      } catch {
        setImportError('Could not read file — make sure it\'s a ResumeTailor backup.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-60" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-70 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <span className="text-white text-sm font-semibold">Export / Import Data</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-slate-400 text-sm">Back up everything to a file and restore it on any device.</p>
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-1.5 text-xs text-slate-500">
            <p className="text-slate-400 font-medium text-xs">What's included</p>
            <p>• Saved resumes</p>
            <p>• Application tracker entries</p>
            <p>• Today's token usage &amp; model limits</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 py-2.5 text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-2.5 text-sm font-medium text-slate-300 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Import backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          </div>
          {importResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-400 space-y-0.5">
              <p className="font-semibold">Import complete</p>
              <p>Resumes: +{importResult.resumesAdded} added, {importResult.resumesSkipped} already existed</p>
              <p>Applications: +{importResult.appsAdded} added, {importResult.appsSkipped} already existed</p>
            </div>
          )}
          {importError && (
            <p className="text-amber-400 text-xs">{importError}</p>
          )}
        </div>
      </div>
    </>
  )
}

export default function ApiKeyModal({ onClose, onKeySet, isMigration = false }) {
  const existingKey = getStoredApiKey()
  const [mode, setMode] = useState(existingKey ? 'connected' : 'new')
  const [selectedModel, setSelectedModel] = useState(getStoredModel)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showData, setShowData] = useState(false)

  async function verifyKey() {
    if (!key.trim()) return
    setStatus('loading')
    setError('')
    try {
      await validateApiKey(key.trim())
      localStorage.setItem(STORAGE_KEY, key.trim())
      setStatus('success')
      setMode('connected')
      onKeySet(key.trim())
    } catch (e) {
      setStatus('error')
      setError(e.message || 'Invalid API key. Please check and try again.')
    }
  }

  function removeKey() {
    localStorage.removeItem(STORAGE_KEY)
    setMode('new')
    setKey('')
    setStatus('idle')
    onKeySet('')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-50 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="text-white text-sm font-semibold">API Key Settings</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Connected state */}
          {mode === 'connected' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Connected</span>
                <span className="text-slate-600 text-xs ml-auto">Groq · Free tier</span>
              </div>

              <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-slate-300 text-sm font-mono flex-1 tracking-wider">
                  {showKey ? getStoredApiKey() : maskKey(getStoredApiKey())}
                </span>
                <button onClick={() => setShowKey(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {showKey ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setMode('new'); setKey(''); setStatus('idle') }}
                  className="flex-1 py-2 text-sm text-slate-300 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
                >
                  Change Key
                </button>
                <button
                  onClick={removeKey}
                  className="flex-1 py-2 text-sm text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-colors"
                >
                  Remove
                </button>
              </div>
            </>
          )}

          {/* New / Enter key state */}
          {mode === 'new' && (
            <>
              {isMigration && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-xs text-amber-400 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Action required — switch to Groq</span>
                  We've moved from Google Gemini to Groq for faster, more reliable AI. Your old Gemini key has been cleared. Get a free Groq key below — takes 2 minutes.
                </div>
              )}
              <p className="text-slate-400 text-sm">
                Get a <span className="text-white font-medium">free key</span> from{' '}
                <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                  console.groq.com
                </a>
                {' '}— no credit card required.{' '}
                <button onClick={() => setShowGuide(v => !v)} className="text-blue-400 underline">
                  {showGuide ? 'Hide guide' : 'How?'}
                </button>
              </p>
              <a
                href="https://www.youtube.com/watch?v=9VDbhptCzlU"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl px-4 py-2.5 transition-colors group"
              >
                <svg className="h-4 w-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <div>
                  <p className="text-white text-xs font-medium group-hover:text-red-300 transition-colors">Watch: How to get your free Groq API key</p>
                  <p className="text-slate-500 text-xs">2 min video — takes you through every step</p>
                </div>
                <svg className="h-3 w-3 text-slate-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {showGuide && (
                <ol className="space-y-2 bg-slate-800/50 rounded-xl p-4">
                  {guideSteps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-400">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex gap-2">
                <input
                  type="password"
                  value={key}
                  onChange={e => { setKey(e.target.value); setStatus('idle') }}
                  placeholder="gsk_..."
                  autoFocus
                  className="flex-1 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={verifyKey}
                  disabled={!key.trim() || status === 'loading'}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  {status === 'loading' ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : 'Verify'}
                </button>
              </div>

              {status === 'error' && <p className="text-red-400 text-sm">{error}</p>}

              {existingKey && (
                <button onClick={() => setMode('connected')} className="text-slate-500 text-xs underline">
                  Cancel
                </button>
              )}
            </>
          )}

          {/* Model selector — shown once connected */}
          {mode === 'connected' && (
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Model</p>
              <div className="space-y-2">
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSelectedModel(opt.id); setStoredModel(opt.id) }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                      selectedModel === opt.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-semibold ${selectedModel === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${opt.tagColor}`}>{opt.tag}</span>
                        <span className="text-xs text-slate-500">{opt.capacity}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-slate-600 text-xs pt-1">🔒 Your key is stored in your browser only — never sent to any server.</p>

          {/* Quick action buttons */}
          <div className="border-t border-slate-800 pt-4 flex gap-2">
            <button
              onClick={() => setShowFeedback(true)}
              className="flex-1 py-2 text-xs font-medium text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-300 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Send Feedback
            </button>
            <button
              onClick={() => setShowData(true)}
              className="flex-1 py-2 text-xs font-medium text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-300 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M10 12h4" />
              </svg>
              Export / Import
            </button>
          </div>
        </div>
      </div>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showData && <DataModal onClose={() => setShowData(false)} />}
    </>
  )
}
