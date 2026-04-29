# Changelog

All notable changes to ResumeTailor are documented here.
Format: `Major.Minor.Patch` — bump policy:
- **Patch** — bug fixes, small UI tweaks
- **Minor** — new features, no breaking changes
- **Major** — breaking changes or major product pivots

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

