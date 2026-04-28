const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL_STORAGE_KEY = 'resume_tailor_model'

export const MODEL_OPTIONS = [
  {
    id:        'llama-3.3-70b-versatile',
    name:      'Best Quality',
    shortName: 'Best',
    tag:       'Recommended',
    tagColor:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    limitReq:  1000,
    limitTPD:  100000,
    limitTPM:  12000,
    desc:      'Sharpest rewrites and strongest ATS matching. Start here for best results.',
  },
  {
    id:        'meta-llama/llama-4-scout-17b-16e-instruct',
    name:      'High Capacity',
    shortName: 'Hi-Cap',
    tag:       '5× Daily Limit',
    tagColor:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
    limitReq:  1000,
    limitTPD:  500000,
    limitTPM:  30000,
    desc:      '5× more daily usage than Best Quality. Switch here when Best Quality hits its limit.',
  },
  {
    id:        'qwen/qwen3-32b',
    name:      'Balanced',
    shortName: 'Balanced',
    tag:       '5× Daily Limit',
    tagColor:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
    limitReq:  1000,
    limitTPD:  500000,
    limitTPM:  6000,
    desc:      'High daily limit with precise instruction following. Good all-rounder.',
  },
  {
    id:        'llama-3.1-8b-instant',
    name:      'Basic',
    shortName: 'Basic',
    tag:       'Last Resort',
    tagColor:  'text-slate-400 bg-slate-800 border-slate-700',
    limitReq:  14400,
    limitTPD:  500000,
    limitTPM:  6000,
    desc:      'Fastest response and highest request limit. Lower quality — use only when others are unavailable.',
  },
]

// ── Token usage tracking (accumulated from response body, resets daily) ───────

const EXHAUSTED_KEY   = 'resume_tailor_exhausted'
const TOKEN_USAGE_KEY = 'resume_tailor_token_usage'

function trackDailyUsage(modelId, tokensUsed) {
  if (!tokensUsed) return
  try {
    const today = new Date().toISOString().slice(0, 10)
    const usage = JSON.parse(localStorage.getItem(TOKEN_USAGE_KEY) || '{}')
    if (!usage[modelId] || usage[modelId].date !== today) usage[modelId] = { date: today, used: 0 }
    usage[modelId].used += tokensUsed
    localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(usage))
    window.dispatchEvent(new CustomEvent('ratelimit-updated'))
  } catch {}
}

export function getRateLimitInfo(modelId) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const usage = JSON.parse(localStorage.getItem(TOKEN_USAGE_KEY) || '{}')
    const model = MODEL_OPTIONS.find(m => m.id === modelId)
    if (!model) return null
    const used      = (usage[modelId]?.date === today) ? usage[modelId].used : 0
    const tokTotal  = model.limitTPD
    const tokRemain = Math.max(0, tokTotal - used)
    return { tokRemain, tokTotal, used, isDefault: used === 0 }
  } catch { return null }
}

export function markModelExhausted(modelId) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const data  = JSON.parse(localStorage.getItem(EXHAUSTED_KEY) || '{}')
    data[modelId] = today
    localStorage.setItem(EXHAUSTED_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('ratelimit-updated'))
  } catch {}
}

export function isModelExhausted(modelId) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const data  = JSON.parse(localStorage.getItem(EXHAUSTED_KEY) || '{}')
    if (data[modelId] !== today) {
      if (data[modelId]) {
        delete data[modelId]
        localStorage.setItem(EXHAUSTED_KEY, JSON.stringify(data))
      }
      return false
    }
    return true
  } catch { return false }
}

export function getNextFallbackModel() {
  const current = getStoredModel()
  // Scan in quality order (array order), skip current and exhausted models
  return MODEL_OPTIONS.find(m => m.id !== current && !isModelExhausted(m.id)) || null
}

export function getStoredModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || MODEL_OPTIONS[0].id
}

export function setStoredModel(id) {
  localStorage.setItem(MODEL_STORAGE_KEY, id)
}

// ── Routine task model routing ─────────────────────────────────────────────────
// Simple/mechanical tasks (scoring, parsing, health check) use this priority
// order instead of the user's selected model, to preserve the user's daily quota
// on the better models for the tasks that actually matter (analysis, generation).

const ROUTINE_PRIORITY = [
  'qwen/qwen3-32b',                            // 128K ctx · 500K TPD — primary
  'meta-llama/llama-4-scout-17b-16e-instruct', // 128K ctx · 500K TPD — second
  'llama-3.3-70b-versatile',                   // 128K ctx · 100K TPD — third
  'llama-3.1-8b-instant',                      // 8K  ctx · 500K TPD — last resort
]

function getRoutineModel() {
  return ROUTINE_PRIORITY.find(id => !isModelExhausted(id)) ?? getStoredModel()
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function _call(apiKey, prompt, { temperature = 0.1, maxOutputTokens = 8192, signal, _modelId } = {}) {
  const modelId = _modelId ?? getStoredModel()
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature === 0 ? 1e-8 : temperature,
      max_completion_tokens: maxOutputTokens,
    }),
    signal,
  })

  // modelId already set above

  if (!res.ok) {
    const body = await res.text()
    const msg = (() => {
      try { return JSON.parse(body).error?.message || body }
      catch { return body }
    })()
    if (res.status === 400) throw new Error(`Invalid request: ${msg.slice(0, 120)}`)
    if (res.status === 401 || res.status === 403) throw new Error('API key is invalid — check your Groq key at console.groq.com')
    if (res.status === 429) {
      const currentModel = getStoredModel()
      markModelExhausted(currentModel)
      const wait     = (() => { try { return JSON.parse(body).error?.message?.match(/try again in ([^.]+)/i)?.[1] } catch {} return null })()
      const fallback = getNextFallbackModel()
      const err = new Error(
        fallback
          ? `Daily limit reached. Switch to ${fallback.name} (next best available) in the model selector above.${wait ? ` Current model resets in ${wait}.` : ''}`
          : `All models have hit their daily limit. Try again tomorrow or upgrade at console.groq.com.${wait ? ` Resets in ${wait}.` : ''}`
      )
      err.isFallbackSuggestion = true
      err.suggestedModelId = fallback?.id || null
      throw err
    }
    if (res.status === 413) {
      const currentModel = MODEL_OPTIONS.find(m => m.id === modelId)
      const fallback = MODEL_OPTIONS.find(m => m.id !== modelId && !isModelExhausted(m.id))
      const err = new Error(
        fallback
          ? `Resume or job description is too long for ${currentModel?.name || 'this model'} (small context window). Switch to "${fallback.name}" in the model selector above — it handles much longer content.`
          : 'Resume or job description is too long for this model. Try shortening the job description, or paste only the key requirements section.'
      )
      err.isFallbackSuggestion = true
      err.suggestedModelId = fallback?.id || null
      throw err
    }
    if (res.status === 503) throw new Error('Groq is temporarily unavailable. Wait 30 seconds and try again.')
    throw new Error(`API error ${res.status}: ${msg.slice(0, 120)}`)
  }

  const data = await res.json()
  trackDailyUsage(_modelId ?? getStoredModel(), data.usage?.total_tokens)
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No response from model — try again.')
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('Response was too long — try a shorter resume or JD.')

  return text.trim()
}

// ── Strip markdown fences & extract JSON ─────────────────────────────────────

function _parseJSON(raw) {
  // Strip <think>...</think> blocks (qwen3-32b chain-of-thought) before parsing
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const cleaned = stripped
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try { return JSON.parse(cleaned) } catch {}
  const obj = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (!obj) throw new Error('No JSON found in model response.')
  return JSON.parse(obj[1])
}

// ── Routine call with auto-fallback chain ─────────────────────────────────────
// Tries each model in ROUTINE_PRIORITY order.
// Skips exhausted models and models that 429/413 during the call.
// Falls back to user's selected model only if every routine model fails.

async function _callRoutine(apiKey, prompt, opts) {
  const tried = new Set()
  for (const id of ROUTINE_PRIORITY) {
    if (isModelExhausted(id)) continue
    tried.add(id)
    // qwen3-32b outputs <think>...</think> reasoning by default — disable it for routine tasks
    const adjustedPrompt = id === 'qwen/qwen3-32b' ? `/no_think\n${prompt}` : prompt
    try {
      return await _call(apiKey, adjustedPrompt, { ...opts, _modelId: id })
    } catch (e) {
      // 429 already marked exhausted inside _call — skip to next
      // 413 means context too large for this model — skip to next
      if (e.isFallbackSuggestion) continue
      throw e // real error (401, 400, network, etc.) — propagate immediately
    }
  }
  // Every routine model is exhausted or failed — use user's selected model
  return _call(apiKey, prompt, opts)
}

// ── Public helpers ─────────────────────────────────────────────────────────────

/** Returns raw text (complex task — uses user's selected model) */
export async function geminiText(apiKey, prompt, opts) {
  return _call(apiKey, prompt, opts)
}

/**
 * Returns parsed JSON.
 * Pass routine: true for lightweight tasks (JD parse, health score, quality check, trim, polish).
 * Complex tasks (analysis, generation) leave routine unset → use user's selected model.
 */
export async function geminiJSON(apiKey, prompt, opts, routine = false) {
  const raw = routine
    ? await _callRoutine(apiKey, prompt, opts)
    : await _call(apiKey, prompt, opts)
  return _parseJSON(raw)
}

/** Returns integer 0-100 score — always a routine task */
export async function geminiScore(apiKey, prompt, opts) {
  const raw = await _callRoutine(apiKey, prompt, { temperature: 0, maxOutputTokens: 2048, ...opts })
  // Strip <think>...</think> blocks (qwen3-32b chain-of-thought) before extracting number
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const text = cleaned || raw
  const match = text.match(/\b(\d{1,3})\b/)
  const val = match ? parseInt(match[1], 10) : NaN
  return isNaN(val) ? null : Math.min(100, Math.max(0, val))
}

/** Validate API key — throws on invalid, resolves on valid */
export async function validateApiKey(key) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${key.trim()}` },
  })
  if (!res.ok) throw new Error('Invalid Groq API key — get yours free at console.groq.com')
}
