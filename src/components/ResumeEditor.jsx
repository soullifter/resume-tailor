import { useState, useRef } from 'react'
import { geminiText, checkInjection } from '../utils/groq'
import { bulletRewritePrompt } from '../utils/prompts'

async function rewriteBullet(apiKey, bullet, title, company, jobDescription) {
  const { prompt, temperature, maxOutputTokens } = bulletRewritePrompt(bullet, title, company, jobDescription)
  return geminiText(apiKey, prompt, { temperature, maxOutputTokens })
}

function hasPlaceholder(value) {
  return typeof value === 'string' && /\[X\]/i.test(value)
}

function parseBold(text) {
  const parts = []
  const regex = /\*\*(.*?)\*\*/g
  let lastIndex = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false })
  return parts.length ? parts : [{ text, bold: false }]
}

function Field({ label, value, onChange, multiline, rows = 2, placeholder = '' }) {
  const needsFill = hasPlaceholder(value)
  const cls = `w-full bg-slate-800 border ${needsFill ? 'border-amber-500 focus:border-amber-400' : 'border-slate-700 focus:border-blue-500'} text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors`
  return (
    <div>
      {label && (
        <label className="text-sm block mb-0.5">
          <span className="text-slate-500">{label}</span>
          {needsFill && <span className="text-amber-400 ml-1.5">← fill in [X]</span>}
        </label>
      )}
      {multiline
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={`${cls} resize-none`} />
        : <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  )
}

function BulletRow({ bullet, onEdit, onDelete, onRewrite, apiKey }) {
  const [loading, setLoading] = useState(false)
  const [rewriteError, setRewriteError] = useState('')
  const textareaRef = useRef(null)

  async function handleRewrite() {
    setLoading(true)
    setRewriteError('')
    try {
      if (apiKey && bullet.trim().length > 10) {
        const unsafe = await checkInjection(apiKey, bullet).catch(() => false)
        if (unsafe) {
          setRewriteError('Bullet contains disallowed content — cannot rewrite.')
          setLoading(false)
          return
        }
      }
      await onRewrite()
    } catch {}
    setLoading(false)
  }

  function handleBold() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) return
    const selected = bullet.slice(start, end)
    // Toggle: unwrap if already bold, wrap if not
    if (selected.startsWith('**') && selected.endsWith('**') && selected.length > 4) {
      onEdit(bullet.slice(0, start) + selected.slice(2, -2) + bullet.slice(end))
    } else {
      onEdit(bullet.slice(0, start) + '**' + selected + '**' + bullet.slice(end))
    }
  }

  const hasBold = bullet.includes('**')
  const preview = hasBold ? parseBold(bullet) : null

  return (
    <div className="flex gap-1.5 items-start">
      <span className="text-slate-600 mt-2 shrink-0 text-sm">•</span>
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={bullet}
          onChange={e => onEdit(e.target.value)}
          rows={2}
          className={`w-full bg-slate-800 border ${hasPlaceholder(bullet) ? 'border-amber-500 focus:border-amber-400' : 'border-slate-700 focus:border-blue-500'} text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none resize-none transition-colors`}
        />
        {preview && (
          <p className="text-sm px-1 mt-0.5 leading-relaxed text-slate-400">
            {preview.map((p, i) =>
              p.bold
                ? <strong key={i} className="text-white font-semibold">{p.text}</strong>
                : <span key={i}>{p.text}</span>
            )}
          </p>
        )}
        {rewriteError && <p className="text-red-400 text-xs px-1 mt-0.5">{rewriteError}</p>}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={handleBold} title="Select text in the bullet, then click B to bold it"
          className="text-sm bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 px-1.5 py-1 rounded transition-colors font-bold">
          B
        </button>
        <button onClick={handleRewrite} disabled={loading} title="AI Rewrite"
          className="text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 px-1.5 py-1 rounded transition-colors disabled:opacity-50">
          {loading ? '…' : '✨'}
        </button>
        <button onClick={onDelete} title="Delete"
          className="text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-1.5 py-1 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">{children}</p>
}

function AddBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition-colors">
      {children}
    </button>
  )
}

function RemoveBtn({ onClick, children = 'Remove' }) {
  return (
    <button onClick={onClick}
      className="text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-2 py-0.5 rounded transition-colors">
      {children}
    </button>
  )
}

export default function ResumeEditor({ data, onChange, apiKey, jobDescription }) {
  const [skillInput, setSkillInput] = useState('')

  function set(field, value) { onChange({ ...data, [field]: value }) }

  const DEFAULT_SECTION_ORDER = ['experience', 'skills', 'projects', 'certifications', 'education']
  const sectionOrder = data.sectionOrder ?? DEFAULT_SECTION_ORDER

  function moveSection(idx, dir) {
    const next = idx + dir
    if (next < 0 || next >= sectionOrder.length) return
    const order = [...sectionOrder]
    ;[order[idx], order[next]] = [order[next], order[idx]]
    set('sectionOrder', order)
  }

  // ── Experience helpers ───────────────────────────────────────────────────────
  function setExp(ei, field, value) {
    set('experience', data.experience.map((e, i) => i === ei ? { ...e, [field]: value } : e))
  }
  function setBullet(ei, bi, value) {
    set('experience', data.experience.map((e, i) =>
      i !== ei ? e : { ...e, bullets: e.bullets.map((b, j) => j === bi ? value : b) }
    ))
  }
  function addBullet(ei) {
    set('experience', data.experience.map((e, i) =>
      i !== ei ? e : { ...e, bullets: [...(e.bullets || []), ''] }
    ))
  }
  function removeBullet(ei, bi) {
    set('experience', data.experience.map((e, i) =>
      i !== ei ? e : { ...e, bullets: e.bullets.filter((_, j) => j !== bi) }
    ))
  }

  // ── Education helpers ────────────────────────────────────────────────────────
  function setEdu(ei, field, value) {
    set('education', (data.education || []).map((e, i) => i === ei ? { ...e, [field]: value } : e))
  }
  function removeEdu(ei) {
    set('education', (data.education || []).filter((_, i) => i !== ei))
  }

  // ── Skills helpers ───────────────────────────────────────────────────────────
  function addSkill() {
    const s = skillInput.trim()
    if (s && !data.skills?.includes(s)) set('skills', [...(data.skills || []), s])
    setSkillInput('')
  }

  // ── Project helpers ──────────────────────────────────────────────────────────
  function setProj(pi, field, value) {
    set('projects', (data.projects || []).map((p, i) => i === pi ? { ...p, [field]: value } : p))
  }
  function setProjBullet(pi, bi, value) {
    set('projects', (data.projects || []).map((p, i) =>
      i !== pi ? p : { ...p, bullets: (p.bullets || []).map((b, j) => j === bi ? value : b) }
    ))
  }
  function addProjBullet(pi) {
    set('projects', (data.projects || []).map((p, i) =>
      i !== pi ? p : { ...p, bullets: [...(p.bullets || []), ''] }
    ))
  }
  function removeProjBullet(pi, bi) {
    set('projects', (data.projects || []).map((p, i) =>
      i !== pi ? p : { ...p, bullets: (p.bullets || []).filter((_, j) => j !== bi) }
    ))
  }

  // ── Certification helpers ────────────────────────────────────────────────────
  function setCert(ci, field, value) {
    set('certifications', (data.certifications || []).map((c, i) => i === ci ? { ...c, [field]: value } : c))
  }

  // ── Extra section helpers ────────────────────────────────────────────────────
  function setExtraTitle(si, value) {
    set('extraSections', (data.extraSections || []).map((s, i) => i === si ? { ...s, title: value } : s))
  }
  function setExtraItem(si, ii, value) {
    set('extraSections', (data.extraSections || []).map((s, i) =>
      i !== si ? s : { ...s, items: s.items.map((item, j) => j === ii ? value : item) }
    ))
  }
  function addExtraItem(si) {
    set('extraSections', (data.extraSections || []).map((s, i) =>
      i !== si ? s : { ...s, items: [...(s.items || []), ''] }
    ))
  }
  function removeExtraItem(si, ii) {
    set('extraSections', (data.extraSections || []).map((s, i) =>
      i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) }
    ))
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-white text-sm font-semibold">Edit Resume</span>
        <span className="text-sm text-slate-500">Changes reflect in your PDF · ✨ = AI rewrite · <span className="font-bold text-slate-400">B</span> = select text then bold</span>
      </div>

      <div className="p-4 space-y-5">

        {/* ── Contact ── */}
        <div>
          <SectionLabel>Contact Info</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Full Name"  value={data.name}     onChange={v => set('name', v)} />
            <Field label="Email"      value={data.email}    onChange={v => set('email', v)} />
            <Field label="Phone"      value={data.phone}    onChange={v => set('phone', v)} />
            <Field label="Location"   value={data.location} onChange={v => set('location', v)} />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Field label="LinkedIn URL"  value={data.linkedin}  onChange={v => set('linkedin', v)} />
            {(data.github    !== undefined || data.github    !== '') &&
              <Field label="GitHub URL"    value={data.github}    onChange={v => set('github', v)} placeholder="https://github.com/username" />}
            {(data.portfolio !== undefined || data.portfolio !== '') &&
              <Field label="Portfolio URL" value={data.portfolio} onChange={v => set('portfolio', v)} placeholder="https://yoursite.com" />}
          </div>
        </div>

        {/* ── Summary ── */}
        <div id="editor-summary">
          <SectionLabel>Summary</SectionLabel>
          <Field value={data.summary} onChange={v => set('summary', v)} multiline rows={3} placeholder="Professional summary..." />
        </div>

        {/* ── Reorderable sections ── */}
        {sectionOrder.map((key, idx) => {
          const isFirst = idx === 0
          const isLast  = idx === sectionOrder.length - 1
          const movebtns = (
            <div className="flex flex-col gap-0.5 mr-2 shrink-0">
              <button onClick={() => moveSection(idx, -1)} disabled={isFirst}
                title="Move section up"
                className="text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-default transition-colors text-xs leading-none text-center">▲</button>
              <button onClick={() => moveSection(idx, 1)} disabled={isLast}
                title="Move section down"
                className="text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-default transition-colors text-xs leading-none text-center">▼</button>
            </div>
          )

          if (key === 'experience') return (
            <div key="experience">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {movebtns}
                  <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Experience</p>
                </div>
                <AddBtn onClick={() => set('experience', [...(data.experience || []), { title: '', company: '', dates: '', bullets: [''] }])}>+ Add Role</AddBtn>
              </div>
              <div className="space-y-4">
                {data.experience?.map((exp, ei) => (
                  <div key={ei} id={`editor-experience-${ei}`} className="border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex justify-end">
                      <RemoveBtn onClick={() => set('experience', data.experience.filter((_, i) => i !== ei))}>Remove role</RemoveBtn>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Job Title" value={exp.title}   onChange={v => setExp(ei, 'title', v)} />
                      <Field label="Company"   value={exp.company} onChange={v => setExp(ei, 'company', v)} />
                      <div className="col-span-2">
                        <Field label="Dates" value={exp.dates} onChange={v => setExp(ei, 'dates', v)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {exp.bullets?.map((bullet, bi) => (
                        <div key={bi} id={`editor-experience-${ei}-bullet-${bi}`}>
                          <BulletRow bullet={bullet} apiKey={apiKey}
                            onEdit={v => setBullet(ei, bi, v)}
                            onDelete={() => removeBullet(ei, bi)}
                            onRewrite={async () => {
                              const rewritten = await rewriteBullet(apiKey, bullet, exp.title, exp.company, jobDescription)
                              setBullet(ei, bi, rewritten)
                            }}
                          />
                        </div>
                      ))}
                      <button onClick={() => addBullet(ei)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1">+ Add bullet</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )

          if (key === 'skills') return (
            <div key="skills" id="editor-skills">
              <div className="flex items-center mb-2">
                {movebtns}
                <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Skills</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.skills?.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-sm px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-full">
                    {s}
                    <button onClick={() => set('skills', data.skills.filter((_, j) => j !== i))}
                      className="text-slate-500 hover:text-red-400 transition-colors ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                  placeholder="Type skill and press Enter..."
                  className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors" />
                <button onClick={addSkill} className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">Add</button>
              </div>
            </div>
          )

          if (key === 'projects') return (
            <div key="projects">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {movebtns}
                  <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Projects</p>
                </div>
                <AddBtn onClick={() => set('projects', [...(data.projects || []), { name: '', description: '', technologies: [], bullets: [''], url: '' }])}>+ Add Project</AddBtn>
              </div>
              <div className="space-y-4">
                {(data.projects || []).map((proj, pi) => (
                  <div key={pi} id={`editor-projects-${pi}`} className="border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex justify-end">
                      <RemoveBtn onClick={() => set('projects', data.projects.filter((_, i) => i !== pi))}>Remove project</RemoveBtn>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Project Name"   value={proj.name}        onChange={v => setProj(pi, 'name', v)} />
                      <Field label="URL (optional)" value={proj.url}         onChange={v => setProj(pi, 'url', v)} placeholder="https://..." />
                      <div className="col-span-2">
                        <Field label="Description" value={proj.description} onChange={v => setProj(pi, 'description', v)} placeholder="One-line description" />
                      </div>
                      <div className="col-span-2">
                        <Field label="Technologies (comma-separated)"
                          value={Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies || ''}
                          onChange={v => setProj(pi, 'technologies', v.split(',').map(t => t.trim()).filter(Boolean))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {(proj.bullets || []).map((bullet, bi) => (
                        <div key={bi} id={`editor-projects-${pi}-bullet-${bi}`}>
                          <BulletRow bullet={bullet} apiKey={apiKey}
                            onEdit={v => setProjBullet(pi, bi, v)}
                            onDelete={() => removeProjBullet(pi, bi)}
                            onRewrite={async () => {
                              const rewritten = await rewriteBullet(apiKey, bullet, proj.name, 'Project', jobDescription)
                              setProjBullet(pi, bi, rewritten)
                            }}
                          />
                        </div>
                      ))}
                      <button onClick={() => addProjBullet(pi)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1">+ Add bullet</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )

          if (key === 'certifications') return (
            <div key="certifications">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {movebtns}
                  <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Certifications</p>
                </div>
                <AddBtn onClick={() => set('certifications', [...(data.certifications || []), { name: '', issuer: '', date: '' }])}>+ Add Cert</AddBtn>
              </div>
              <div className="space-y-2">
                {(data.certifications || []).map((cert, ci) => (
                  <div key={ci} id={`editor-certifications-${ci}`} className="border border-slate-800 rounded-xl p-3">
                    <div className="flex justify-end mb-2">
                      <RemoveBtn onClick={() => set('certifications', data.certifications.filter((_, i) => i !== ci))}>Remove</RemoveBtn>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Field label="Certification Name" value={cert.name}   onChange={v => setCert(ci, 'name', v)} />
                      </div>
                      <Field label="Issuing Body" value={cert.issuer} onChange={v => setCert(ci, 'issuer', v)} />
                      <Field label="Date"         value={cert.date}   onChange={v => setCert(ci, 'date', v)} placeholder="Jan 2024" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )

          if (key === 'education') return (
            <div key="education">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {movebtns}
                  <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Education</p>
                </div>
                <AddBtn onClick={() => set('education', [...(data.education || []), { degree: '', school: '', dates: '' }])}>+ Add Education</AddBtn>
              </div>
              <div className="space-y-2">
                {(data.education || []).map((edu, i) => (
                  <div key={i} id={`editor-education-${i}`} className="border border-slate-800 rounded-xl p-3">
                    <div className="flex justify-end mb-2">
                      <RemoveBtn onClick={() => removeEdu(i)}>Remove</RemoveBtn>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Degree" value={edu.degree} onChange={v => setEdu(i, 'degree', v)} />
                      <Field label="School" value={edu.school} onChange={v => setEdu(i, 'school', v)} />
                      <div className="col-span-2">
                        <Field label="Dates" value={edu.dates} onChange={v => setEdu(i, 'dates', v)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )

          return null
        })}

        {/* ── Extra Sections (Awards, Publications, Languages, etc.) ── */}
        {(data.extraSections || []).map((section, si) => (
          <div key={si} id={`editor-extra-${si}`}>
            <div className="flex items-center justify-between mb-2">
              <input
                value={section.title}
                onChange={e => setExtraTitle(si, e.target.value)}
                placeholder="Section title (e.g. Awards)"
                className="text-sm font-bold text-blue-400 uppercase tracking-widest bg-transparent border-none focus:outline-none focus:border-b focus:border-blue-500 w-40"
              />
              <div className="flex gap-2">
                <AddBtn onClick={() => addExtraItem(si)}>+ Add item</AddBtn>
                <RemoveBtn onClick={() => set('extraSections', data.extraSections.filter((_, i) => i !== si))}>Remove section</RemoveBtn>
              </div>
            </div>
            <div className="space-y-1.5">
              {(section.items || []).map((item, ii) => (
                <BulletRow key={ii} bullet={item} apiKey={apiKey}
                  onEdit={v => setExtraItem(si, ii, v)}
                  onDelete={() => removeExtraItem(si, ii)}
                  onRewrite={async () => {
                    const rewritten = await rewriteBullet(apiKey, item, section.title, '', jobDescription)
                    setExtraItem(si, ii, rewritten)
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* ── Add new custom section ── */}
        <button
          onClick={() => set('extraSections', [...(data.extraSections || []), { title: 'New Section', items: [''] }])}
          className="w-full text-sm border border-dashed border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 py-2 rounded-xl transition-colors"
        >
          + Add Custom Section
        </button>

      </div>
    </div>
  )
}
