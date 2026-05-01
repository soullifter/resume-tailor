import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import StepLayout from './StepLayout'
import ResumeHealthScore from './ResumeHealthScore'
import { validateResume, geminiJSON } from '../utils/groq'
import { MicButton } from '../hooks/useVoiceInput.jsx'

async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const mammoth = await import('mammoth')
  const result = await mammoth.default.extractRawText({ arrayBuffer })
  if (!result.value || result.value.length < 50) throw new Error('Could not extract text from DOCX file.')
  return result.value
}

function readAsArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(blob)
  })
}

async function getPdfDoc(arrayBuffer) {
  const strategies = [
    // 1. Local module worker (works on modern desktop/mobile)
    () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    },
    // 2. CDN worker — reliable fallback for mobile Safari
    () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    },
    // 3. No worker — main thread only, works everywhere
    () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    },
  ]

  for (let i = 0; i < strategies.length; i++) {
    try {
      strategies[i]()
      console.log('[getPdfDoc] trying strategy', i)
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      console.log('[getPdfDoc] strategy', i, 'succeeded')
      return doc
    } catch (e) {
      console.warn('[getPdfDoc] strategy', i, 'failed:', e)
      if (i === strategies.length - 1) throw e
    }
  }
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await readAsArrayBuffer(file)
  const pdf = await getPdfDoc(arrayBuffer)
  let fullText = ''
  const embeddedUrls = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Filter out TextMarkedContent items (pdfjs v3+) which have no .str property
    fullText += content.items.filter(item => typeof item.str === 'string').map(item => item.str).join(' ') + '\n'

    // Extract hyperlink annotations (embedded URLs not visible as text)
    const annotations = await page.getAnnotations()
    for (const ann of annotations) {
      if (ann.subtype === 'Link' && ann.url) {
        embeddedUrls.push(ann.url)
      }
    }
  }

  // Append unique embedded URLs to text so LLM can see them
  if (embeddedUrls.length > 0) {
    const unique = [...new Set(embeddedUrls)]
    fullText += '\n[Embedded links: ' + unique.join(', ') + ']'
  }

  return { text: fullText.trim(), numPages: pdf.numPages }
}

function resumeDataToText(d) {
  const lines = []
  if (d.name) lines.push(d.name)
  const contact = [d.email, d.phone, d.location].filter(Boolean).join(' | ')
  if (contact) lines.push(contact)
  if (d.linkedin) lines.push(d.linkedin)
  lines.push('')
  if (d.summary) { lines.push('SUMMARY'); lines.push(d.summary); lines.push('') }
  if (d.experience?.length) {
    lines.push('EXPERIENCE')
    for (const exp of d.experience) {
      lines.push(`${exp.title} at ${exp.company} (${exp.dates})`)
      for (const b of (exp.bullets || [])) lines.push(`• ${b}`)
    }
    lines.push('')
  }
  if (d.skills?.length) { lines.push('SKILLS'); lines.push(d.skills.join(', ')); lines.push('') }
  if (d.education?.length) {
    lines.push('EDUCATION')
    for (const edu of d.education) lines.push(`${edu.degree} — ${edu.school} (${edu.dates})`)
    lines.push('')
  }
  if (d.certifications?.length) {
    lines.push('CERTIFICATIONS')
    for (const c of d.certifications) {
      const parts = [c.name, c.issuer, c.date].filter(Boolean)
      lines.push(parts.join(' · '))
    }
    lines.push('')
  }
  if (d.extraSections?.length) {
    for (const sec of d.extraSections) {
      if (!sec.title?.trim()) continue
      lines.push(sec.title.toUpperCase())
      for (const item of (sec.items || [])) if (item.trim()) lines.push(`• ${item}`)
      lines.push('')
    }
  }
  return lines.join('\n').trim()
}

const UPLOAD_STYLES = `
@keyframes zone-appear {
  0%   { border-color: rgba(59,130,246,0.6); box-shadow: 0 0 0 6px rgba(59,130,246,0.08); }
  60%  { border-color: rgba(59,130,246,0.3); box-shadow: 0 0 0 2px rgba(59,130,246,0.04); }
  100% { border-color: rgb(51,65,85); box-shadow: none; }
}
@keyframes spark-out {
  0%   { opacity: 1; transform: translate(-50%,-50%) rotate(var(--deg)) translateY(0) scale(1); }
  100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--deg)) translateY(-16px) scale(0); }
}
@keyframes zone-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50%       { box-shadow: 0 0 0 10px rgba(59,130,246,0.10); }
}
@keyframes slide-down-spring {
  0%   { opacity: 0; transform: translateY(-16px) scale(0.97); }
  60%  { opacity: 1; transform: translateY(3px) scale(1.005); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes scan-line {
  0%   { top: 0%;   opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
@keyframes parse-msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes mode-selected-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.15); }
  50%       { box-shadow: 0 0 12px 2px rgba(59,130,246,0.18); }
}
`

const PARSE_MESSAGES = [
  'Reading your PDF...',
  'Extracting experience...',
  'Finding your skills...',
  'Pulling contact info...',
  'Almost done...',
]

function SparkBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
          style={{
            left: '18px', top: '18px',
            '--deg': `${deg}deg`,
            animation: `spark-out 0.55s ease-out ${i * 25}ms both`,
          }}
        />
      ))}
    </div>
  )
}

function ParseCinematic() {
  const [idx, setIdx]     = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % PARSE_MESSAGES.length)
        setVisible(true)
      }, 180)
    }, 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {/* Mini resume silhouette with scan line */}
      <div className="relative w-14 h-[72px] bg-slate-800 border border-slate-600/60 rounded-md overflow-hidden shadow-lg">
        <div
          className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
          style={{ animation: 'scan-line 1.1s ease-in-out infinite' }}
        />
        <div className="p-2 space-y-1.5 pt-2">
          <div className="h-1.5 bg-blue-500/40 rounded-full w-3/4" />
          <div className="h-1 bg-slate-600 rounded-full w-full" />
          <div className="h-1 bg-slate-600 rounded-full w-5/6" />
          <div className="h-1 bg-slate-600 rounded-full w-4/5" />
          <div className="h-1.5 bg-slate-600/70 rounded-full w-1/2 mt-1" />
          <div className="h-1 bg-slate-700 rounded-full w-full" />
          <div className="h-1 bg-slate-700 rounded-full w-2/3" />
        </div>
      </div>
      {/* Cycling message */}
      <p
        key={idx}
        className="text-white text-sm font-medium text-center"
        style={{ animation: 'parse-msg-in 0.22s ease-out both', opacity: visible ? 1 : 0, transition: 'opacity 0.18s' }}
      >
        {PARSE_MESSAGES[idx]}
      </p>
    </div>
  )
}

const USER_MODES = [
  { id: 'standard',   label: 'Standard',             icon: '📄', desc: 'Regular resume, no special circumstances' },
  { id: 'fresh_grad', label: 'Fresh Graduate',        icon: '🎓', desc: 'Projects & internships as your edge' },
  { id: 'switcher',   label: 'Career Switcher',       icon: '🔄', desc: 'Moving industries or job function' },
  { id: 'gap',        label: 'Employment Gap',        icon: '⏸️', desc: '6+ month break in work history' },
  { id: 'senior',     label: 'Senior / Executive',   icon: '👔', desc: '10+ years or director / VP level' },
  { id: 'freelance',  label: 'Freelance / Contract', icon: '💼', desc: 'Multiple contracts or self-employed' },
]

function UserModeSelector({ value, onChange }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-white mb-1">Who are you?</p>
      <p className="text-sm text-slate-500 mb-3">Pick your situation — we tailor the AI to match.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {USER_MODES.map(mode => {
          const active = value === mode.id
          return (
            <button
              key={mode.id}
              onClick={() => onChange(mode.id)}
              className={`relative text-left px-3 py-2.5 rounded-xl border text-sm transition-all duration-200 overflow-hidden ${
                active
                  ? 'border-blue-500 bg-blue-600/10 text-white scale-[1.02] shadow-lg'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-md'
              }`}
              style={active ? { animation: 'mode-selected-glow 2.5s ease-in-out infinite' } : {}}
            >
              {/* Left accent bar */}
              <span className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-all duration-200 ${active ? 'bg-blue-400 opacity-100' : 'bg-blue-500 opacity-0'}`} />
              <span className="block text-base mb-0.5">{mode.icon}</span>
              <span className="font-semibold block leading-tight">{mode.label}</span>
              <span className={`block mt-0.5 text-[10px] leading-snug ${active ? 'text-blue-300' : 'text-slate-600'}`}>{mode.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Voice experience filler ──────────────────────────────────────────────────

function VoiceExpFill({ apiKey, onFilled }) {
  const [structuring, setStructuring] = useState(false)
  const [error, setError] = useState('')

  async function handleTranscript(transcript) {
    setStructuring(true)
    setError('')
    try {
      const result = await geminiJSON(apiKey,
        `Extract job experience from this voice note into JSON.
Voice note: "${transcript}"
Return ONLY valid JSON: {"title":"","company":"","dates":"","bullets":[]}
Rules: 2-4 bullets max, achievement-focused, action verb start, only use info mentioned, empty string if not mentioned.`,
        { temperature: 0.2, maxOutputTokens: 400, _modelId: 'llama-3.1-8b-instant' })
      onFilled(result)
      setStructuring(false)
    } catch {
      setError('Could not structure — try again.')
      setStructuring(false)
    }
  }

  if (structuring) return (
    <span className="flex items-center gap-1.5 text-xs text-blue-400">
      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Structuring...
    </span>
  )
  if (error) return <span className="text-xs text-red-400">{error}</span>
  return <MicButton apiKey={apiKey} label="Fill from voice" onTranscript={handleTranscript} />
}

// ── Build from scratch ──────────────────────────────────────────────────────

function BuildFromScratch({ onDone, apiKey }) {
  const [data, setData] = useState({
    name: '', email: '', phone: '', location: '', linkedin: '',
    summary: '',
    experience: [{ title: '', company: '', dates: '', bullets: [''] }],
    skills: [],
    education: [{ degree: '', school: '', dates: '' }],
    certifications: [],
    extraSections: [],
  })
  const [skillInput, setSkillInput] = useState('')

  function set(field, value) { setData(d => ({ ...d, [field]: value })) }

  function setExp(i, field, value) {
    setData(d => ({ ...d, experience: d.experience.map((e, j) => j === i ? { ...e, [field]: value } : e) }))
  }
  function setBullet(ei, bi, value) {
    setData(d => ({ ...d, experience: d.experience.map((e, j) => j !== ei ? e : { ...e, bullets: e.bullets.map((b, k) => k === bi ? value : b) }) }))
  }
  function addBullet(ei) {
    setData(d => ({ ...d, experience: d.experience.map((e, j) => j !== ei ? e : { ...e, bullets: [...e.bullets, ''] }) }))
  }
  function removeBullet(ei, bi) {
    setData(d => ({ ...d, experience: d.experience.map((e, j) => j !== ei ? e : { ...e, bullets: e.bullets.filter((_, k) => k !== bi) }) }))
  }
  function addExp() {
    setData(d => ({ ...d, experience: [...d.experience, { title: '', company: '', dates: '', bullets: [''] }] }))
  }
  function removeExp(i) {
    setData(d => ({ ...d, experience: d.experience.filter((_, j) => j !== i) }))
  }

  function setEdu(i, field, value) {
    setData(d => ({ ...d, education: d.education.map((e, j) => j === i ? { ...e, [field]: value } : e) }))
  }

  function addSkill() {
    const s = skillInput.trim()
    if (s && !data.skills.includes(s)) set('skills', [...data.skills, s])
    setSkillInput('')
  }

  function setCert(i, field, value) {
    setData(d => ({ ...d, certifications: d.certifications.map((c, j) => j === i ? { ...c, [field]: value } : c) }))
  }
  function addCert() {
    setData(d => ({ ...d, certifications: [...d.certifications, { name: '', issuer: '', date: '' }] }))
  }
  function removeCert(i) {
    setData(d => ({ ...d, certifications: d.certifications.filter((_, j) => j !== i) }))
  }

  function setExtraSection(i, field, value) {
    setData(d => ({ ...d, extraSections: d.extraSections.map((s, j) => j === i ? { ...s, [field]: value } : s) }))
  }
  function setExtraItem(si, ii, value) {
    setData(d => ({ ...d, extraSections: d.extraSections.map((s, j) => j !== si ? s : { ...s, items: s.items.map((it, k) => k === ii ? value : it) }) }))
  }
  function addExtraItem(si) {
    setData(d => ({ ...d, extraSections: d.extraSections.map((s, j) => j !== si ? s : { ...s, items: [...s.items, ''] }) }))
  }
  function removeExtraItem(si, ii) {
    setData(d => ({ ...d, extraSections: d.extraSections.map((s, j) => j !== si ? s : { ...s, items: s.items.filter((_, k) => k !== ii) }) }))
  }
  function addExtraSection() {
    setData(d => ({ ...d, extraSections: [...d.extraSections, { title: '', items: [''] }] }))
  }
  function removeExtraSection(i) {
    setData(d => ({ ...d, extraSections: d.extraSections.filter((_, j) => j !== i) }))
  }

  function handleSubmit() {
    if (!data.name.trim()) { alert('Please enter your name.'); return }
    const text = resumeDataToText(data)
    if (text.length < 50) { alert('Please fill in more details.'); return }
    onDone(text)
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-lg px-2.5 py-2 focus:outline-none transition-colors placeholder:text-slate-600'
  const labelCls = 'text-sm text-slate-500 mb-0.5 block'

  return (
    <div className="space-y-5">
      {/* Contact */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Contact Info</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Full Name *</label><input className={inputCls} value={data.name} onChange={e => set('name', e.target.value)} placeholder="Alex Chen" /></div>
          <div><label className={labelCls}>Email</label><input className={inputCls} value={data.email} onChange={e => set('email', e.target.value)} placeholder="alex@email.com" /></div>
          <div><label className={labelCls}>Phone</label><input className={inputCls} value={data.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" /></div>
          <div><label className={labelCls}>Location</label><input className={inputCls} value={data.location} onChange={e => set('location', e.target.value)} placeholder="San Francisco, CA" /></div>
        </div>
        <div><label className={labelCls}>LinkedIn URL</label><input className={inputCls} value={data.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/alexchen" /></div>
      </div>

      {/* Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Professional Summary</p>
          <MicButton apiKey={apiKey} label="Speak" onTranscript={t => set('summary', t)} />
        </div>
        <textarea className={`${inputCls} resize-none`} rows={3} value={data.summary} onChange={e => set('summary', e.target.value)} placeholder="Brief overview of your background, skills, and career goals..." />
      </div>

      {/* Experience */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Experience</p>
          <button onClick={addExp} className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors">+ Add Role</button>
        </div>
        <div className="space-y-4">
          {data.experience.map((exp, ei) => (
            <div key={ei} className="border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Role {ei + 1}</span>
                <div className="flex items-center gap-3">
                  <VoiceExpFill apiKey={apiKey} onFilled={result => {
                    if (result.title)   setExp(ei, 'title',   result.title)
                    if (result.company) setExp(ei, 'company', result.company)
                    if (result.dates)   setExp(ei, 'dates',   result.dates)
                    if (result.bullets?.length) setData(d => ({ ...d, experience: d.experience.map((e, j) => j !== ei ? e : { ...e, bullets: result.bullets }) }))
                  }} />
                  {data.experience.length > 1 && (
                    <button onClick={() => removeExp(ei)} className="text-sm text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Job Title</label><input className={inputCls} value={exp.title} onChange={e => setExp(ei, 'title', e.target.value)} placeholder="Software Engineer" /></div>
                <div><label className={labelCls}>Company</label><input className={inputCls} value={exp.company} onChange={e => setExp(ei, 'company', e.target.value)} placeholder="Acme Corp" /></div>
                <div className="col-span-2"><label className={labelCls}>Dates</label><input className={inputCls} value={exp.dates} onChange={e => setExp(ei, 'dates', e.target.value)} placeholder="Jan 2022 – Present" /></div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Key achievements (one per bullet)</label>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} className="flex gap-1.5 items-start">
                    <span className="text-slate-600 mt-2 text-sm shrink-0">•</span>
                    <textarea className={`${inputCls} flex-1 resize-none`} rows={2} value={b} onChange={e => setBullet(ei, bi, e.target.value)} placeholder="Describe an achievement or responsibility..." />
                    {exp.bullets.length > 1 && (
                      <button onClick={() => removeBullet(ei, bi)} className="text-slate-600 hover:text-red-400 text-sm mt-2 transition-colors shrink-0">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addBullet(ei)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1">+ Add bullet</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3">Skills</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.skills.map((s, i) => (
            <span key={i} className="flex items-center gap-1 text-sm px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-full">
              {s}
              <button onClick={() => set('skills', data.skills.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 transition-colors ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} placeholder="Type skill and press Enter..." className={`${inputCls} flex-1`} />
          <button onClick={addSkill} className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">Add</button>
        </div>
      </div>

      {/* Education */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3">Education</p>
        <div className="space-y-3">
          {data.education.map((edu, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Degree</label><input className={inputCls} value={edu.degree} onChange={e => setEdu(i, 'degree', e.target.value)} placeholder="B.S. Computer Science" /></div>
              <div><label className={labelCls}>School</label><input className={inputCls} value={edu.school} onChange={e => setEdu(i, 'school', e.target.value)} placeholder="Stanford University" /></div>
              <div className="col-span-2"><label className={labelCls}>Dates</label><input className={inputCls} value={edu.dates} onChange={e => setEdu(i, 'dates', e.target.value)} placeholder="2018 – 2022" /></div>
            </div>
          ))}
          <button onClick={() => setData(d => ({ ...d, education: [...d.education, { degree: '', school: '', dates: '' }] }))} className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors">+ Add Education</button>
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Certifications</p>
          <button onClick={addCert} className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors">+ Add</button>
        </div>
        {data.certifications.length === 0 ? (
          <p className="text-slate-600 text-sm">AWS, Google Cloud, PMP, etc. — click + Add to include any certifications.</p>
        ) : (
          <div className="space-y-2">
            {data.certifications.map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 relative">
                <div><label className={labelCls}>Certification name</label><input className={inputCls} value={c.name} onChange={e => setCert(i, 'name', e.target.value)} placeholder="AWS Solutions Architect" /></div>
                <div><label className={labelCls}>Issuer</label><input className={inputCls} value={c.issuer} onChange={e => setCert(i, 'issuer', e.target.value)} placeholder="Amazon Web Services" /></div>
                <div><label className={labelCls}>Date</label><input className={inputCls} value={c.date} onChange={e => setCert(i, 'date', e.target.value)} placeholder="Jan 2024" /></div>
                <div className="flex items-end pb-0.5">
                  <button onClick={() => removeCert(i)} className="text-sm text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Sections */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Additional Sections</p>
            <p className="text-slate-600 text-sm mt-0.5">Languages, Publications, Awards, Volunteer Work, etc.</p>
          </div>
          <button onClick={addExtraSection} className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors shrink-0">+ Add Section</button>
        </div>
        {data.extraSections.length === 0 ? (
          <p className="text-slate-600 text-sm">Click + Add Section for anything that doesn't fit above.</p>
        ) : (
          <div className="space-y-4">
            {data.extraSections.map((sec, si) => (
              <div key={si} className="border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={sec.title}
                    onChange={e => setExtraSection(si, 'title', e.target.value)}
                    placeholder="Section title (e.g. Languages, Awards)"
                  />
                  <button onClick={() => removeExtraSection(si)} className="text-sm text-red-400/60 hover:text-red-400 transition-colors shrink-0">Remove</button>
                </div>
                <div className="space-y-1.5">
                  {sec.items.map((item, ii) => (
                    <div key={ii} className="flex gap-1.5 items-center">
                      <span className="text-slate-600 text-sm shrink-0">•</span>
                      <input
                        className={`${inputCls} flex-1`}
                        value={item}
                        onChange={e => setExtraItem(si, ii, e.target.value)}
                        placeholder="e.g. Spanish (fluent), French (conversational)"
                      />
                      {sec.items.length > 1 && (
                        <button onClick={() => removeExtraItem(si, ii)} className="text-slate-600 hover:text-red-400 text-sm transition-colors shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addExtraItem(si)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1">+ Add item</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all hover:scale-[1.01]"
      >
        Use this resume →
      </button>
    </div>
  )
}

// ── PdfPreview ──────────────────────────────────────────────────────────────

function PdfPreview({ file }) {
  const canvasRef = useRef()
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const renderTaskRef = useRef(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    async function renderPage(pageNum) {
      const arrayBuffer = await readAsArrayBuffer(file)
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      if (cancelled) return
      setNumPages(pdf.numPages)
      const page = await pdf.getPage(pageNum)
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const dpr = window.devicePixelRatio || 1
      const containerWidth = canvas.parentElement?.clientWidth || 600
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
    }
    renderPage(currentPage)
    return () => { cancelled = true }
  }, [file, currentPage])

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-slate-400 text-sm font-medium">PDF Preview</span>
        {numPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-500 hover:text-white disabled:opacity-30 transition-colors text-sm px-2">←</button>
            <span className="text-slate-500 text-sm">{currentPage} / {numPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages} className="text-slate-500 hover:text-white disabled:opacity-30 transition-colors text-sm px-2">→</button>
          </div>
        )}
      </div>
      <div className="overflow-y-auto bg-white" style={{ maxHeight: '480px' }}>
        <canvas ref={canvasRef} className="w-full block" />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function StepUpload({ onNext, onBack, onTextExtracted, onOpenSettings, apiKey, onHealthScore, userMode, onUserModeChange }) {
  const [inputMode, setInputMode] = useState('upload') // 'upload' | 'scratch'
  const [status, setStatus]       = useState('idle')
  const [fileName, setFileName]   = useState('')
  const [error, setError]         = useState('')
  const [pdfFile, setPdfFile]     = useState(null)
  const [fileType, setFileType]   = useState(null) // 'pdf' | 'docx'
  const [resumeText, setResumeText] = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const [showSpark, setShowSpark] = useState(false)
  const [validation, setValidation] = useState(null) // null | { isResume, language }
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')
    if (!isPdf && !isDocx) {
      setError(`"${file.name}" is not a supported file. Please upload a PDF or Word (.docx) file.`)
      setStatus('error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Please upload a file under 10MB.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setError('')
    setFileName(file.name)
    try {
      let text
      if (isDocx) {
        text = await extractTextFromDocx(file)
        setFileType('docx')
      } else {
        const result = await extractTextFromPdf(file)
        text = result.text
        if (!text || text.length < 50) throw new Error('Could not extract text. Is the PDF scanned/image-based?')
        setPdfFile(file)
        setFileType('pdf')
      }
      setStatus('done')
      setResumeText(text)
      onTextExtracted(text)
      setShowSpark(true)
      setTimeout(() => setShowSpark(false), 700)
      // Async pre-flight validation — non-blocking
      if (apiKey) validateResume(apiKey, text).then(r => { if (r) setValidation(r) })
    } catch (e) {
      console.error('[file upload error]', e)
      setStatus('error')
      setError((e.message || 'Failed to read file.') + ' — ' + String(e))
    }
  }

  function handleScratchDone(text) {
    setResumeText(text)
    onTextExtracted(text)
    setStatus('done')
    setFileName('Built from scratch')
  }

  function reset() {
    setStatus('idle')
    setFileName('')
    setError('')
    setPdfFile(null)
    setFileType(null)
    setResumeText('')
    setValidation(null)
    onTextExtracted('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const isDone = status === 'done'

  return (
    <StepLayout
      step={1} totalSteps={3}
      title={inputMode === 'scratch' ? 'Build your resume' : 'Upload your resume'}
      subtitle={
        inputMode === 'scratch'
          ? 'Fill in your details — we\'ll tailor it for the job.'
          : 'Drop your PDF or Word resume — we\'ll parse and improve it.'
      }
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!isDone}
      onOpenSettings={onOpenSettings}
    >
      <style>{UPLOAD_STYLES}</style>
      <input ref={inputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => handleFile(e.target.files[0])} />

      {/* User mode selector */}
      <UserModeSelector value={userMode} onChange={onUserModeChange} />

      {/* Upload / Scratch toggle */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-5">
        {[
          { id: 'upload', label: '📎  Upload PDF / Word' },
          { id: 'scratch', label: '✏️  Build from scratch' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setInputMode(id); reset() }}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
              inputMode === id
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Upload mode ── */}
      {inputMode === 'upload' && (
        isDone ? (
          <div className="space-y-3">
            <div
              className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between"
              style={{ animation: 'slide-down-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <div className="flex items-center gap-3">
                {/* Animated checkmark + sparks */}
                <div className="relative shrink-0">
                  {showSpark && <SparkBurst />}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)" />
                    <path d="M6 10.5l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="12" strokeDashoffset="0" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{fileName}</p>
                  <p className="text-emerald-400 text-sm">Ready to tailor</p>
                </div>
              </div>
              <button onClick={reset} className="text-slate-500 hover:text-slate-300 text-sm underline transition-colors">Remove</button>
            </div>
            {/* Pre-flight validation warnings */}
            {validation && !validation.isResume && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-amber-400 text-sm font-medium">This may not be a resume</p>
                  <p className="text-amber-400/70 text-sm mt-0.5">The file doesn't look like a resume or CV. Check you uploaded the right file. You can still proceed.</p>
                </div>
              </div>
            )}
            {validation?.isResume && validation.language && validation.language?.toLowerCase() !== 'english' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
                <div>
                  <p className="text-blue-400 text-sm font-medium">{validation.language} resume detected</p>
                  <p className="text-blue-400/70 text-sm mt-0.5">Analysis and tailoring work best with English resumes. Results may vary.</p>
                </div>
              </div>
            )}
            {fileType === 'pdf' && <PdfPreview file={pdfFile} />}
            <ResumeHealthScore apiKey={apiKey} resumeText={resumeText} onScoreReady={onHealthScore} userMode={userMode} />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => status !== 'loading' && inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all group overflow-hidden ${
                dragOver
                  ? 'border-blue-400 bg-blue-600/10'
                  : 'border-slate-700 hover:border-blue-500/60 bg-slate-900/60 hover:bg-blue-600/5'
              }`}
              style={dragOver ? { animation: 'zone-pulse 0.9s ease-in-out infinite' } : { animation: 'zone-appear 1s ease-out both' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />

              {status === 'loading' ? (
                <ParseCinematic />
              ) : (
                <div className="py-4">
                  <div className="w-14 h-14 bg-slate-800 group-hover:bg-blue-600/20 border border-slate-700 group-hover:border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-all shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-1.5">Upload your resume</p>
                  <p className="text-slate-500 text-sm mb-4">Tap to browse, or drag and drop</p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF or Word (.docx) · max 10MB
                  </span>
                  {status === 'error' && (
                    <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: '🏥', label: 'ATS Health Score',  desc: 'Instant resume score' },
                { icon: '🔑', label: 'Keyword Analysis',  desc: "See what's missing" },
                { icon: '✍️', label: 'AI Tailoring',      desc: 'Rewritten for the role' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-lg mb-1">{icon}</div>
                  <p className="text-white text-sm font-medium leading-snug">{label}</p>
                  <p className="text-slate-500 text-sm mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Build from scratch mode ── */}
      {inputMode === 'scratch' && (
        isDone ? (
          <div className="space-y-3">
            <div
              className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between"
              style={{ animation: 'slide-down-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)" />
                  <path d="M6 10.5l3 3 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-white text-sm font-medium">Resume built from scratch</p>
                  <p className="text-emerald-400 text-sm">Ready to tailor</p>
                </div>
              </div>
              <button onClick={reset} className="text-slate-500 hover:text-slate-300 text-sm underline transition-colors">Edit</button>
            </div>
            <ResumeHealthScore apiKey={apiKey} resumeText={resumeText} onScoreReady={onHealthScore} userMode={userMode} />
          </div>
        ) : (
          <BuildFromScratch onDone={handleScratchDone} apiKey={apiKey} />
        )
      )}
    </StepLayout>
  )
}
