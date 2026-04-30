import { PDFDownloadLink } from '@react-pdf/renderer'
import ResumeDocument from './ResumeDocument'

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

function BoldText({ text, className = '' }) {
  const parts = parseBold(text)
  return (
    <span className={className}>
      {parts.map((p, i) => p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>)}
    </span>
  )
}

const TEMPLATE_COLORS = {
  classic: { primary: '#1e3a5f', accent: '#2563eb' },
  modern:  { primary: '#0f766e', accent: '#0d9488' },
  minimal: { primary: '#111827', accent: '#374151' },
}

export default function ResumePreview({ data, hideDownload = false, template = 'classic', onFieldClick = null }) {
  const fileName = `${data.name?.replace(/\s+/g, '_') || 'resume'}_tailored.pdf`
  const colors = TEMPLATE_COLORS[template] || TEMPLATE_COLORS.classic

  function handleClick(e) {
    if (!onFieldClick) return
    const field = e.target.closest('[data-field]')?.dataset.field
    if (field) onFieldClick(field)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Resume Preview */}
      <div
        className={`border border-gray-200 rounded-xl p-6 bg-gray-50 mb-6 space-y-5${onFieldClick ? ' resume-preview-interactive' : ''}`}
        onClick={onFieldClick ? handleClick : undefined}
      >

        {/* Header */}
        <div className="border-b-2 pb-4" style={{ borderColor: colors.primary }}>
          <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>{data.name}</h1>
          <div className="flex flex-wrap gap-3 mt-1">
            {data.email     && <span className="text-sm text-gray-500">{data.email}</span>}
            {data.phone     && <span className="text-sm text-gray-500">{data.phone}</span>}
            {data.location  && <span className="text-sm text-gray-500">{data.location}</span>}
            {data.linkedin  && <span className="text-sm text-blue-500">{data.linkedin}</span>}
            {data.github    && <span className="text-sm text-blue-500">{data.github}</span>}
            {data.portfolio && <span className="text-sm text-blue-500">{data.portfolio}</span>}
          </div>
        </div>

        {/* Summary */}
        {data.summary && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-2" style={{ color: colors.primary }}>Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed" data-field="summary">{data.summary}</p>
          </div>
        )}

        {/* Reorderable sections */}
        {(data.sectionOrder ?? ['experience', 'skills', 'projects', 'certifications', 'education']).map(key => {
          if (key === 'experience' && data.experience?.length > 0) return (
            <div key="experience">
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">Experience</h3>
              <div className="space-y-4">
                {data.experience.map((exp, i) => (
                  <div key={i} data-field={`experience.${i}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-gray-800">{exp.title}</span>
                      <span className="text-sm text-gray-400">{exp.dates}</span>
                    </div>
                    <p className="text-sm mb-1" style={{ color: colors.accent }}>{exp.company}</p>
                    <ul className="space-y-1">
                      {exp.bullets?.map((b, j) => (
                        <li key={j} className="text-sm text-gray-700 flex gap-2" data-field={`experience.${i}.bullets.${j}`}>
                          <span className="text-gray-400 shrink-0">•</span><BoldText text={b} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )
          if (key === 'skills' && data.skills?.length > 0) return (
            <div key="skills">
              <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-2" style={{ color: colors.primary }}>Skills</h3>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill, i) => (
                  <span key={i} className="text-sm px-2 py-1 bg-white border border-gray-200 rounded text-blue-900" data-field="skills">{skill}</span>
                ))}
              </div>
            </div>
          )
          if (key === 'projects' && data.projects?.length > 0) return (
            <div key="projects">
              <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-3" style={{ color: colors.primary }}>Projects</h3>
              <div className="space-y-3">
                {data.projects.map((proj, i) => (
                  <div key={i} data-field={`projects.${i}`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-gray-800 shrink-0">{proj.name}</span>
                        {proj.url && <span className="text-sm text-blue-500 break-all text-right min-w-0">{proj.url}</span>}
                      </div>
                    </div>
                    {proj.description && <p className="text-sm text-gray-500 mb-1">{proj.description}</p>}
                    {proj.technologies?.length > 0 && (
                      <p className="text-sm text-gray-400 mb-1">{proj.technologies.join(' · ')}</p>
                    )}
                    <ul className="space-y-0.5">
                      {proj.bullets?.map((b, j) => (
                        <li key={j} className="text-sm text-gray-700 flex gap-2" data-field={`projects.${i}.bullets.${j}`}>
                          <span className="text-gray-400 shrink-0">•</span><BoldText text={b} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )
          if (key === 'certifications' && data.certifications?.length > 0) return (
            <div key="certifications">
              <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-2" style={{ color: colors.primary }}>Certifications</h3>
              {data.certifications.map((cert, i) => (
                <div key={i} className="flex justify-between mb-1" data-field={`certifications.${i}`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{cert.name}</p>
                    {cert.issuer && <p className="text-sm text-gray-500">{cert.issuer}</p>}
                  </div>
                  {cert.date && <span className="text-sm text-gray-400">{cert.date}</span>}
                </div>
              ))}
            </div>
          )
          if (key === 'education' && data.education?.length > 0) return (
            <div key="education">
              <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-2" style={{ color: colors.primary }}>Education</h3>
              {data.education.map((edu, i) => (
                <div key={i} className="flex justify-between mb-1" data-field={`education.${i}`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{edu.degree}</p>
                    <p className="text-sm text-gray-500">{edu.school}</p>
                  </div>
                  <span className="text-sm text-gray-400">{edu.dates}</span>
                </div>
              ))}
            </div>
          )
          return null
        })}

        {/* Extra Sections */}
        {data.extraSections?.map((section, i) => section.items?.length > 0 && (
          <div key={i} data-field={`extra.${i}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-2" style={{ color: colors.primary }}>{section.title}</h3>
            <ul className="space-y-0.5">
              {section.items.map((item, j) => (
                <li key={j} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Download Button */}
      {!hideDownload && <PDFDownloadLink
        document={<ResumeDocument data={data} />}
        fileName={fileName}
        className="block"
      >
        {({ loading }) => (
          <button
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Preparing PDF...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        )}
      </PDFDownloadLink>}
    </div>
  )
}
