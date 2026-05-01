import { useState, useRef } from 'react'
import { transcribeAudio } from '../utils/groq'

// ── Browser format detection ──────────────────────────────────────────────────

function getBestMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || null
}

const SUPPORTED_MIME = getBestMimeType()

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceInput({ apiKey, onTranscript }) {
  const [status, setStatus] = useState('idle') // idle | requesting | recording | transcribing | done | error | unsupported
  const [error, setError]   = useState('')
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const timerRef    = useRef(null)

  const supported = !!SUPPORTED_MIME

  async function start() {
    if (!supported) { setStatus('unsupported'); return }
    setStatus('requesting')
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME })
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        setStatus('transcribing')
        try {
          const blob = new Blob(chunksRef.current, { type: SUPPORTED_MIME })
          const text = await transcribeAudio(apiKey, blob, SUPPORTED_MIME)
          onTranscript(text)
          setStatus('done')
          setTimeout(() => setStatus('idle'), 1500)
        } catch (e) {
          setError(e.message || 'Transcription failed. Try again.')
          setStatus('error')
        }
      }

      recorder.start()
      recorderRef.current = recorder
      setElapsed(0)
      setStatus('recording')
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } catch (e) {
      const msg = e.name === 'NotAllowedError' || e.message?.includes('denied')
        ? 'Microphone access denied. Allow mic in browser settings.'
        : e.message || 'Could not start recording.'
      setError(msg)
      setStatus('error')
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  function reset() {
    clearInterval(timerRef.current)
    setStatus('idle')
    setError('')
    setElapsed(0)
  }

  return { supported, status, error, elapsed, start, stop, reset }
}

// ── MicButton component ───────────────────────────────────────────────────────

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MicButton({ apiKey, onTranscript, label = 'Speak', className = '' }) {
  const { supported, status, error, elapsed, start, stop, reset } = useVoiceInput({ apiKey, onTranscript })

  if (!supported) {
    return (
      <span className={`text-xs text-slate-600 italic ${className}`} title="Voice input requires Chrome, Firefox, or Safari 14+">
        🎤 Voice not supported
      </span>
    )
  }

  if (status === 'idle' || status === 'unsupported') {
    return (
      <button
        type="button"
        onClick={start}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors ${className}`}
      >
        🎤 {label}
      </button>
    )
  }

  if (status === 'requesting') {
    return (
      <span className={`flex items-center gap-1.5 text-xs text-slate-500 ${className}`}>
        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Requesting mic...
      </span>
    )
  }

  if (status === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${className}`}
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
        {fmt(elapsed)} — tap to stop
      </button>
    )
  }

  if (status === 'transcribing') {
    return (
      <span className={`flex items-center gap-1.5 text-xs text-blue-400 ${className}`}>
        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Transcribing...
      </span>
    )
  }

  if (status === 'done') {
    return (
      <span className={`flex items-center gap-1 text-xs text-emerald-400 ${className}`}>
        ✓ Done
      </span>
    )
  }

  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-red-400">{error}</span>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-slate-500 hover:text-white underline transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return null
}
