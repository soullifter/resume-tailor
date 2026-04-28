const MODEL = 'gemini-3.1-flash-lite-preview'
const BASE_URL = key =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`

// ── Core fetch ────────────────────────────────────────────────────────────────

async function _call(apiKey, prompt, { temperature = 0.1, maxOutputTokens = 8192, signal } = {}) {
  const res = await fetch(BASE_URL(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text()
    const msg = (() => {
      try { return JSON.parse(body).error?.message || body }
      catch { return body }
    })()
    if (res.status === 400) throw new Error(`Invalid request: ${msg.slice(0, 120)}`)
    if (res.status === 401 || res.status === 403) throw new Error('API key is invalid or has no access.')
    if (res.status === 429) throw new Error('Quota exceeded — wait a moment and try again.')
    if (res.status === 503) throw new Error('Gemini is temporarily overloaded — this is normal for the free tier during high demand. Wait 30–60 seconds and try again.')
    throw new Error(`API error ${res.status}: ${msg.slice(0, 120)}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  if (!candidate) throw new Error('No response from model — try again.')
  if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Response was too long — try a shorter resume or JD.')

  return candidate.content.parts[0].text.trim()
}

// ── Strip markdown fences & extract JSON ─────────────────────────────────────

function _parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  // Try direct parse first
  try { return JSON.parse(cleaned) } catch {}
  // Fall back: extract first {...} or [...]
  const obj = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (!obj) throw new Error('No JSON found in model response.')
  return JSON.parse(obj[1])
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns raw text */
export async function geminiText(apiKey, prompt, opts) {
  return _call(apiKey, prompt, opts)
}

/** Returns parsed JSON object/array */
export async function geminiJSON(apiKey, prompt, opts) {
  const raw = await _call(apiKey, prompt, opts)
  return _parseJSON(raw)
}

/** Returns integer 0-100 score */
export async function geminiScore(apiKey, prompt, opts) {
  const raw = await _call(apiKey, prompt, { temperature: 0, maxOutputTokens: 10, ...opts })
  const val = parseInt(raw.replace(/[^0-9]/g, ''), 10)
  return isNaN(val) ? null : Math.min(100, Math.max(0, val))
}

/** Validate API key — returns true/false */
export async function validateApiKey(key) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}?key=${key.trim()}`
    )
    return res.ok
  } catch {
    return false
  }
}
