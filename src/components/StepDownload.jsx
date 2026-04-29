import { useState, useRef, useEffect } from 'react'
import ModelWidget from './ModelWidget'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import * as pdfjsLib from 'pdfjs-dist'

// Worker initialized lazily inside getPdfDoc
import ResumeDocument from './ResumeDocument'
import ResumeEditor from './ResumeEditor'
import ResumeQualityPanel from './ResumeQualityPanel'
import ExtraTools from './ExtraTools'
import SaveResumeModal from './SaveResumeModal'
import ResumePreview from './ResumePreview'
import { getSavedResumes, getApplications } from '../utils/storage'
import { saveResume, addApplication } from '../utils/storage'
import { generateDocxBlob } from '../utils/docxGenerator'
import { geminiJSON, geminiScore } from '../utils/groq'
import { polishPrompt, scorePrompt } from '../utils/prompts'


const DOWNLOAD_STYLES = `
@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%) skewX(-12deg); }
  100% { transform: translateX(250%) skewX(-12deg); }
}
@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.92) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes dl-flash-green {
  0%, 100% { background: rgb(37,99,235); }
  40%       { background: rgb(16,185,129); }
}
@keyframes delta-pop {
  0%   { opacity: 0; transform: scale(0.4); }
  55%  { transform: scale(1.35); }
  80%  { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ring-float-in {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes header-bounce-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.88); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes template-selected-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50%       { box-shadow: 0 0 12px 2px rgba(59,130,246,0.2); }
}
`

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Navy & professional' },
  { id: 'modern',  label: 'Modern',  desc: 'Teal & contemporary' },
  { id: 'minimal', label: 'Minimal', desc: 'Black & white clean' },
]

function readAsArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsArrayBuffer(blob)
  })
}

async function getPdfDoc(data) {
  const strategies = [
    () => { pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString() },
    () => { pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs` },
    () => { pdfjsLib.GlobalWorkerOptions.workerSrc = '' },
  ]
  for (let i = 0; i < strategies.length; i++) {
    try {
      strategies[i]()
      return await pdfjsLib.getDocument({ data }).promise
    } catch (e) {
      if (i === strategies.length - 1) throw e
    }
  }
}

function CanvasPdfPreview({ resumeData, template }) {
  const canvasRef = useRef()
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const renderTaskRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      setLoading(true)
      setError('')
      try {
        const blob = await pdf(<ResumeDocument data={resumeData} template={template} />).toBlob()
        const ab = await readAsArrayBuffer(blob)
        const pdfDoc = await getPdfDoc(new Uint8Array(ab))
        if (cancelled) return
        setNumPages(pdfDoc.numPages)
        const page = await pdfDoc.getPage(currentPage)
        if (cancelled) return
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        const containerWidth = canvas.parentElement?.clientWidth || 350
        const unscaledViewport = page.getViewport({ scale: 1 })
        const scale = (containerWidth / unscaledViewport.width) * dpr
        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / dpr}px`
        canvas.style.height = `${viewport.height / dpr}px`
        const ctx = canvas.getContext('2d')
        if (renderTaskRef.current) renderTaskRef.current.cancel()
        renderTaskRef.current = page.render({ canvasContext: ctx, viewport })
        await renderTaskRef.current.promise
      } catch (e) {
        if (!cancelled) setError('Preview failed — try downloading instead.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    render()
    return () => { cancelled = true }
  }, [resumeData, template, currentPage])

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-slate-400 text-sm font-medium">Exact PDF Preview</span>
        {numPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-500 hover:text-white disabled:opacity-30 text-sm px-2">←</button>
            <span className="text-slate-500 text-sm">{currentPage} / {numPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages} className="text-slate-500 hover:text-white disabled:opacity-30 text-sm px-2">→</button>
          </div>
        )}
      </div>
      <div className="bg-white" style={{ minHeight: '80px' }}>
        {loading && (
          <div className="flex items-center justify-center h-20 bg-slate-900">
            <span className="text-slate-500 text-sm">Rendering PDF...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-16 bg-slate-900">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full block" style={{ display: loading || error ? 'none' : 'block' }} />
      </div>
    </div>
  )
}



const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches

async function polishLanguage(apiKey, resumeData) {
  const { prompt, temperature, maxOutputTokens } = polishPrompt(resumeData)
  return geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }, true)
}

async function rescoreResume(apiKey, resumeData, jobDescription, userMode) {
  const resumeText = [
    resumeData.summary,
    resumeData.experience?.map(e => [e.title, e.company, ...(e.bullets || [])].join(' ')).join(' '),
    resumeData.skills?.join(' ')
  ].filter(Boolean).join('\n')
  const { prompt, temperature, maxOutputTokens } = scorePrompt(resumeText, jobDescription, userMode)
  return geminiScore(apiKey, prompt, { temperature, maxOutputTokens })
}

function ScoreRing({ score, label, stale, delay = 0 }) {
  const [displayScore, setDisplayScore] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now()
      const dur = 1100
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1)
        setDisplayScore(Math.round((1 - Math.pow(1 - p, 3)) * score))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(t)
  }, [score, delay])

  const color = stale ? '#475569' : score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const glowColor = stale ? 'none' : score >= 75 ? 'rgba(16,185,129,0.18)' : score >= 50 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'
  const circumference = 2 * Math.PI * 22
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="flex flex-col items-center gap-1.5"
      style={{ animation: `ring-float-in 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both` }}>
      <div className="relative w-14 h-14" style={{ filter: stale ? 'none' : `drop-shadow(0 0 6px ${glowColor})` }}>
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="#1e293b" strokeWidth="4" />
          <circle cx="24" cy="24" r="22" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${stale ? 'text-slate-500' : 'text-white'}`}>{displayScore}%</span>
        </div>
      </div>
      <span className={`text-sm ${stale ? 'text-slate-600' : 'text-slate-400'}`}>{label}{stale ? ' *' : ''}</span>
    </div>
  )
}

function ScoreDiff({ beforeScore, afterScore, hasEdits, onRescore, rescoring, hasJobDescription }) {
  if (!beforeScore && !afterScore) return null
  const before = beforeScore ?? null
  const after  = afterScore  ?? null
  const diff   = before !== null && after !== null ? after - before : null

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">ATS Match Improvement</p>
        {hasEdits && hasJobDescription && (
          <button
            onClick={onRescore}
            disabled={rescoring}
            className="text-sm bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {rescoring ? (
              <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Scoring...</>
            ) : '↻ Re-score'}
          </button>
        )}
      </div>

      {hasEdits && !rescoring && hasJobDescription && (
        <p className="text-sm text-amber-400 mb-3">* Score is outdated — you've made edits. Click Re-score to update.</p>
      )}

      <div className="flex items-center justify-center gap-4">
        {before !== null && <ScoreRing score={before} label="Original" stale={false} />}
        {before !== null && after !== null && (
          <div className="flex flex-col items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span
              className={`text-sm font-bold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}
              style={{ animation: 'delta-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.6s both' }}
            >
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
        )}
        {after !== null
          ? <ScoreRing score={after} label="Tailored" stale={hasEdits} delay={300} />
          : before !== null && <span className="text-sm text-slate-500 italic">Scoring tailored resume...</span>
        }
      </div>
      {diff !== null && diff > 0 && !hasEdits && (
        <p className="text-slate-500 text-sm text-center mt-3 leading-relaxed">
          The tailored resume now includes more of the job's required keywords and rephrased bullets to match the role — that's what lifted the ATS score.
        </p>
      )}
      {diff !== null && diff <= 0 && after !== null && !hasEdits && (
        <p className="text-slate-500 text-sm text-center mt-3 leading-relaxed">
          Score held steady — the original resume was already a strong keyword match. The rewrite focused on impact and framing rather than new terms.
        </p>
      )}
    </div>
  )
}

function SubmitReadyCheck({ resumeData }) {
  const issues = []

  const placeholders = (JSON.stringify(resumeData).match(/\[X\]/gi) || []).length
  if (placeholders > 0)
    issues.push(`${placeholders} placeholder${placeholders !== 1 ? 's' : ''} with [X] still need real numbers`)

  if (!resumeData.name?.trim())  issues.push('Full name is missing')
  if (!resumeData.email?.trim()) issues.push('Email address is missing')
  if (!resumeData.phone?.trim()) issues.push('Phone number is missing')

  const words = resumeData.summary?.trim().split(/\s+/).length || 0
  if (words < 10) issues.push('Professional summary is too short or missing')

  const emptyBullets = (resumeData.experience || []).reduce(
    (n, exp) => n + (exp.bullets?.filter(b => !b?.trim()).length || 0), 0
  )
  if (emptyBullets > 0)
    issues.push(`${emptyBullets} empty bullet${emptyBullets !== 1 ? 's' : ''} in experience — fill in or delete`)

  if (!resumeData.skills?.length) issues.push('No skills listed')

  if (issues.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5">
        <span className="text-emerald-400 text-base">✓</span>
        <p className="text-emerald-400 text-sm font-medium">All clear — resume is ready to download</p>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
      <p className="text-amber-400 text-sm font-semibold mb-2.5">
        Fix {issues.length} thing{issues.length !== 1 ? 's' : ''} before downloading
      </p>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="text-sm text-slate-400 flex gap-2">
            <span className="text-amber-500 shrink-0">⚠</span>
            {issue}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChangeSummary({ changes }) {
  const [open, setOpen] = useState(false)
  if (!changes) return null
  const { summaryRewrite, keywordsAdded, bulletImprovements, skillsChange } = changes
  const hasContent = summaryRewrite || keywordsAdded?.length || bulletImprovements?.length || skillsChange

  if (!hasContent) return null

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">🔍</span>
          <p className="text-white text-sm font-medium">What the AI changed</p>
        </div>
        <span className="text-slate-500 text-sm">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">

          {summaryRewrite && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1.5">Summary</p>
              <p className="text-slate-300 text-sm leading-relaxed">{summaryRewrite}</p>
            </div>
          )}

          {keywordsAdded?.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1.5">Keywords woven in</p>
              <div className="flex flex-wrap gap-1.5">
                {keywordsAdded.map((kw, i) => (
                  <span key={i} className="text-sm px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">+ {kw}</span>
                ))}
              </div>
            </div>
          )}

          {bulletImprovements?.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1.5">Experience bullets</p>
              <div className="space-y-1.5">
                {bulletImprovements.map((item, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-blue-400 shrink-0 mt-0.5">↑</span>
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skillsChange && (
            <div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1.5">Skills</p>
              <p className="text-slate-300 text-sm leading-relaxed">{skillsChange}</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

function TemplateSelector({ value, onChange }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">PDF Template</p>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map(t => {
          const active = value === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative p-3 rounded-xl border text-left transition-all duration-200 overflow-hidden ${
                active
                  ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-md'
              }`}
              style={active ? { animation: 'template-selected-glow 2.5s ease-in-out infinite' } : {}}
            >
              {active && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <p className={`text-sm font-semibold ${active ? 'text-blue-400' : 'text-white'}`}>{t.label}</p>
              <p className="text-sm text-slate-500 mt-0.5">{t.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StepDownload({ data, onStartOver, onBack, apiKey, jobDescription, beforeScore, afterScore, onOpenSettings, resumeText, userMode, sessionId, onGoToVersions, onGoToTracker }) {
  const originalData = useRef(data)
  const [resumeData, setResumeData]     = useState(data)
  const [trimBase, setTrimBase]         = useState(data)
  const [template, setTemplate]         = useState('classic')
  const [liveAfterScore, setLiveAfterScore] = useState(afterScore)
  const [rescoring, setRescoring]       = useState(false)
  const [hasEdits, setHasEdits]         = useState(false)
  const [scoreStale, setScoreStale]     = useState(false)
  const [modalMode, setModalMode]       = useState(null) // null | 'save' | 'track'
  const [savedLabel, setSavedLabel]     = useState(() => {
    if (!sessionId) return null
    const r = getSavedResumes().find(v => v.sessionId === sessionId)
    return r ? { company: r.company, role: r.role } : null
  })
  const [trackedLabel, setTrackedLabel] = useState(() => {
    if (!sessionId) return null
    const a = getApplications().find(a => a.sessionId === sessionId)
    return a ? { company: a.company, role: a.role } : null
  })
  const [polishing, setPolishing]       = useState(false)
  const [polished, setPolished]         = useState(false)
  const [polishError, setPolishError]   = useState('')
  const [showFormatPreview, setShowFormatPreview] = useState(false)
  const [pageCount, setPageCount]       = useState(null)

  async function measurePages(data) {
    const blob = await pdf(<ResumeDocument data={data} template={template} />).toBlob()
    const ab = await readAsArrayBuffer(blob)
    const doc = await getPdfDoc(new Uint8Array(ab))
    const wordsPerPage = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items.filter(item => typeof item.str === 'string').map(item => item.str).join(' ')
      wordsPerPage.push(text.trim().split(/\s+/).filter(Boolean).length)
    }
    return { numPages: doc.numPages, wordsPerPage }
  }

  // Render PDF and count pages — only re-runs when resumeData or template changes
  useEffect(() => {
    let cancelled = false
    measurePages(resumeData)
      .then(r => { if (!cancelled) setPageCount(r.numPages) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [resumeData, template])

  // sync afterScore prop on first load
  const prevAfterScore = useRef(afterScore)
  if (afterScore !== prevAfterScore.current) {
    prevAfterScore.current = afterScore
    if (!hasEdits) setLiveAfterScore(afterScore)
  }

  function handleResumeChange(newData) {
    setResumeData(newData)
    setHasEdits(true)
    setScoreStale(true)
  }

  function handleReset() {
    setResumeData(originalData.current)
    setTrimBase(originalData.current)
    setHasEdits(false)
    setScoreStale(false)
    setLiveAfterScore(afterScore)
    setPolished(false)
  }

  async function handlePolish() {
    setPolishing(true)
    setPolishError('')
    try {
      const polishedData = await polishLanguage(apiKey, resumeData)
      setResumeData(polishedData)
      setHasEdits(true)
      setScoreStale(true)
      setPolished(true)
    } catch (e) {
      setPolishError(e.message || 'Language polish failed. Try again.')
    }
    setPolishing(false)
  }

  async function handleRescore() {
    if (!jobDescription?.trim()) return
    setRescoring(true)
    try {
      const score = await rescoreResume(apiKey, resumeData, jobDescription, userMode)
      if (score !== null) { setLiveAfterScore(score); setScoreStale(false) }
    } catch {}
    setRescoring(false)
  }

  function handleModalSubmit({ company, role }) {
    const resumePayload = {
      sessionId, company, role, resumeData,
      resumeText: resumeText || '',
      jobDescription: jobDescription || '',
      userMode: userMode || 'standard',
      matchScore: beforeScore,
      tailoredScore: liveAfterScore,
    }
    if (modalMode === 'save') {
      saveResume(resumePayload)
      setSavedLabel({ company, role })
    } else if (modalMode === 'track') {
      // Always upsert the resume (so application has a linked version)
      saveResume(resumePayload)
      setSavedLabel({ company, role })
      addApplication({ sessionId, company, role, versionId: sessionId, matchScore: liveAfterScore })
      setTrackedLabel({ company, role })
    }
    setTrimBase(resumeData)
    setHasEdits(false)
    setScoreStale(false)
    setModalMode(null)
  }

  function handleUpdateSave() {
    if (!savedLabel) return
    // Re-read current name from localStorage in case it was renamed in VersionManager
    const current = getSavedResumes().find(v => v.sessionId === sessionId)
    const company = current?.company ?? savedLabel.company
    const role = current?.role ?? savedLabel.role
    saveResume({
      sessionId,
      company,
      role,
      resumeData,
      resumeText: resumeText || '',
      jobDescription: jobDescription || '',
      userMode: userMode || 'standard',
      matchScore: beforeScore,
      tailoredScore: liveAfterScore,
    })
    setSavedLabel({ company, role })
    setTrimBase(resumeData)
    setHasEdits(false)
    setScoreStale(false)
  }

  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadingPdf, setDownloadingPdf]       = useState(false)
  const [downloadFileName, setDownloadFileName]   = useState('')
  const [downloadFlash, setDownloadFlash]         = useState(false)
  const [downloadFormat, setDownloadFormat]       = useState('pdf')

  async function triggerDownload(name) {
    setDownloadingPdf(true)
    try {
      const baseName = (name.trim() || 'resume').replace(/\.(pdf|docx)$/i, '')
      let blob, ext
      if (downloadFormat === 'docx') {
        blob = await generateDocxBlob(resumeData, template)
        ext  = '.docx'
      } else {
        blob = await pdf(<ResumeDocument data={resumeData} template={template} />).toBlob()
        ext  = '.pdf'
      }
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = baseName + ext
      a.click()
      URL.revokeObjectURL(url)
      setShowDownloadModal(false)
      setDownloadFlash(true)
      setTimeout(() => setDownloadFlash(false), 1200)
    } finally {
      setDownloadingPdf(false)
    }
  }

  function openDownloadModal() {
    const defaultName = `${resumeData.name?.replace(/\s+/g, '_') || 'resume'}_tailored`
    setDownloadFileName(defaultName)
    setShowDownloadModal(true)
  }

  const placeholderCount = (JSON.stringify(resumeData).match(/\[X\]/gi) || []).length

  return (
    <>
    <style>{DOWNLOAD_STYLES}</style>
    <div className="bg-slate-950 flex flex-col min-h-screen lg:h-screen lg:overflow-hidden">

        {/* Top nav — full width */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
          <button onClick={onBack} disabled={polishing || rescoring} className="text-slate-400 hover:text-white disabled:opacity-40 text-sm flex items-center gap-1 transition-colors">
            ← Back
          </button>
          <div className="flex items-center gap-2">
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

        {/* Two-column body */}
        <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">

        {/* LEFT COLUMN — scrollable */}
        <div className="flex-1 lg:overflow-y-auto px-6 py-6">

        {/* Header */}
        <div className="text-center mb-6" style={{ animation: 'header-bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.25))' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Interview-ready!</h2>
          <p className="text-slate-400 text-sm">Tailored and optimized for this role.</p>
        </div>

        {/* Score diff */}
        <ScoreDiff
          beforeScore={beforeScore}
          afterScore={liveAfterScore}
          hasEdits={scoreStale}
          onRescore={handleRescore}
          rescoring={rescoring}
          hasJobDescription={!!jobDescription?.trim()}
        />

        {/* What changed */}
        <ChangeSummary changes={resumeData.changes} />

        {/* Placeholder warning banner */}
        {placeholderCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 text-sm font-semibold">{placeholderCount} placeholder{placeholderCount !== 1 ? 's' : ''} need real numbers</p>
              <p className="text-slate-400 text-sm mt-0.5">Fields marked <span className="text-amber-400 font-mono">[X]</span> are highlighted amber in the editor below — replace each with your actual number before downloading.</p>
            </div>
          </div>
        )}

        {/* Editor header with reset + polish */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Resume Editor
            {hasEdits && <span className="ml-2 text-amber-400 normal-case font-normal">· unsaved changes</span>}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePolish}
              disabled={polishing || polished}
              title="Fix grammar, passive voice, and unnatural phrasing for non-native English speakers"
              className="text-sm bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {polishing ? (
                <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Polishing...</>
              ) : polished ? '✓ Polished' : '✍ Polish Language'}
            </button>
            {hasEdits && (
              <button
                onClick={handleReset}
                className="text-sm text-slate-500 hover:text-red-400 underline transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {polishError && (
          <p className="text-red-400 text-sm mb-2">{polishError}</p>
        )}

        {/* Editor */}
        <div className="mb-4">
          <ResumeEditor data={resumeData} onChange={handleResumeChange} apiKey={apiKey} jobDescription={jobDescription} />
        </div>

        {/* Quality check */}
        <div className="mb-4">
          <ResumeQualityPanel
            resumeData={resumeData}
            trimSource={trimBase}
            pageCount={pageCount}
            measurePages={measurePages}
            onTrimmed={d => { setResumeData(d); setHasEdits(true) }}
            apiKey={apiKey}
            userMode={userMode}
          />
        </div>

        {/* Format selector */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Download Format</p>
          <div className="flex gap-2">
            {[
              { id: 'pdf',  label: 'PDF',          desc: 'Best for email & viewing' },
              { id: 'docx', label: 'Word (.docx)',  desc: 'Required by most portals' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setDownloadFormat(f.id); setShowFormatPreview(false) }}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-left transition-all ${
                  downloadFormat === f.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <p className={`text-sm font-semibold ${downloadFormat === f.id ? 'text-blue-400' : 'text-slate-300'}`}>{f.label}</p>
                <p className="text-slate-500 text-sm mt-0.5">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Template selector — PDF only */}
        {downloadFormat === 'pdf' && <TemplateSelector value={template} onChange={setTemplate} />}

        {/* Preview toggle — mobile only; desktop shows sticky right column */}
        <div className="lg:hidden">
        {downloadFormat === 'pdf' && (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowFormatPreview(v => !v)}
                className={`flex-1 py-2.5 rounded-xl border text-sm transition-colors flex items-center justify-center gap-2 ${
                  showFormatPreview
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white'
                }`}
              >
                {showFormatPreview ? '▲ Hide PDF Preview' : '📄 Preview PDF'}
              </button>
            </div>
            {showFormatPreview && (
              <div className="mb-4" style={{ animation: 'ring-float-in 0.4s ease-out both' }}>
                {isTouchDevice ? (
                  <CanvasPdfPreview resumeData={resumeData} template={template} />
                ) : (
                  <div className="rounded-xl overflow-hidden border border-slate-700">
                    <PDFViewer width="100%" height={700} showToolbar={false}>
                      <ResumeDocument data={resumeData} template={template} />
                    </PDFViewer>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>{/* end lg:hidden preview toggle */}

        {/* Submit-ready check */}
        <SubmitReadyCheck resumeData={resumeData} />

        {/* Download */}
        <button
          onClick={openDownloadModal}
          className="relative w-full mb-3 py-3.5 rounded-xl text-white font-semibold transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2 overflow-hidden active:scale-[0.98]"
          style={{
            background: downloadFlash ? undefined : 'rgb(37,99,235)',
            animation: downloadFlash ? 'dl-flash-green 0.6s ease-in-out' : 'none',
          }}
        >
          {/* Shimmer sweep */}
          <span className="absolute inset-0 pointer-events-none">
            <span className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
              style={{ animation: 'shimmer-sweep 3.5s ease-in-out infinite 2s' }} />
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="relative z-10">
            {downloadFlash ? '✓ Saved!' : `Download Resume · ${TEMPLATES.find(t => t.id === template)?.label}`}
          </span>
        </button>

        {/* Save + Track */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {savedLabel && hasEdits ? (
            <button
              onClick={handleUpdateSave}
              disabled={rescoring}
              title={rescoring ? 'Wait for re-score to finish before saving' : undefined}
              className="py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium transition-colors disabled:opacity-40"
            >
              {rescoring ? 'Scoring...' : '↑ Update saved version'}
            </button>
          ) : savedLabel ? (
            <button
              onClick={onGoToVersions}
              className="py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium transition-colors hover:bg-emerald-500/20"
            >
              ✓ Saved — View My Resumes
            </button>
          ) : (
            <button
              onClick={() => setModalMode('save')}
              disabled={rescoring}
              title={rescoring ? 'Wait for re-score to finish before saving' : undefined}
              className="py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-40"
            >
              💾 Save this resume
            </button>
          )}
          {trackedLabel ? (
            <button
              onClick={onGoToTracker}
              className="py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium transition-colors hover:bg-emerald-500/20"
            >
              ✓ Tracked — View Tracker
            </button>
          ) : (
            <button
              onClick={() => setModalMode('track')}
              className="py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              📋 Track this application
            </button>
          )}
        </div>

        <button
          onClick={() => {
            if (hasEdits && !savedLabel) {
              if (!window.confirm('You have unsaved edits. Leave without saving?')) return
            }
            onStartOver()
          }}
          className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm transition-colors mb-8"
        >
          Tailor for another job →
        </button>

        <ExtraTools apiKey={apiKey} resumeData={resumeData} jobDescription={jobDescription} />

        <div className="h-12" />
        </div>{/* end LEFT COLUMN */}

        {/* RIGHT COLUMN — full-height panel, desktop only */}
        <div className="hidden lg:flex lg:flex-col w-[460px] xl:w-[540px] shrink-0 border-l border-slate-800">
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live Preview</p>
          </div>
          <div className="flex-1 overflow-hidden">
            {downloadFormat === 'pdf' ? (
              isTouchDevice ? (
                <div className="p-4 overflow-y-auto h-full"><CanvasPdfPreview resumeData={resumeData} template={template} /></div>
              ) : (
                <PDFViewer width="100%" height="100%" showToolbar={false}>
                  <ResumeDocument data={resumeData} template={template} />
                </PDFViewer>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                <span className="text-4xl">📝</span>
                <p className="text-white font-semibold">Word (.docx) format</p>
                <p className="text-slate-400 text-sm leading-relaxed">Preview not available for Word. Download to open in Microsoft Word or Google Docs.</p>
              </div>
            )}
          </div>
        </div>

        </div>{/* end two-column body */}
    </div>

    {modalMode && (
      <SaveResumeModal
        defaultCompany={savedLabel?.company ?? ''}
        defaultRole={savedLabel?.role ?? ''}
        onSave={handleModalSubmit}
        onClose={() => setModalMode(null)}
      />
    )}

    {/* Download filename modal */}
    {showDownloadModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          style={{ animation: 'modal-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <div className="px-5 pt-5 pb-4 space-y-4">
            <div>
              <p className="text-white font-semibold text-sm mb-1">Name your file</p>
              <p className="text-slate-400 text-sm">
                Saving as <span className="text-blue-400 font-medium">{downloadFormat === 'docx' ? 'Word (.docx)' : 'PDF'}</span> — change format above if needed.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 focus-within:border-blue-500 rounded-xl px-3 py-2.5 transition-colors">
              <input
                autoFocus
                type="text"
                value={downloadFileName}
                onChange={e => setDownloadFileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') triggerDownload(downloadFileName) }}
                className="flex-1 bg-transparent text-white text-sm outline-none min-w-0"
                spellCheck={false}
              />
              <span className="text-slate-500 text-sm shrink-0">{downloadFormat === 'docx' ? '.docx' : '.pdf'}</span>
            </div>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={() => setShowDownloadModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => triggerDownload(downloadFileName)}
              disabled={downloadingPdf}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {downloadingPdf ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
