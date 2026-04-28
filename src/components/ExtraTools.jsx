import { useState } from 'react'
import { geminiText, geminiJSON } from '../utils/groq'
import { coverLetterPrompt, interviewQuestionsPrompt, linkedinAboutPrompt } from '../utils/prompts'

function ToolCard({ icon, title, description, buttonLabel, onGenerate, result, resultType = 'text' }) {
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setStatus('loading')
    setErrorMsg('')
    try {
      await onGenerate()
      setStatus('done')
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  function copyToClipboard(text) {
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
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-white text-sm font-semibold">{title}</p>
            <p className="text-slate-500 text-xs">{description}</p>
          </div>
        </div>
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={handleGenerate}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            {status === 'error' ? 'Retry' : buttonLabel}
          </button>
        )}
        {status === 'loading' && (
          <svg className="animate-spin h-4 w-4 text-blue-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {status === 'done' && result && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleGenerate}
              className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
              title="Regenerate"
            >
              ↺
            </button>
            <button
              onClick={() => copyToClipboard(
                resultType === 'list'
                  ? result.map((q, i) => `${i + 1}. ${q.question}\n💡 ${q.tip}${q.whatToAvoid ? `\n✗ Avoid: ${q.whatToAvoid}` : ''}`).join('\n\n')
                  : result
              )}
              className="text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
      {status === 'error' && (
        <div className="border-t border-slate-800 px-4 py-2.5">
          <p className="text-red-400 text-xs">{errorMsg}</p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="border-t border-slate-800 p-4 max-h-64 overflow-y-auto">
          {resultType === 'text' && (
            <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{result}</p>
          )}
          {resultType === 'list' && (
            <div className="space-y-3">
              {result.map((item, i) => {
                const diffColor = item.difficulty === 'hard' ? 'text-red-400 bg-red-500/10 border-red-500/20' : item.difficulty === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                return (
                  <div key={i} className="border-l-2 border-blue-500/40 pl-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-xs font-medium">{i + 1}. {item.question}</p>
                      {item.difficulty && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 font-medium ${diffColor}`}>{item.difficulty}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs">💡 {item.tip}</p>
                    {item.whatToAvoid && (
                      <p className="text-red-400/70 text-xs">✗ Avoid: {item.whatToAvoid}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExtraTools({ apiKey, resumeData, jobDescription }) {
  const [coverLetter, setCoverLetter] = useState(null)
  const [interviewQuestions, setInterviewQuestions] = useState(null)
  const [linkedinSummary, setLinkedinSummary] = useState(null)

  async function generateCoverLetter() {
    const { prompt, temperature, maxOutputTokens } = coverLetterPrompt(resumeData, jobDescription)
    setCoverLetter(await geminiText(apiKey, prompt, { temperature, maxOutputTokens }))
  }

  async function generateInterviewQuestions() {
    const { prompt, temperature, maxOutputTokens } = interviewQuestionsPrompt(resumeData, jobDescription)
    setInterviewQuestions(await geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }))
  }

  async function generateLinkedinSummary() {
    const { prompt, temperature, maxOutputTokens } = linkedinAboutPrompt(resumeData, jobDescription)
    setLinkedinSummary(await geminiText(apiKey, prompt, { temperature, maxOutputTokens }))
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider px-1">More tools for your application</p>

      <ToolCard
        icon="✉️"
        title="Cover Letter"
        description="Tailored to this exact job"
        buttonLabel="Generate"
        onGenerate={generateCoverLetter}
        result={coverLetter}
        resultType="text"
      />

      <ToolCard
        icon="🎯"
        title="Interview Prep"
        description="Top 10 questions you'll likely be asked"
        buttonLabel="Generate"
        onGenerate={generateInterviewQuestions}
        result={interviewQuestions}
        resultType="list"
      />

      <ToolCard
        icon="💼"
        title="LinkedIn Summary"
        description="Optimized About section for your profile"
        buttonLabel="Generate"
        onGenerate={generateLinkedinSummary}
        result={linkedinSummary}
        resultType="text"
      />
    </div>
  )
}
