const RESUMES_KEY = 'rt_saved_resumes'
const APPS_KEY    = 'rt_applications'

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function write(key, val) { localStorage.setItem(key, JSON.stringify(val)) }
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

// ── Saved resume versions ────────────────────────────────────────────────
export function getSavedResumes()          { return read(RESUMES_KEY) }
export function hasSavedResumes()          { return read(RESUMES_KEY).length > 0 }

export function saveResume({ sessionId, company, role, resumeData, resumeText, jobDescription, userMode, matchScore, tailoredScore }) {
  const versions = read(RESUMES_KEY)
  const existingIdx = sessionId ? versions.findIndex(v => v.sessionId === sessionId) : -1
  if (existingIdx >= 0) {
    const updated = { ...versions[existingIdx], company, role, resumeData, resumeText, jobDescription, userMode: userMode || 'standard', matchScore: matchScore ?? null, tailoredScore: tailoredScore ?? null, updatedAt: new Date().toISOString() }
    versions[existingIdx] = updated
    write(RESUMES_KEY, versions)
    return updated
  }
  const entry = {
    id: uid(),
    sessionId: sessionId || uid(),
    company, role,
    createdAt: new Date().toISOString(),
    resumeData, resumeText, jobDescription,
    userMode: userMode || 'standard',
    matchScore: matchScore ?? null,
    tailoredScore: tailoredScore ?? null,
  }
  write(RESUMES_KEY, [entry, ...versions])
  return entry
}

export function deleteResume(id) {
  write(RESUMES_KEY, read(RESUMES_KEY).filter(v => v.id !== id))
}

export function renameResume(id, company, role) {
  write(RESUMES_KEY, read(RESUMES_KEY).map(v => v.id === id ? { ...v, company, role } : v))
}

// ── Applications ─────────────────────────────────────────────────────────
export function getApplications()   { return read(APPS_KEY) }
export function hasApplications()   { return read(APPS_KEY).length > 0 }

export function addApplication({ sessionId, company, role, versionId, matchScore }) {
  const apps = read(APPS_KEY)
  const existingIdx = sessionId ? apps.findIndex(a => a.sessionId === sessionId) : -1
  if (existingIdx >= 0) {
    const updated = { ...apps[existingIdx], company, role, versionId: versionId || apps[existingIdx].versionId, matchScore: matchScore ?? apps[existingIdx].matchScore, lastUpdated: new Date().toISOString() }
    apps[existingIdx] = updated
    write(APPS_KEY, apps)
    return updated
  }
  const entry = {
    id: uid(),
    sessionId: sessionId || uid(),
    company, role,
    versionId: versionId || null,
    matchScore: matchScore ?? null,
    status: 'applied',
    dateApplied: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    notes: '',
  }
  write(APPS_KEY, [entry, ...apps])
  return entry
}

export function updateApplication(id, updates) {
  write(APPS_KEY, read(APPS_KEY).map(a =>
    a.id === id ? { ...a, ...updates, lastUpdated: new Date().toISOString() } : a
  ))
}

export function deleteApplication(id) {
  write(APPS_KEY, read(APPS_KEY).filter(a => a.id !== id))
}

// ── Export / Import ───────────────────────────────────────────────────────

const TOKEN_USAGE_KEY  = 'resume_tailor_token_usage'
const EXHAUSTED_KEY    = 'resume_tailor_exhausted'

export function exportAllData() {
  const today = new Date().toISOString().slice(0, 10)
  let tokenUsage = {}
  let exhaustedModels = {}
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_USAGE_KEY) || '{}')
    for (const [id, data] of Object.entries(all)) {
      if (data.date === today) tokenUsage[id] = data
    }
  } catch {}
  try {
    const all = JSON.parse(localStorage.getItem(EXHAUSTED_KEY) || '{}')
    for (const [id, date] of Object.entries(all)) {
      if (date === today) exhaustedModels[id] = date
    }
  } catch {}
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    savedResumes: getSavedResumes(),
    applications: getApplications(),
    tokenUsage,
    exhaustedModels,
  }
}

export function importAllData(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid backup file')
  const today = new Date().toISOString().slice(0, 10)
  const result = { resumesAdded: 0, resumesSkipped: 0, appsAdded: 0, appsSkipped: 0 }

  // Saved resumes — merge by id
  if (Array.isArray(raw.savedResumes)) {
    const existing = getSavedResumes()
    const existingIds = new Set(existing.map(r => r.id))
    const newOnes = raw.savedResumes.filter(r => !existingIds.has(r.id))
    result.resumesAdded   = newOnes.length
    result.resumesSkipped = raw.savedResumes.length - newOnes.length
    write(RESUMES_KEY, [...newOnes, ...existing])
  }

  // Applications — merge by id
  if (Array.isArray(raw.applications)) {
    const existing = getApplications()
    const existingIds = new Set(existing.map(a => a.id))
    const newOnes = raw.applications.filter(a => !existingIds.has(a.id))
    result.appsAdded   = newOnes.length
    result.appsSkipped = raw.applications.length - newOnes.length
    write(APPS_KEY, [...newOnes, ...existing])
  }

  // Token usage — date-aware merge (take max for same day)
  if (raw.tokenUsage && typeof raw.tokenUsage === 'object') {
    try {
      const existing = JSON.parse(localStorage.getItem(TOKEN_USAGE_KEY) || '{}')
      for (const [id, usage] of Object.entries(raw.tokenUsage)) {
        if (usage.date === today) {
          existing[id] = { date: today, used: Math.max(existing[id]?.date === today ? existing[id].used : 0, usage.used) }
        }
      }
      localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(existing))
    } catch {}
  }

  // Exhausted models — only restore if date is today
  if (raw.exhaustedModels && typeof raw.exhaustedModels === 'object') {
    try {
      const existing = JSON.parse(localStorage.getItem(EXHAUSTED_KEY) || '{}')
      for (const [id, date] of Object.entries(raw.exhaustedModels)) {
        if (date === today) existing[id] = date
      }
      localStorage.setItem(EXHAUSTED_KEY, JSON.stringify(existing))
    } catch {}
  }

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────
export function daysSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

export function timeAgo(isoString) {
  const d = daysSince(isoString)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}
