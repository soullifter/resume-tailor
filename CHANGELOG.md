# Changelog

All notable changes to ResumeTailor are documented here.
Format: `Major.Minor.Patch` — bump policy:
- **Patch** — bug fixes, small UI tweaks
- **Minor** — new features, no breaking changes
- **Major** — breaking changes or major product pivots

---

## [1.6.1] — 2026-05-01

### Bug fixes & landing page accuracy
- Fixed `handleUpdateSave` not persisting `jobInfo` — updating a saved resume no longer wipes job context from the saved version
- Landing page tool count updated from 16 → 20 (ticker, hero, stat bar, features section, demo CTA)
- Added Cold Outreach Email, Company Research, Salary Research, and Voice Input to the landing page feature pill strip

---

## [1.6.0] — 2026-05-01

### Phase 3 — Voice Input + Funnel Tracking

#### Voice Input
- **JD step**: "🎤 Speak JD" button — dictate job description; pastes transcript, no auto-trigger
- **Custom Instructions**: "🎤 Speak" mic button next to label — fills instructions field (300-char cap)
- **Build from Scratch — Summary**: mic button fills summary field from voice
- **Build from Scratch — Experience**: "🎤 Add role by voice" per experience entry — transcribes, then calls `llama-3.1-8b-instant` to extract title/company/dates/bullets from the voice note
- Cross-browser `MediaRecorder` format detection: `webm;codecs=opus → webm → ogg → mp4`
- Graceful "not supported" tooltip for legacy browsers

#### Funnel Tracking
- Fire `trackEvent('analyzed', ...)` after analysis completes (captures ATS score + job info)
- Fire `trackEvent('generated', ...)` after resume generation completes (captures resume data + ATS)
- Reuses same Apps Script endpoint; `format` field carries event type (`analyzed`, `generated`, `pdf`, `docx`)

#### Bug Fixes
- JSON truncation error now shows friendly message instead of raw `SyntaxError`
- JD validation snippet bumped to 4000 chars (fixes false positive on LinkedIn JDs)
- Save Resume modal auto-fills company/role from `jobInfo`

---

## [1.5.1] — 2026-04-30

### TTS button polish
- "🔊 Read" / "⏹ Stop" labeled button replaces ambiguous SVG icon — intent is now obvious
- Read aloud now covers all 5 tools including Interview Prep (previously skipped list results)
- Active speaking state shows blue highlight on the button

---

## [1.5.0] — 2026-04-30

### Phase 2 — AI-powered application tools

#### Cold Outreach Email
- New tool on the download page — researches the company via web search and writes a hyper-personalized outreach email
- Returns structured `{ subject, body }` with separate copy buttons for each
- Uses `compound-beta-mini` (built-in web search)

#### Enhanced Cover Letter
- When company is known from JD analysis, automatically researches the company before writing
- Opening paragraph references specific, real facts about the company
- "Web search" badge shown when company research is active

#### Salary Range Lookup
- New tool — searches for real-time market salary data for the role, company, and location
- Returns range, median, equity/bonus components, and sources

#### Company Research in Application Tracker
- "🔍 Research" button on every application card
- Opens a modal with company overview, tech stack, culture, recent news, and interview tips
- Powered by `compound-beta-mini` web search

#### TTS Read Aloud
- 🔊 speaker button on Cover Letter, LinkedIn Summary, Cold Outreach body, and Salary results
- Uses browser-native `speechSynthesis` — no API cost
- Click to start, click pause icon to stop

#### Pre-population & persistence
- Cold Outreach and Salary Lookup fields pre-populate from `jobInfo` (company, role, location)
- `jobInfo` persisted in `sessionStorage` — survives page refresh
- `jobInfo` saved alongside resume — restored when opening from My Resumes
- Location field uses job location (`jobInfo.location`), not candidate's home location

#### Result display improvements
- Markdown renderer for tool results — renders `**bold**`, `*italic*`, and pipe tables
- Collapse/expand chevron on all 5 tool cards — result stays until you dismiss it
- Email body renders with paragraph spacing instead of flat `pre-wrap`

#### Bug fixes
- JD validation snippet bumped 1500 → 4000 chars — reduces false positives on fetched LinkedIn JDs
- `ResearchCard` fields sync when `jobInfo` arrives after mount (useEffect on defaultsKey)

---

## [1.4.2] — 2026-04-30

### JD analysis — manual trigger (no more auto-fire on every keystroke)
- Removed auto-parse debounce that fired API calls on every keystroke — was wasting token quota and hitting rate limits during active typing
- Added "🔍 Analyze JD" button below the textarea — user triggers analysis once when done pasting
- After analysis, collapsed card shows "Re-analyze" button next to "Edit" for quick re-trigger
- URL auto-fetch still auto-analyzes immediately (JD is complete on fetch)

### Additional pre-flight validations
- JD validation: background check detects if pasted text isn't a job description → amber warning banner
- JD injection check: runs when clicking "Analyze & Tailor", blocks with error if unsafe content detected
- Bullet rewrite injection check: ✨ rewrite button checks bullet content before sending to AI, shows inline error if blocked
- All three use `llama-3.1-8b-instant` (Basic) — fast, no impact on user quota

---

## [1.4.1] — 2026-04-30

### Section reordering in editor
- ▲ ▼ buttons on every section header (Experience, Skills, Projects, Certifications, Education) to move sections up or down
- Order reflects instantly in the live HTML preview, the PDF canvas preview, and the downloaded PDF
- Section order persisted in resume data — survives edits, polish, trim, and re-saves
- Backwards compatible — resumes without a saved order default to the original order

### ResumeTailor logo on My Resumes page
- "R" gradient logo + ResumeTailor label added to the My Resumes header, matching the step pages
- Clicking it navigates to the home/landing page

---

## [1.4.0] — 2026-04-30

### Deep Reasoning model
- Added `openai/gpt-oss-120b` as a new "Deep Reasoning" model option — thinks before writing for more thorough tailoring
- Reasoning model handling: `max_completion_tokens` boosted to min 6000 so internal thinking doesn't consume the output budget
- Specific error message when reasoning model exhausts its token budget mid-response

### Pre-flight resume validation
- After upload, automatically checks if the file is actually a resume using a fast background call
- Amber warning banner if uploaded file doesn't look like a resume or CV (non-blocking — user can still proceed)
- Blue info banner if a non-English resume is detected — warns that results may vary

### Prompt injection protection
- Custom instructions field is checked for jailbreak/prompt injection attempts before generation runs
- Generation blocked with a clear error if unsafe content detected; fails open silently on check errors

### Rate limit bug fixes
- Fixed: routine tasks (scoring, JD parse) hitting a 429 were incorrectly marking the user's selected model as exhausted instead of the actual failing model
- Fixed: per-minute rate limit 429s no longer mark the model as exhausted — only daily limit errors do; per-minute shows "wait a moment" message instead

---

## [1.3.0] — 2026-04-29

### JD auto-fetch from job URLs
- Paste a LinkedIn or Greenhouse job URL to auto-fill the job description — no more manual copy-paste
- LinkedIn: all URL formats supported (`/jobs/view/{id}`, `?currentJobId=`, `&currentJobId=`)
- Greenhouse: direct public API (`boards.greenhouse.io` and `job-boards.greenhouse.io`)
- LinkedIn fetched via Apps Script proxy (no CORS issues); Greenhouse fetched directly
- Graceful fallback — if fetch fails, error message shown and textarea stays ready for manual paste

### Download counter on landing page
- Big animated number above the CTA showing total resumes downloaded
- Smooth count-up animation when number loads
- Pulsing skeleton shown while fetching — no "0" flicker on load
- Spinning live indicator ring next to the label
- Auto-refreshes count every 60 seconds

### Download tracking fix
- Switched from Google Forms to Apps Script `doPost` endpoint
- Fixed blank rows issue — all fields (name, email, company, role, seniority, template, format, ATS score, browser/device) now correctly recorded in Google Sheets

---

## [1.2.3] — 2026-04-29

### AI generation quality — kill the AI-generated feel
- **Ban filler tails**: "demonstrating hands-on experience with X", "showcasing ability to Y", "highlighting proficiency in Z" are now explicitly forbidden — the #1 AI tell
- **Preserve specifics**: model names (SimCLR, BERT), dataset names (CIFAR-10), paper titles must survive rewriting — never replaced with generic category names
- **Projects expand, not compress**: 2-3 bullets per project with specific tool/dataset/result; rich projects no longer collapsed to 1 vague line
- **Summary anchored to real background**: no more generic "Results-driven professional" openers — must reference specific role, institution, or achievement from the candidate's actual resume
- **Vary bullet length naturally**: short punchy bullets mixed with longer context bullets — uniform length is an AI tell
- **Don't over-polish strong bullets**: if original is already specific and concrete, preserve its phrasing — only rewrite genuinely weak bullets
- **Ban AI buzzwords**: "leveraged", "spearheaded", "synergized", "demonstrating", "showcasing" removed from generation vocabulary

### ATS scorer — stricter, more accurate
- Keyword in bullet with specific context = full credit (was: any bullet appearance = full credit)
- Keyword in bullet but vague/generic usage = 0.5 credit (new)
- Keyword in skills section only = 0.25 credit (was: 0.5)
- Quality penalties: −8 if <30% bullets have real metrics, −6 if 3+ filler-tail bullets, −4 if summary is generic
- Score now reflects real recruiter pass rate, not just keyword presence

---

## [1.2.2] — 2026-04-29

### AI generation quality — anti-fake-metrics & bullet variety
- **No invented metrics**: generation prompt now explicitly forbids adding any number, %, or $ not present in the original resume — fake metrics like "25%" or "30%" will no longer appear
- **Varied bullet structures**: AI no longer writes every bullet in the same "Verb + task + X% improvement" pattern — sentence shapes are now mixed to avoid AI-looking output
- **`[X]` placeholder restricted**: placeholder only valid when original bullet clearly has a measurable outcome but no figure — the vast majority of bullets will have no `[X]`
- Same fixes applied to single-bullet rewrite tool (`bulletRewritePrompt`)
- Freelance mode instruction updated — no longer uses `[X]`/`[N]` example templates that could cause fabrication
- Generation temperature bumped 0.35 → 0.5 for more natural, varied language

---

## [1.2.1] — 2026-04-29

### Fixes & polish
- PDF preview zoom: − / + buttons, trackpad pinch (ctrl+scroll), touch pinch — panel stays fixed size, content scrolls inside
- Preview panel: full-width 50/50 split on all screen sizes — removed `max-w-7xl` centering that caused side margins on large screens
- Preview background: dark slate behind PDF canvas — no white bleed around the page
- Bullets: strip trailing periods post-generation (resume convention); prompt updated to enforce this
- JD step: "Analyze & Tailor" button disabled and shows "Analyzing JD…" while JD analysis is in progress

---

## [1.2.0] — 2026-04-29

### Download page redesign — split-pane layout
- Two-column layout on desktop: controls on the left, live PDF preview on the right
- Full-screen split-pane — left panel scrolls independently, right panel is fixed full-height
- PDF preview fits exactly to panel height (no black space, no clipping) using `Math.min(scaleByWidth, scaleByHeight)` scaling
- Multi-page resumes: "Page X of Y" label with ← → navigation arrows in preview panel
- Mobile unchanged — single-column layout with preview toggle as before
- Consistent `max-w-7xl` centered container with `px-8` side padding on download page
- All step pages (Upload, Job Description, Analyze) bumped from `max-w-xl` → `max-w-2xl` to match column width
- `text-xs` → `text-sm` across all app components for improved readability

---

## [1.1.0] — 2026-04-28

### Word (.docx) support
- Upload `.docx` resumes — text extracted via `mammoth`, same flow as PDF
- Download as Word (.docx) — generated from resume data with Classic / Modern / Minimal color schemes
- Format toggle on download page — choose PDF or Word before downloading
- PDF template selector only shown when PDF format is selected
- File input and upload copy updated to mention PDF or Word (.docx)
- Landing page FAQ updated — Word upload now mentioned
- `docx` package added for generation; `mammoth` package added for extraction

---

## [1.0.2] — 2026-04-28

### Bug fixes
- Gear modal now scrollable on mobile — `max-h-[88vh]` + `overflow-y-auto` prevents content getting cut off
- API key masked display no longer overflows its box on mobile — truncates cleanly
- Feedback page detection fixed — landing page (`#/`) now correctly reports "Home" instead of "Upload Resume"

---

## [1.0.1] — 2026-04-28

### Settings modal refactor
- Feedback and Export/Import moved out of the inline gear modal into separate focused sub-modals
- Gear modal now only shows API key + model selector — cleaner and scrollable
- "Send Feedback" and "Export / Import" buttons at the bottom open their own overlays

---

## [1.0.0] — 2026-04-28

### First stable release 🎉

#### Core Features
- PDF upload with text extraction (pdfjs-dist)
- Job description input + AI parsing
- AI resume analysis — match score, strengths, gaps, keyword coverage
- AI resume generation — rewrites bullets, summary, skills tailored to JD
- Bold metric formatting in bullets (`**text**` syntax, renders in PDF + HTML preview)

#### Editor
- Full resume editor — experience, skills, education, projects, certifications
- Custom sections — add any section with bullet items
- Bold button in bullet editor — select text → click B to wrap in `**`
- Remove button on all sections including education

#### PDF & Download
- 3 templates — Classic, Modern, Minimal
- Canvas-based PDF preview on mobile (pdfjs renderer)
- PDFViewer iframe preview on desktop
- Download with custom filename modal
- Page-break safe bullets (`wrap={false}`)

#### Quality Tools
- ATS Health Score on upload
- Pre-submit check — placeholders, missing fields, empty bullets
- Length trimmer — trim to 1 / 1.5 / 2 / 3 pages, always trims from original base
- AI language polish
- Re-score after edits

#### Mobile
- Downgraded pdfjs v5 → v4 for iOS 14+ compatibility
- 3-strategy worker fallback (local → CDN → main thread)
- Responsive layout fixes — score rings stack vertically on mobile
- Canvas PDF preview works on mobile Safari

#### Data & Settings
- Export all data — resumes, applications, token usage, exhausted models → JSON backup
- Import backup — merges by ID, date-aware token/exhausted restore, safe on multiple imports
- Gear icon one-time hint banner
- API key modal — connect, verify, change, remove Groq key
- Model selector — 4 models with daily limit info

#### Feedback
- In-app feedback form (Bug / Suggestion / Feature Request)
- Auto-captures: app version, page, device, browser, error log
- Submits silently to Google Sheets via Google Forms
- Global JS error capture (`window.onerror` + `unhandledrejection`)

#### AI / Groq
- 4 model options — Best Quality, High Capacity, Balanced, Basic
- Routine task routing — preserves user's quota for important tasks
- Rate limit handling — 429 fallback suggestions, 413 context-too-large handling
- qwen3-32b thinking token fixes — `/no_think` prefix, `<think>` stripping
- Anti-hallucination rules — skills only from original resume

#### Versioning
- `version` field in `package.json` (starts at `1.0.0`)
- Version exposed via Vite `define` → `__APP_VERSION__`
- Shown in gear modal next to Feedback section
- Included in every feedback submission and data export

