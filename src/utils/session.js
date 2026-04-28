const SESSION_KEY = 'rt_active_session'

const DEFAULTS = {
  sessionId:       null,
  resumeText:      '',
  jobDescription:  '',
  generatedResume: null,
  healthScore:     null,
  matchScore:      null,
  tailoredScore:   null,
  userMode:        'standard',
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSession(partial) {
  try {
    const current = readSession()
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {}
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}
