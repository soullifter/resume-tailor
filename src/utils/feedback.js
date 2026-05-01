// ── App version (injected by Vite from package.json) ─────────────────────
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v1.0.0'

// ── Global error capture ──────────────────────────────────────────────────
let _lastError = null

export function initErrorCapture() {
  window.onerror = (msg, src, line, col, err) => {
    _lastError = err ? `${err.name}: ${err.message}\n  at ${src}:${line}:${col}` : String(msg)
  }
  window.onunhandledrejection = (e) => {
    const err = e.reason
    _lastError = err instanceof Error
      ? `${err.name}: ${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(1, 3).join('\n') : ''}`
      : String(err)
  }
}

export function getLastError() { return _lastError || '' }
export function clearLastError() { _lastError = null }

// ── Device / browser context ──────────────────────────────────────────────
export function getDeviceInfo() {
  const ua = navigator.userAgent
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const device = mobile ? 'Mobile' : 'Desktop'

  let browser = 'Unknown'
  if (/CriOS|Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua))  browser = 'Safari'
  else if (/Firefox/i.test(ua))                         browser = 'Firefox'
  else if (/Edg/i.test(ua))                             browser = 'Edge'

  // Try to get OS version for Safari/iOS
  const iosMatch = ua.match(/OS (\d+_\d+)/i)
  if (iosMatch && mobile) browser += ` iOS ${iosMatch[1].replace('_', '.')}`

  return { device, browser }
}

// ── Submit to Google Form ──────────────────────────────────────────────────
const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdfJYIKhWeByg3iagWvJxa9nDrtTP34bZIZ4L4mf4cg4t5CLA/formResponse'

const FIELDS = {
  type:       'entry.165427669',
  description:'entry.338746443',
  email:      'entry.861665516',
  appVersion: 'entry.260396475',
  page:       'entry.792977200',
  device:     'entry.400201723',
  browser:    'entry.1895668318',
  errorLog:   'entry.82341989',
}

// ── Download tracking ──────────────────────────────────────────────────────
const DOWNLOAD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyX0WyiuiG86e2NDpoQnzSPj_ThW986bpK52m4GlFZ-vMSDo1RJ1P0GLGSHMvDnfZwWjg/exec'

async function _track({ resumeData, jobInfo, template, format, atsScore }) {
  const { device, browser } = getDeviceInfo()
  const body = new URLSearchParams()
  body.append('name',          resumeData?.name       || '')
  body.append('email',         resumeData?.email      || '')
  body.append('phone',         resumeData?.phone      || '')
  body.append('company',       jobInfo?.company       || '')
  body.append('role',          jobInfo?.title         || '')
  body.append('seniority',     jobInfo?.seniority     || '')
  body.append('template',      template               || '')
  body.append('format',        format                 || '')
  body.append('atsScore',      atsScore != null ? String(atsScore) : '')
  body.append('browserDevice', `${browser} · ${device}`)
  await fetch(DOWNLOAD_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body })
}

export async function trackDownload({ resumeData, jobInfo, template, format, atsScore }) {
  try { await _track({ resumeData, jobInfo, template, format, atsScore }) }
  catch (e) { console.warn('[trackDownload] failed:', e) }
}

export async function trackEvent(eventType, { resumeData, jobInfo, atsScore } = {}) {
  try { await _track({ resumeData, jobInfo, format: eventType, atsScore }) }
  catch (e) { console.warn('[trackEvent] failed:', e) }
}

export async function submitFeedback({ type, description, email, page }) {
  const { device, browser } = getDeviceInfo()
  const errorLog = getLastError()

  const body = new FormData()
  body.append(FIELDS.type,        type)
  body.append(FIELDS.description, description)
  body.append(FIELDS.email,       email || 'not provided')
  body.append(FIELDS.appVersion,  APP_VERSION)
  body.append(FIELDS.page,        page)
  body.append(FIELDS.device,      device)
  body.append(FIELDS.browser,     browser)
  body.append(FIELDS.errorLog,    errorLog || 'none')

  // no-cors — we can't read the response but the form submission goes through
  await fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body })
}
