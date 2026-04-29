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
const DOWNLOAD_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfPXE8o88HnaZFVOnzVvakOUqpvf_sJbzz8vL4l5lwdI3uejQ/formResponse'

const DOWNLOAD_FIELDS = {
  timestamp:     'entry.771984011',
  name:          'entry.228836573',
  email:         'entry.1896662128',
  phone:         'entry.394669804',
  company:       'entry.996407031',
  role:          'entry.1283656379',
  seniority:     'entry.622582645',
  template:      'entry.273624715',
  format:        'entry.113500063',
  atsScore:      'entry.134314495',
  browserDevice: 'entry.1467238439',
}

export async function trackDownload({ resumeData, jobInfo, template, format, atsScore }) {
  try {
    const { device, browser } = getDeviceInfo()
    const body = new FormData()
    body.append(DOWNLOAD_FIELDS.timestamp,     new Date().toISOString())
    body.append(DOWNLOAD_FIELDS.name,          resumeData?.name          || '')
    body.append(DOWNLOAD_FIELDS.email,         resumeData?.email         || '')
    body.append(DOWNLOAD_FIELDS.phone,         resumeData?.phone         || '')
    body.append(DOWNLOAD_FIELDS.company,       jobInfo?.company          || '')
    body.append(DOWNLOAD_FIELDS.role,          jobInfo?.title            || '')
    body.append(DOWNLOAD_FIELDS.seniority,     jobInfo?.seniority        || '')
    body.append(DOWNLOAD_FIELDS.template,      template                  || 'classic')
    body.append(DOWNLOAD_FIELDS.format,        format                    || 'pdf')
    body.append(DOWNLOAD_FIELDS.atsScore,      atsScore != null ? String(atsScore) : '')
    body.append(DOWNLOAD_FIELDS.browserDevice, `${browser} · ${device}`)
    await fetch(DOWNLOAD_FORM_URL, { method: 'POST', mode: 'no-cors', body })
  } catch {}
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
