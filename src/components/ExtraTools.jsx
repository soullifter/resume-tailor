import { useState, useEffect, useRef } from 'react'
import { geminiText, geminiJSON, compoundSearch } from '../utils/groq'
import { coverLetterPrompt, interviewQuestionsPrompt, linkedinAboutPrompt } from '../utils/prompts'

// ── Shared copy helper ────────────────────────────────────────────────────────

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}
function fallbackCopy(text) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
  document.body.appendChild(el)
  el.focus(); el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// ── TTS hook ──────────────────────────────────────────────────────────────────

function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const uttRef = useRef(null)

  function speak(text) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/\*/g, ''))
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    uttRef.current = utt
    window.speechSynthesis.speak(utt)
    setSpeaking(true)
  }

  function stop() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  return { speaking, speak, stop }
}

function SpeakButton({ getText }) {
  const { speaking, speak, stop } = useSpeech()
  if (!window.speechSynthesis) return null
  return (
    <button
      onClick={() => speaking ? stop() : speak(getText())}
      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
      title={speaking ? 'Stop reading' : 'Read aloud'}>
      {speaking
        ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12m-4-9v6m-2-3a9 9 0 0118 0"/></svg>
      }
    </button>
  )
}

// ── Markdown renderer (bold, italic, tables) ──────────────────────────────────

function inlineMarkdown(text) {
  // Split on **bold** and *italic* tokens
  const parts = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0, m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) parts.push(<strong key={m.index} className="text-white font-semibold">{m[1]}</strong>)
    else parts.push(<em key={m.index} className="text-slate-400 not-italic">{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function MarkdownText({ text }) {
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Table: starts with |
    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const rows = tableLines
        .filter(l => !/^\s*\|[-| :]+\|\s*$/.test(l)) // skip separator rows
        .map(l => l.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim()))
      if (rows.length > 0) {
        elements.push(
          <div key={i} className="overflow-x-auto my-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="text-left text-slate-300 font-semibold px-2 py-1 border-b border-slate-700">{inlineMarkdown(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-800/40' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="text-slate-300 px-2 py-1 border-b border-slate-800">{inlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }
    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      i++
      continue
    }
    // Normal paragraph line
    elements.push(
      <p key={i} className="text-slate-300 text-sm leading-relaxed">{inlineMarkdown(line)}</p>
    )
    i++
  }
  return <div className="space-y-0.5">{elements}</div>
}

// ── Standard tool card (existing tools) ──────────────────────────────────────

function ToolCard({ icon, title, description, buttonLabel, onGenerate, result, resultType = 'text', badge }) {
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  async function handleGenerate() {
    setStatus('loading')
    setErrorMsg('')
    setCollapsed(false)
    try {
      await onGenerate()
      setStatus('done')
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  function copy(text) {
    copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-semibold">{title}</p>
              {badge && <span className="text-xs px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">{badge}</span>}
            </div>
            <p className="text-slate-500 text-sm">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {(status === 'idle' || status === 'error') && (
            <button onClick={handleGenerate}
              className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
              {status === 'error' ? 'Retry' : buttonLabel}
            </button>
          )}
          {status === 'loading' && (
            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {status === 'done' && result && (
            <>
              <button onClick={handleGenerate}
                className="text-sm text-slate-500 hover:text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
                title="Regenerate">↺</button>
              <button
                onClick={() => copy(
                  resultType === 'list'
                    ? result.map((q, i) => `${i + 1}. ${q.question}\n💡 ${q.tip}${q.whatToAvoid ? `\n✗ Avoid: ${q.whatToAvoid}` : ''}`).join('\n\n')
                    : result
                )}
                className="text-sm text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors">
                {copied ? 'Copied!' : 'Copy'}
              </button>
              {resultType === 'text' && (
                <SpeakButton getText={() => result} />
              )}
              <button onClick={() => setCollapsed(c => !c)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={collapsed ? 'Expand' : 'Collapse'}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      {status === 'error' && (
        <div className="border-t border-slate-800 px-4 py-2.5">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}
      {status === 'done' && result && !collapsed && (
        <div className="border-t border-slate-800 p-4 max-h-64 overflow-y-auto">
          {resultType === 'text' && <MarkdownText text={result} />}
          {resultType === 'list' && (
            <div className="space-y-3">
              {result.map((item, i) => {
                const diffColor = item.difficulty === 'hard' ? 'text-red-400 bg-red-500/10 border-red-500/20' : item.difficulty === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                return (
                  <div key={i} className="border-l-2 border-blue-500/40 pl-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-sm font-medium">{i + 1}. {item.question}</p>
                      {item.difficulty && (
                        <span className={`text-sm px-1.5 py-0.5 rounded border shrink-0 font-medium ${diffColor}`}>{item.difficulty}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm">💡 {item.tip}</p>
                    {item.whatToAvoid && <p className="text-red-400/70 text-sm">✗ Avoid: {item.whatToAvoid}</p>}
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

// ── Research card (compound-powered tools with input fields) ──────────────────

function ResearchCard({ icon, title, description, badge, fields, onGenerate, result, resultType = 'text' }) {
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, f.defaultValue || '']))
  )
  const [status, setStatus] = useState('idle')

  // Sync defaultValue changes into empty fields (pre-populate when jobInfo loads after mount)
  const defaultsKey = fields.map(f => f.defaultValue || '').join('|')
  useEffect(() => {
    setInputs(prev => {
      const updates = {}
      fields.forEach(f => {
        if (f.defaultValue && !prev[f.key]) updates[f.key] = f.defaultValue
      })
      return Object.keys(updates).length ? { ...prev, ...updates } : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsKey])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  const allFilled = fields.filter(f => f.required !== false).every(f => inputs[f.key]?.trim())

  async function handleGenerate() {
    setStatus('loading')
    setError('')
    setCollapsed(false)
    try {
      await onGenerate(inputs)
      setStatus('done')
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  function copy(text, key) {
    copyText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-semibold">{title}</p>
              {badge && <span className="text-xs px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">{badge}</span>}
            </div>
            <p className="text-slate-500 text-sm">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {fields.map(f => (
            <div key={f.key} className={f.fullWidth ? 'col-span-2' : ''}>
              <label className="text-slate-500 text-xs block mb-1">{f.label}</label>
              <input
                value={inputs[f.key]}
                onChange={e => setInputs(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          {status === 'loading' ? (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span>Searching the web & writing...</span>
            </div>
          ) : (
            <button onClick={handleGenerate} disabled={!allFilled}
              className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {status === 'error' ? 'Retry' : status === 'done' ? '↺ Regenerate' : 'Generate'}
            </button>
          )}
          {status === 'done' && result && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(
                  resultType === 'email' ? `Subject: ${result.subject}\n\n${result.body}` : result,
                  'all'
                )}
                className="text-sm text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors">
                {copied === 'all' ? 'Copied!' : 'Copy all'}
              </button>
              <SpeakButton getText={() => resultType === 'email' ? result.body : result} />
              <button onClick={() => setCollapsed(c => !c)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={collapsed ? 'Expand' : 'Collapse'}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div className="border-t border-slate-800 px-4 py-2.5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {status === 'done' && result && !collapsed && (
        <div className="border-t border-slate-800 p-4 max-h-80 overflow-y-auto space-y-3">
          {resultType === 'email' ? (
            <>
              <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider shrink-0">Subject</span>
                <span className="text-white text-sm flex-1 mx-2">{result.subject}</span>
                <button onClick={() => copy(result.subject, 'subject')}
                  className="text-slate-400 hover:text-emerald-400 text-xs transition-colors shrink-0">
                  {copied === 'subject' ? '✓' : 'Copy'}
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Body</span>
                  <button onClick={() => copy(result.body, 'body')}
                    className="text-slate-400 hover:text-emerald-400 text-xs transition-colors">
                    {copied === 'body' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <MarkdownText text={result.body} />
              </div>
            </>
          ) : (
            <MarkdownText text={result} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExtraTools({ apiKey, resumeData, jobDescription, jobInfo }) {
  const [coverLetter, setCoverLetter]           = useState(null)
  const [interviewQuestions, setInterviewQuestions] = useState(null)
  const [linkedinSummary, setLinkedinSummary]   = useState(null)
  const [coldOutreach, setColdOutreach]         = useState(null)
  const [salaryResult, setSalaryResult]         = useState(null)

  // ── Cover letter (enhanced with compound company research if company known) ──
  async function generateCoverLetter() {
    let companyContext = ''
    const company = jobInfo?.company
    if (company && apiKey) {
      try {
        companyContext = await compoundSearch(apiKey,
          `Research the company "${company}": their mission, core products/services, tech stack, recent news or achievements, and culture. Be concise — 150 words max.`,
          { maxOutputTokens: 400 }
        )
      } catch { /* fall back silently */ }
    }
    const { prompt, temperature, maxOutputTokens } = coverLetterPrompt(resumeData, jobDescription)
    const finalPrompt = companyContext
      ? `${prompt}\n\nCOMPANY RESEARCH — reference 1-2 specific facts from this in your opening paragraph:\n${companyContext}\n\nIMPORTANT: Your opening paragraph MUST mention something specific and real about ${company} from the research above.`
      : prompt
    setCoverLetter(await geminiText(apiKey, finalPrompt, { temperature, maxOutputTokens }))
  }

  // ── Interview prep ────────────────────────────────────────────────────────
  async function generateInterviewQuestions() {
    const { prompt, temperature, maxOutputTokens } = interviewQuestionsPrompt(resumeData, jobDescription)
    setInterviewQuestions(await geminiJSON(apiKey, prompt, { temperature, maxOutputTokens }))
  }

  // ── LinkedIn summary ──────────────────────────────────────────────────────
  async function generateLinkedinSummary() {
    const { prompt, temperature, maxOutputTokens } = linkedinAboutPrompt(resumeData, jobDescription)
    setLinkedinSummary(await geminiText(apiKey, prompt, { temperature, maxOutputTokens }))
  }

  // ── Cold outreach email (compound) ────────────────────────────────────────
  async function generateColdOutreach({ company, role }) {
    const background = [
      resumeData.name             ? `Name: ${resumeData.name}` : '',
      resumeData.experience?.[0]  ? `Current/recent role: ${resumeData.experience[0].title} at ${resumeData.experience[0].company}` : '',
      resumeData.summary          ? `Summary: ${resumeData.summary}` : '',
      resumeData.skills?.length   ? `Key skills: ${resumeData.skills.slice(0, 8).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const raw = await compoundSearch(apiKey, `
I'm applying for a ${role} position at ${company}. Research ${company} and write a cold outreach email to help me get a referral or introduction.

MY BACKGROUND:
${background}

Instructions:
- Research ${company}: their mission, products, tech stack, recent news, culture
- Opening line MUST reference something specific and real you found about ${company} — not generic praise
- Keep the email under 150 words — concise and direct
- Tone: confident, not desperate; professional but warm
- End with a clear, low-friction ask (e.g., a 15-min chat)

Return ONLY valid JSON (no markdown): {"subject": "...", "body": "..."}`, { maxOutputTokens: 700 })

    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Could not parse response — try again.')
    setColdOutreach(JSON.parse(cleaned.slice(start, end + 1)))
  }

  // ── Salary range lookup (compound) ───────────────────────────────────────
  async function generateSalaryLookup({ role, company, location }) {
    const context = [role, company && `at ${company}`, location && `in ${location}`].filter(Boolean).join(' ')
    const result = await compoundSearch(apiKey,
      `What is the current market salary range for ${context}? Search for up-to-date data and provide: the typical salary range (min–max), median/midpoint, any equity or bonus components typical for this role, and the sources you used. Format as a clear, readable summary.`,
      { maxOutputTokens: 500 }
    )
    setSalaryResult(result)
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider px-1">More tools for your application</p>

      <ToolCard
        icon="✉️"
        title="Cover Letter"
        description={jobInfo?.company ? `Personalized with real ${jobInfo.company} research` : 'Tailored to this exact job'}
        badge={jobInfo?.company ? 'Web search' : undefined}
        buttonLabel="Generate"
        onGenerate={generateCoverLetter}
        result={coverLetter}
        resultType="text"
      />

      <ResearchCard
        icon="📨"
        title="Cold Outreach Email"
        description="Researches the company and writes a hyper-personalized email"
        badge="Web search"
        fields={[
          { key: 'company', label: 'Company', placeholder: 'e.g. Stripe', defaultValue: jobInfo?.company || '', required: true },
          { key: 'role',    label: 'Role',    placeholder: 'e.g. Software Engineer', defaultValue: jobInfo?.title || '', required: true },
        ]}
        onGenerate={generateColdOutreach}
        result={coldOutreach}
        resultType="email"
      />

      <ResearchCard
        icon="💰"
        title="Salary Range Lookup"
        description="Real-time market rate for your role and location"
        badge="Web search"
        fields={[
          { key: 'role',     label: 'Role',     placeholder: 'e.g. Senior Software Engineer', defaultValue: jobInfo?.title || '',    required: true },
          { key: 'company',  label: 'Company',  placeholder: 'e.g. Stripe',                   defaultValue: jobInfo?.company || '' },
          { key: 'location', label: 'Location', placeholder: 'e.g. San Francisco, CA',        defaultValue: jobInfo?.location || '', fullWidth: false },
        ]}
        onGenerate={generateSalaryLookup}
        result={salaryResult}
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
