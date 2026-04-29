import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import StepUpload from './components/StepUpload'
import StepJobDescription from './components/StepJobDescription'
import StepAnalyzeGenerate from './components/StepAnalyzeGenerate'
import StepDownload from './components/StepDownload'
import VersionManager from './components/VersionManager'
import ApplicationTracker from './components/ApplicationTracker'
import ApiKeyModal, { getStoredApiKey } from './components/ApiKeyModal'
import { uid } from './utils/storage'
import { readSession, writeSession, clearSession } from './utils/session'

function App() {
  const navigate    = useNavigate()
  const [apiKey, setApiKey]       = useState(getStoredApiKey)
  const [showModal, setShowModal] = useState(false)
  const [isMigration, setIsMigration] = useState(false)

  // ── Session state — all persisted to sessionStorage ──────────────────────
  const s = readSession()
  const [sessionId,       setSessionId]       = useState(() => s.sessionId || uid())
  const [resumeText,      setResumeText]      = useState(() => s.resumeText)
  const [jobDescription,  setJobDescription]  = useState(() => s.jobDescription)
  const [generatedResume, setGeneratedResume] = useState(() => s.generatedResume)
  const [healthScore,     setHealthScore]     = useState(() => s.healthScore)
  const [matchScore,      setMatchScore]      = useState(() => s.matchScore)
  const [tailoredScore,   setTailoredScore]   = useState(() => s.tailoredScore)
  const [userMode,        setUserMode]        = useState(() => s.userMode)
  const [jobInfo,         setJobInfo]         = useState(null)

  // On mount — clear any legacy Gemini key and force key setup
  useEffect(() => {
    const stored = getStoredApiKey()
    if (stored.startsWith('AIza')) {
      localStorage.removeItem('resume_tailor_api_key')
      setApiKey('')
      setIsMigration(true)
      setShowModal(true)
    }
  }, [])

  // Sync any session state change → sessionStorage
  useEffect(() => {
    writeSession({
      sessionId, resumeText, jobDescription, generatedResume,
      healthScore, matchScore, tailoredScore,
      userMode,
    })
  }, [sessionId, resumeText, jobDescription, generatedResume,
      healthScore, matchScore, tailoredScore,
      userMode])

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleStart() {
    clearSession()
    setResumeText('')
    setJobDescription('')
    setGeneratedResume(null)
    setHealthScore(null)
    setMatchScore(null)
    setTailoredScore(null)
    setJobInfo(null)
    setSessionId(uid())
    if (getStoredApiKey()) navigate('/upload')
    else setShowModal(true)
  }

  function handleKeySet(key) {
    setApiKey(key)
    if (key) { setShowModal(false); navigate('/upload') }
  }

  function handleStartOver() {
    clearSession()
    setResumeText('')
    setJobDescription('')
    setGeneratedResume(null)
    setHealthScore(null)
    setMatchScore(null)
    setTailoredScore(null)
    setJobInfo(null)
    setSessionId(uid())
    navigate('/')
  }

  function handleLoadVersion(version) {
    setGeneratedResume(version.resumeData)
    setResumeText(version.resumeText || '')
    setJobDescription(version.jobDescription || '')
    setMatchScore(version.matchScore ?? null)
    setTailoredScore(version.tailoredScore ?? null)
    setUserMode(version.userMode || 'standard')
    setSessionId(version.sessionId || uid())
    navigate('/download')
  }

  function handleRetailor(version) {
    setResumeText(version.resumeText || '')
    setJobDescription('')
    setMatchScore(null)
    setTailoredScore(null)
    setUserMode(version.userMode || 'standard')
    setSessionId(uid())
    navigate('/job')
  }

  const openSettings = () => { setIsMigration(false); setShowModal(true) }

  // ── Shared props ──────────────────────────────────────────────────────────
  const wizardProps = { apiKey, onOpenSettings: openSettings }

  return (
    <>
      {showModal && (
        <ApiKeyModal
          onClose={() => setShowModal(false)}
          onKeySet={handleKeySet}
          isMigration={isMigration}
        />
      )}

      <Routes>
        <Route path="/" element={
          <LandingPage
            onStart={handleStart}
            onChangeKey={openSettings}
            onGoToVersions={() => navigate('/versions')}
            onGoToTracker={() => navigate('/tracker')}
          />
        } />

        <Route path="/upload" element={
          <StepUpload
            {...wizardProps}
            onBack={() => navigate('/')}
            onNext={() => navigate('/job')}
            onTextExtracted={text => setResumeText(text)}
            onHealthScore={setHealthScore}
            userMode={userMode}
            onUserModeChange={setUserMode}
          />
        } />

        <Route path="/job" element={
          resumeText
            ? <StepJobDescription
                {...wizardProps}
                value={jobDescription}
                onChange={setJobDescription}
                onBack={() => navigate('/upload')}
                onNext={() => navigate('/analyze')}
                resumeText={resumeText}
                userMode={userMode}
                healthScore={healthScore}
                onJobInfoParsed={setJobInfo}
              />
            : <Navigate to="/upload" replace />
        } />

        <Route path="/analyze" element={
          resumeText && jobDescription
            ? <StepAnalyzeGenerate
                {...wizardProps}
                resumeText={resumeText}
                jobDescription={jobDescription}
                userMode={userMode}
                jobInfo={jobInfo}
                healthScore={healthScore}
                onBack={() => navigate('/job')}
                onNext={() => navigate('/download')}
                onResumeGenerated={setGeneratedResume}
                onMatchScore={setMatchScore}
                onTailoredScore={setTailoredScore}
              />
            : <Navigate to={resumeText ? '/job' : '/upload'} replace />
        } />

        <Route path="/download" element={
          generatedResume
            ? <StepDownload
                {...wizardProps}
                data={generatedResume}
                onStartOver={handleStartOver}
                onBack={() => navigate(-1)}
                jobDescription={jobDescription}
                jobInfo={jobInfo}
                beforeScore={matchScore}
                afterScore={tailoredScore}
                resumeText={resumeText}
                userMode={userMode}
                sessionId={sessionId}
                onGoToVersions={() => navigate('/versions')}
                onGoToTracker={() => navigate('/tracker')}
              />
            : <Navigate to="/analyze" replace />
        } />

        <Route path="/versions" element={
          <VersionManager
            onBack={() => navigate(-1)}
            onLoadVersion={handleLoadVersion}
            onRetailor={handleRetailor}
          />
        } />

        <Route path="/tracker" element={
          <ApplicationTracker
            onBack={() => navigate(-1)}
            apiKey={apiKey}
            onLoadVersion={handleLoadVersion}
          />
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
