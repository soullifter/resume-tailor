import { useState } from 'react'
import { geminiJSON } from '../utils/groq'
import { qualityPrompt, trimPrompt, countResumeWords } from '../utils/prompts'

const ISSUE_META = {
  placeholder:    { label: 'Unfilled Placeholder', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  quantification: { label: 'Add Metrics',          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
}

const TRIM_OPTIONS = [
  { value: 1,   label: '1 page' },
  { value: 1.5, label: '1.5 pages' },
  { value: 2,   label: '2 pages' },
  { value: 3,   label: '3 pages' },
]

export default function ResumeQualityPanel({ resumeData, trimSource, pageCount, measurePages, onTrimmed, apiKey, userMode = 'standard' }) {
  const [analyzeStatus, setAnalyzeStatus] = useState('idle') // idle | loading | done | error
  const [analyzeError, setAnalyzeError]   = useState('')
  const [trimStatus, setTrimStatus]       = useState('idle') // idle | loading | done | error | fits
  const [trimError, setTrimError]         = useState('')
  const [trimPages, setTrimPages]         = useState(null)  // actual page count after trim
  const [result, setResult]               = useState(null)
  const [trimTarget, setTrimTarget]       = useState(1)

  async function runAnalysis() {
    setAnalyzeStatus('loading')
    setAnalyzeError('')
    setResult(null)
    try {
      const { prompt, temperature, maxOutputTokens } = qualityPrompt(resumeData, userMode)
      const res = await geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }, true)
      setResult(res)
      setAnalyzeStatus('done')
    } catch (e) {
      setAnalyzeError(e.message || 'Analysis failed. Try again.')
      setAnalyzeStatus('error')
    }
  }

  async function runTrim() {
    setTrimStatus('loading')
    setTrimError('')
    setTrimPages(null)
    const MAX_ATTEMPTS = 3
    try {
      let trimmed = trimSource || resumeData
      let numPages = null
      let wordsPerPage = null

      // Always measure trimSource first — pageCount reflects current resumeData
      // which may already be a previously trimmed version, not the full original
      if (measurePages) {
        const result = await measurePages(trimmed)
        numPages = result.numPages
        wordsPerPage = result.wordsPerPage
      }

      if (numPages !== null && numPages <= trimTarget) {
        setTrimPages(numPages)
        onTrimmed(trimmed)
        setTrimStatus('fits')
        return
      }

      let prevPages = null
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (numPages && numPages <= trimTarget) break
        if (prevPages !== null && numPages === prevPages) break
        const words = countResumeWords(trimmed)
        const { prompt, temperature, maxOutputTokens } = trimPrompt(trimmed, trimTarget, numPages, words, wordsPerPage, attempt, MAX_ATTEMPTS)
        trimmed = await geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }, true)
        prevPages = numPages
        if (measurePages) {
          const result = await measurePages(trimmed)
          numPages = result.numPages
          wordsPerPage = result.wordsPerPage
        }
      }

      setTrimPages(numPages)
      onTrimmed(trimmed)
      setTrimStatus('done')
    } catch (e) {
      setTrimError(e.message || 'Trim failed. Try again.')
      setTrimStatus('error')
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <style>{`@keyframes card-stagger-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-white text-sm font-semibold">Pre-Submit Check</p>
        <p className="text-xs text-slate-500 mt-0.5">Unfilled placeholders · missing metrics · submit readiness</p>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Analyze section ── */}
        {analyzeStatus === 'idle' && (
          <button
            onClick={runAnalysis}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Run Pre-Submit Check
          </button>
        )}

        {analyzeStatus === 'loading' && (
          <div className="flex items-center gap-2 text-blue-400 text-sm py-1">
            <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Checking for quality issues...
          </div>
        )}

        {analyzeStatus === 'error' && (
          <div className="space-y-2">
            <p className="text-red-400 text-xs">{analyzeError}</p>
            <button onClick={runAnalysis} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              Try Again
            </button>
          </div>
        )}

        {analyzeStatus === 'done' && result && (
          <div className="space-y-3">

            {/* Issues */}
            {result.issues?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">{result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} found — fix manually in the editor above</p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[...result.issues].sort((a, b) => (a.type === 'placeholder' ? -1 : b.type === 'placeholder' ? 1 : 0)).map((issue, i) => {
                    const meta = ISSUE_META[issue.type] || { label: issue.type, color: 'text-slate-400 bg-slate-800 border-slate-700' }
                    return (
                      <div key={i} className={`text-xs px-3 py-2.5 rounded-lg border ${meta.color}`}
                        style={{ animation: `card-stagger-in 0.35s ease-out ${i * 55}ms both` }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{meta.label}</span>
                          {issue.location && <span className="opacity-60 font-normal">{issue.location}</span>}
                        </div>
                        {issue.suggestion && (
                          <p className="mt-1 opacity-80 leading-relaxed">{issue.suggestion}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-1.5">
                  {result.issues.some(i => i.type === 'placeholder') && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-xs text-red-400 text-center leading-relaxed font-medium">
                      Fill in all [X] placeholders before submitting — these are submit blockers.
                    </div>
                  )}
                  {result.issues.some(i => i.type === 'quantification') && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 text-xs text-blue-400 text-center leading-relaxed">
                      Add real numbers to the flagged bullets — edit them directly above.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <span>✓</span> No quality issues found — resume looks clean!
              </div>
            )}

            {/* Submit readiness */}
            {result.submitCheck && (() => {
              const score = result.submitCheck.score ?? 0
              const band = score >= 90 ? 'great' : score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'bad'
              const bandStyle = {
                great: { wrap: 'bg-emerald-500/10 border-emerald-500/20', label: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30', ring: 'text-emerald-400', tag: '✓ Ready to Submit' },
                ok:    { wrap: 'bg-emerald-500/10 border-emerald-500/20', label: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30', ring: 'text-emerald-400', tag: '✓ Good to Submit' },
                warn:  { wrap: 'bg-amber-500/10 border-amber-500/20',   label: 'text-amber-300 bg-amber-500/20 border-amber-500/30',   ring: 'text-amber-400',   tag: '⚠ Needs Work' },
                bad:   { wrap: 'bg-red-500/10 border-red-500/20',       label: 'text-red-300 bg-red-500/20 border-red-500/30',         ring: 'text-red-400',     tag: '✗ Not Ready' },
              }[band]
              return (
                <div className={`rounded-xl p-4 border space-y-3 ${bandStyle.wrap}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white text-xs font-semibold block">Submit Readiness</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${bandStyle.ring}`}>{score}</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${bandStyle.label}`}>
                        {bandStyle.tag}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 italic leading-relaxed">{result.submitCheck.verdict}</p>
                  {result.submitCheck.blockers?.length > 0 && (
                    <div className="space-y-1">
                      {result.submitCheck.blockers.map((b, i) => (
                        <p key={i} className="text-xs text-red-400 flex gap-1.5 font-medium"><span className="shrink-0">✗</span>{b}</p>
                      ))}
                    </div>
                  )}
                  {result.submitCheck.warnings?.length > 0 && (
                    <div className="space-y-1">
                      {result.submitCheck.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400 flex gap-1.5"><span className="shrink-0">⚠</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {result.submitCheck.positives?.length > 0 && (
                    <div className="space-y-1">
                      {result.submitCheck.positives.slice(0, 3).map((p, i) => (
                        <p key={i} className="text-xs text-emerald-400 flex gap-1.5"><span className="shrink-0">✓</span>{p}</p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Re-analyze — always prominent after first run */}
            <button
              onClick={runAnalysis}
              className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm transition-colors"
            >
              Re-analyze
            </button>
          </div>
        )}

        {/* ── Length trimmer ── */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Length Trimmer</p>
            {pageCount && (
              <span className="text-xs text-slate-500">
                Currently <span className="text-white font-medium">~{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">Always trims from the saved base — switching page targets never loses content permanently.</p>
          <div className="flex gap-2 mb-2">
            {TRIM_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTrimTarget(opt.value); setTrimStatus('idle') }}
                className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${
                  trimTarget === opt.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={runTrim}
            disabled={trimStatus === 'loading'}
            className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {trimStatus === 'loading' ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Trimming...
              </>
            ) : `Trim to ${trimTarget} page${trimTarget !== 1 ? 's' : ''}`}
          </button>
          {trimStatus === 'done' && (
            <p className="text-emerald-400 text-xs mt-2 text-center">
              ✓ {trimPages !== null && trimPages <= trimTarget
                ? `Trimmed to ${trimPages} page${trimPages !== 1 ? 's' : ''} — review above`
                : `Trimmed as much as possible — review above`}
            </p>
          )}
          {trimStatus === 'fits' && (
            <p className="text-emerald-400 text-xs mt-2 text-center">✓ Original already fits {trimTarget} page{trimTarget !== 1 ? 's' : ''} — restored above</p>
          )}
          {trimStatus === 'error' && (
            <p className="text-red-400 text-xs mt-2 text-center">{trimError}</p>
          )}
        </div>

      </div>
    </div>
  )
}
