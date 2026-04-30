import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSavedResumes, deleteResume, renameResume, timeAgo } from '../utils/storage'
import ModelWidget from './ModelWidget'

function ScoreRing({ score, size = 44 }) {
  if (score == null) return <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><span className="text-slate-600 text-sm">—</span></div>
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const r = (size / 2) - 4
  const circ = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{score}%</span>
      </div>
    </div>
  )
}

function RenameModal({ version, onSave, onClose }) {
  const [company, setCompany] = useState(version.company)
  const [role, setRole]       = useState(version.role)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Rename version</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm text-slate-500 block mb-1">Company</label>
            <input autoFocus value={company} onChange={e => setCompany(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="text-sm text-slate-500 block mb-1">Role</label>
            <input value={role} onChange={e => setRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSave(company.trim(), role.trim())}
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={() => onSave(company.trim(), role.trim())} disabled={!company.trim() || !role.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">Save</button>
        </div>
      </div>
    </div>
  )
}

function CompareView({ a, b, onClose }) {
  const aExp = a.resumeData?.experience || []
  const bExp = b.resumeData?.experience || []

  // Build union of all roles, matched by title+company
  const roleKeys = []
  const seen = new Set()
  for (const exp of [...aExp, ...bExp]) {
    const key = `${exp.title}|${exp.company}`
    if (!seen.has(key)) { seen.add(key); roleKeys.push(key) }
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-bold text-lg">Version Comparison</h2>
            <p className="text-slate-500 text-sm mt-0.5">Role-by-role diff of two saved versions</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm transition-colors border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg">
            ✕ Close
          </button>
        </div>

        {/* Version headers */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[a, b].map((v, i) => (
            <div key={i} className={`rounded-xl p-3 border ${i === 0 ? 'bg-blue-600/10 border-blue-500/30' : 'bg-emerald-600/10 border-emerald-500/30'}`}>
              <p className={`font-semibold text-sm ${i === 0 ? 'text-blue-300' : 'text-emerald-300'}`}>{v.company} — {v.role}</p>
              <p className="text-slate-500 text-sm mt-0.5">{timeAgo(v.createdAt)} · Score: {v.tailoredScore ?? '—'}%</p>
            </div>
          ))}
        </div>

        {/* Summary diff */}
        {(a.resumeData?.summary || b.resumeData?.summary) && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Summary</p>
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((v, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 leading-relaxed">
                  {v.resumeData?.summary || <span className="text-slate-600 italic">None</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience diff — per role */}
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Experience</p>
        <div className="space-y-4">
          {roleKeys.map(key => {
            const [title, company] = key.split('|')
            const aRole = aExp.find(e => e.title === title && e.company === company)
            const bRole = bExp.find(e => e.title === title && e.company === company)
            const maxBullets = Math.max(aRole?.bullets?.length || 0, bRole?.bullets?.length || 0)
            return (
              <div key={key}>
                <p className="text-sm font-semibold text-slate-300 mb-2">
                  {title} <span className="text-slate-500 font-normal">@ {company}</span>
                </p>
                <div className="space-y-1.5">
                  {Array.from({ length: maxBullets }).map((_, bi) => {
                    const aBullet = aRole?.bullets?.[bi]
                    const bBullet = bRole?.bullets?.[bi]
                    const same = aBullet === bBullet
                    return (
                      <div key={bi} className="grid grid-cols-2 gap-3">
                        <div className={`rounded-lg p-2.5 text-sm leading-relaxed ${same ? 'bg-slate-900 border border-slate-800 text-slate-500' : 'bg-red-500/5 border border-red-500/20 text-slate-300'}`}>
                          {aBullet || <span className="italic text-slate-600">—</span>}
                        </div>
                        <div className={`rounded-lg p-2.5 text-sm leading-relaxed ${same ? 'bg-slate-900 border border-slate-800 text-slate-500' : 'bg-emerald-500/5 border border-emerald-500/20 text-slate-300'}`}>
                          {bBullet || <span className="italic text-slate-600">—</span>}
                        </div>
                      </div>
                    )
                  })}
                  {maxBullets === 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {[aRole, bRole].map((r, i) => (
                        <div key={i} className="rounded-lg p-2.5 text-sm text-slate-600 italic bg-slate-900 border border-slate-800">
                          {r ? 'No bullets' : 'Role not in this version'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Skills diff */}
        {(a.resumeData?.skills?.length || b.resumeData?.skills?.length) && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Skills</p>
            <div className="grid grid-cols-2 gap-4">
              {[a, b].map((v, i) => (
                <div key={i} className="flex flex-wrap gap-1.5">
                  {(v.resumeData?.skills || []).map((s, j) => (
                    <span key={j} className="text-sm px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-full">{s}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VersionManager({ onBack, onLoadVersion, onRetailor }) {
  const navigate = useNavigate()
  const [versions, setVersions]       = useState(() => getSavedResumes())
  const [renaming, setRenaming]       = useState(null)
  const [selected, setSelected]       = useState([])   // ids for comparison
  const [comparing, setComparing]     = useState(null) // { a, b }
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  function refresh() { setVersions(getSavedResumes()) }

  function handleDelete(id) {
    deleteResume(id)
    setSelected(s => s.filter(x => x !== id))
    refresh()
    setDeleteConfirm(null)
  }

  function handleRename(id, company, role) {
    renameResume(id, company, role)
    refresh()
    setRenaming(null)
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id])
  }

  function handleCompare() {
    const [aId, bId] = selected
    const a = versions.find(v => v.id === aId)
    const b = versions.find(v => v.id === bId)
    if (a && b) setComparing({ a, b })
  }

  if (comparing) {
    return <CompareView a={comparing.a} b={comparing.b} onClose={() => setComparing(null)} />
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="Go to home">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">R</span>
              </div>
              <span className="text-white font-bold text-sm">ResumeTailor</span>
            </button>
            <div className="w-px h-4 bg-slate-700" />
            <button onClick={onBack} className="text-slate-400 hover:text-white text-sm transition-colors">← Back</button>
            <div className="w-px h-4 bg-slate-700" />
            <div>
              <h1 className="text-white font-bold text-base">My Resumes</h1>
              <p className="text-slate-500 text-sm">{versions.length} saved version{versions.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <ModelWidget />
          {selected.length === 2 && (
            <button
              onClick={handleCompare}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Compare selected →
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {versions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📄</p>
            <p className="text-white font-semibold mb-2">No saved resumes yet</p>
            <p className="text-slate-500 text-sm">After tailoring a resume, click "Save this resume" to store it here.</p>
            <button onClick={onBack} className="mt-6 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
              Tailor my first resume →
            </button>
          </div>
        ) : (
          <>
            {selected.length > 0 && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
                <p className="text-violet-300 text-sm">{selected.length === 1 ? 'Select one more to compare' : '2 versions selected — ready to compare'}</p>
                <button onClick={() => setSelected([])} className="text-slate-500 hover:text-white text-sm underline transition-colors">Clear</button>
              </div>
            )}

            <div className="space-y-3">
              {versions.map(v => {
                const isSelected = selected.includes(v.id)
                return (
                  <div
                    key={v.id}
                    className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                      isSelected ? 'border-violet-500/50 bg-violet-500/5' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Score ring */}
                      <ScoreRing score={v.tailoredScore ?? v.matchScore} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{v.role}</p>
                            <p className="text-slate-400 text-sm">{v.company}</p>
                          </div>
                          <p className="text-slate-600 text-sm shrink-0">{timeAgo(v.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {v.tailoredScore != null && (
                            <span className="text-sm px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                              {v.tailoredScore}% tailored score
                            </span>
                          )}
                          {v.userMode && v.userMode !== 'standard' && (
                            <span className="text-sm px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-full capitalize">
                              {v.userMode.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => onLoadVersion(v)}
                        className="flex-1 text-sm py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-medium transition-colors"
                      >
                        Load &amp; Edit
                      </button>
                      <button
                        onClick={() => onRetailor(v)}
                        className="flex-1 text-sm py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-medium transition-colors"
                      >
                        Re-tailor
                      </button>
                      <button
                        onClick={() => toggleSelect(v.id)}
                        className={`text-sm py-2 px-3 rounded-lg border font-medium transition-colors ${
                          isSelected
                            ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓' : 'Compare'}
                      </button>
                      <button
                        onClick={() => setRenaming(v)}
                        className="text-sm py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(v.id)}
                        className="text-sm py-2 px-3 rounded-lg bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Rename modal */}
      {renaming && (
        <RenameModal
          version={renaming}
          onSave={(company, role) => handleRename(renaming.id, company, role)}
          onClose={() => setRenaming(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center">
            <p className="text-white font-semibold mb-2">Delete this version?</p>
            <p className="text-slate-400 text-sm mb-5">This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
