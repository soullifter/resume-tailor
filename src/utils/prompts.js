// ─────────────────────────────────────────────────────────────────────────────
// All AI prompts in one place.
// Each export is a function that returns { prompt, temperature, maxOutputTokens }
// so callers know exactly what settings to use.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Resume Health Score ────────────────────────────────────────────────────
const HEALTH_MODE_CONTEXT = {
  fresh_grad: 'Candidate is a fresh graduate. Do NOT require showsCareerProgression — it is expected to be false. Internships and student roles ARE valid experience. Short work history is normal and not a weakness.',
  senior:     'Candidate is senior/executive. Career progression, leadership signals, and high-impact bullets matter most.',
  gap:        'Candidate has an employment gap. Do NOT flag gaps between employment dates as negatives. Judge only what is present.',
  freelance:  'Candidate has freelance/contract history. Multiple short roles are contracts, not job-hopping. Do NOT flag contract stints as a concern.',
  switcher:   'Candidate is switching careers. Do NOT penalize for unrelated work history. Assess whether core resume mechanics (bullets, metrics, skills) are strong.',
  standard:   '',
}

export function healthScorePrompt(resumeText, userMode = 'standard') {
  const modeCtx = HEALTH_MODE_CONTEXT[userMode] || ''
  return {
    temperature: 0,
    maxOutputTokens: 1024,
    prompt: `You are a resume analyst. Extract precise factual observations from this resume.
Do NOT score it. Do NOT give opinions. Only answer what is factually present or absent.
${modeCtx ? `\nCANDIDATE CONTEXT (adjust your observations accordingly): ${modeCtx}\n` : ''}

RESUME:
${resumeText}

DEFINITIONS TO APPLY CONSISTENTLY:
- "weakVerb bullet": starts with "responsible for", "helped", "worked on", "assisted", "participated in", "involved in", "was part of"
- "metricBullet": contains at least one number, %, $, or clearly quantified result (e.g. "team of 8", "30% faster", "$2M revenue")
- "actionResult bullet": has both a strong action verb AND a stated outcome/result (e.g. "Built X which reduced Y by Z")
- "isTooGeneric" summary: mostly adjectives/buzzwords with no specific role or skill (e.g. "Passionate professional with strong communication skills seeking growth")
- "hasValueProposition": summary states what the candidate brings to an employer, not just who they are
- "hasSpecificSkills": includes real technical/domain skills, not only "communication", "teamwork", "Microsoft Office"
- "isOrganized" skills: grouped by category (e.g. Languages, Frameworks, Tools) rather than a flat unsorted list
- "showsCareerProgression": job titles or responsibilities clearly advance over time (e.g. junior → senior, IC → manager)
- "consistentFormatting": dates in same format throughout, consistent bullet punctuation, consistent capitalization

Category definitions — use ONLY these exact values:
avgBulletsPerRole  — "low": <2 per role | "fair": 2-3 | "good": 3-5 | "high": 5+
weakVerbRatio      — "none": 0% of bullets | "few": <20% | "some": 20-50% | "many": >50%
metricRatio        — "none": 0% | "low": <20% | "some": 20-50% | "good": 50-75% | "strong": >75%
actionResultRatio  — "none": 0% | "low": <20% | "some": 20-50% | "most": 50-80% | "all": >80%
wordCount          — "sparse": <250 words | "light": 250-400 | "good": 400-700 | "full": 700-900 | "long": >900
skillCount         — "too_few": <5 skills | "good": 5-25 | "too_many": >25
bulletLengthQuality — "too_short": most bullets under 8 words | "mixed": inconsistent | "good": one clear concise sentence each | "too_long": most bullets are 3+ lines
passiveVoice       — "none": 0 instances | "few": 1-2 | "many": 3+
fillerPhrases      — "none": 0 instances of "hardworking", "team player", "passionate about", "go-getter" etc. | "few": 1-2 | "many": 3+

Return ONLY this JSON, no markdown, no explanation:
{
  "contact": {
    "hasName": true/false,
    "hasEmail": true/false,
    "hasPhone": true/false,
    "hasLocation": true/false,
    "hasLinkedin": true/false,
    "hasPortfolioOrGithub": true/false
  },
  "summary": {
    "present": true/false,
    "hasSpecificRole": true/false,
    "hasValueProposition": true/false,
    "isTooGeneric": true/false,
    "appropriateLength": true/false
  },
  "experience": {
    "present": true/false,
    "allRolesHaveDates": true/false,
    "allRolesHaveTitle": true/false,
    "allRolesHaveCompany": true/false,
    "avgBulletsPerRole": "low" | "fair" | "good" | "high",
    "weakVerbRatio": "none" | "few" | "some" | "many",
    "metricRatio": "none" | "low" | "some" | "good" | "strong",
    "actionResultRatio": "none" | "low" | "some" | "most" | "all",
    "bulletLengthQuality": "too_short" | "mixed" | "good" | "too_long",
    "hasRepetitivePhrases": true/false,
    "showsCareerProgression": true/false
  },
  "skills": {
    "present": true/false,
    "hasSpecificSkills": true/false,
    "skillCount": "too_few" | "good" | "too_many",
    "isOrganized": true/false
  },
  "education": {
    "present": true/false,
    "isComplete": true/false,
    "hasRelevantExtras": true/false
  },
  "writing": {
    "passiveVoice": "none" | "few" | "many",
    "fillerPhrases": "none" | "few" | "many",
    "wordCount": "sparse" | "light" | "good" | "full" | "long",
    "consistentFormatting": true/false
  },
  "extraSections": [],
  "strengths": ["specific genuine strength — max 3"],
  "weaknesses": ["actionable fix as a clear instruction — max 3"],
  "verdict": "One honest sentence: biggest strength and biggest gap."
}

weaknesses format rules — each item must be a specific instruction telling the user exactly what to do:
GOOD: "Add a 2-3 sentence Professional Summary below your contact info describing your expertise and what you bring to employers"
GOOD: "Role 2 Bullet 3 starts with 'Responsible for' — rewrite it starting with a strong action verb like 'Led' or 'Built'"
GOOD: "Add your LinkedIn profile URL to the contact section at the top"
GOOD: "4 out of 6 bullets in Role 1 have no metrics — add numbers, percentages, or dollar amounts to show impact"
BAD (too vague): "Missing summary" / "Weak bullets" / "No LinkedIn" / "Improve formatting"`
  }
}

// ── 2. Job Description Parser ─────────────────────────────────────────────────
export function jdParsePrompt(jd, resumeText) {
  return {
    temperature: 0,
    maxOutputTokens: 1024,
    prompt: `You are analyzing a job description and a candidate's resume together.

JOB DESCRIPTION:
${jd.slice(0, 3000)}

CANDIDATE RESUME:
${resumeText ? resumeText.slice(0, 3000) : 'Not provided'}

TASK 1 — Extract structured info from the JD. Use null if not clearly stated.

TASK 2 — For each skill in mustHaveSkills and niceToHaveSkills, check if it appears in the resume.
Use semantic matching — handle typos, abbreviations, synonyms, and variations:
e.g. "React" matches "ReactJS", "ML" matches "Machine Learning", "JS" matches "JavaScript"
"inResume": true only if the skill or a clear equivalent is genuinely present in the resume.

TASK 3 — Assess JD quality:
isInsufficient = true if: text is too short (<80 words), just a job title with no details, random/unrelated text, or has no requirements or responsibilities.

Return ONLY this JSON, no markdown:
{
  "title": "exact job title or null",
  "company": "company name or null",
  "seniority": "Internship | Entry | Mid | Senior | Lead | Director — pick closest or null",
  "location": "city/country or Remote or Hybrid or null",
  "salary": "salary range as stated or null",
  "whatThisRoleWants": "one sentence: the core thing this role is looking for in a candidate",
  "mustHaveSkills": [
    { "skill": "skill name", "inResume": true/false, "note": "how it appears in resume or null" }
  ],
  "niceToHaveSkills": [
    { "skill": "skill name", "inResume": true/false, "note": "how it appears in resume or null" }
  ],
  "experienceYearsRequired": "e.g. 3+ years or null",
  "overallMatch": "strong | moderate | weak",
  "reachLevel": "good_fit | stretch | reach",
  "isInsufficient": true/false
}`
  }
}

// ── 3. Resume ↔ JD Analysis ───────────────────────────────────────────────────
// Mode-specific analysis rules (separate from generation instructions)
const ANALYSIS_MODE_RULES = {
  fresh_grad: 'Candidate is a fresh graduate. worthApplying should be more lenient — treat internships and strong projects as relevant experience. Do NOT require years of full-time experience when determining "hardGaps". Career progression is NOT expected.',
  senior:     'Candidate is senior/executive. worthApplying "yes" requires leadership/strategy alignment, not just skill match. hardGaps should flag missing executive-level scope or P&L/org leadership if the role demands it.',
  gap:        'Candidate has an employment gap. Do NOT list the employment gap itself as a hardGap. Focus on skill and experience fit only.',
  freelance:  'Candidate has freelance/contract history. Do NOT flag multiple employers or contract stints as a concern. Evaluate cumulative expertise across contracts.',
  switcher:   'Candidate is switching careers. Be honest about the switch but evaluate transferable skills fairly. worthApplying "borderline" is appropriate when transferable skills are strong even if direct experience is limited.',
  standard:   '',
}

export function analysisPrompt(resumeText, jobDescription, userMode, jobInfo, healthScore) {
  const modeNote = ANALYSIS_MODE_RULES[userMode] || ''

  const knownPresent = jobInfo?.mustHaveSkills?.filter(s => s.inResume).map(s => s.skill) || []
  const knownMissing = jobInfo?.mustHaveSkills?.filter(s => !s.inResume).map(s => s.skill) || []

  const jdContext = jobInfo ? `

PRIOR JD ANALYSIS (already completed — use this, do not re-derive):
- Role: ${[jobInfo.title, jobInfo.seniority, jobInfo.company].filter(Boolean).join(' · ')}
- Experience required: ${jobInfo.experienceYearsRequired || 'not specified'}
- What this role wants: ${jobInfo.whatThisRoleWants || 'not available'}
- Must-have skills already in resume: ${knownPresent.join(', ') || 'none identified'}
- Must-have skills MISSING from resume: ${knownMissing.join(', ') || 'none identified'}
- Initial fit: ${jobInfo.overallMatch || 'unknown'} match · reach level: ${jobInfo.reachLevel || 'unknown'}` : ''

  const healthContext = (healthScore !== null && healthScore !== undefined)
    ? `\nRESUME QUALITY SCORE: ${healthScore}/100${healthScore < 50 ? ' — resume quality is low, factor this into competitiveness' : ''}`
    : ''

  return {
    temperature: 0,
    maxOutputTokens: 2048,
    prompt: `You are an experienced career advisor and hiring manager. Give an honest, complete picture of this candidate's fit for this specific role.
${modeNote ? `\nCANDIDATE CONTEXT (adjust worthApplying, hardGaps, and scoring accordingly): ${modeNote}` : ''}${jdContext}${healthContext}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

RULES:
- Be honest, not just encouraging. If this is a reach, say so.
- worthApplying "yes": genuinely competitive, most key requirements met.
- worthApplying "borderline": gaps exist but resume tailoring helps significantly — worth applying with clear expectations.
- worthApplying "no": major gaps that rewriting cannot fix (wrong experience level, missing 3+ critical skills with no transferable equivalent, completely different field).
- strengths: specific things from the actual resume that this role values — not generic praise.
- fixableGaps: gaps the resume rewrite itself CAN fix — only things the generated document will actually change (keyword absent but experience exists, weak framing, no targeted summary, missing skill already in their background). Do NOT mention cover letters, interviews, or anything outside the resume.
- hardGaps: genuine skill/experience gaps the resume CANNOT fix. For each, say what it would realistically take to close.
- applicationTip: one specific coaching tip for OUTSIDE the resume — what to lead with in a cover letter, what to address proactively in an interview, or what to research before applying.
- priorityActions: the top 3 highest-impact changes for the rewrite — these are highlights, not the complete list. The full rewrite will improve the entire resume.

Return ONLY this JSON, no markdown:
{
  "matchScore": <0-100>,
  "worthApplying": "yes | borderline | no",
  "worthApplyingReason": "One honest sentence explaining the verdict",
  "summary": "2-3 honest sentences — overall fit, biggest strength, biggest gap",
  "strengths": [
    { "strength": "specific thing from their resume", "why": "why it matters for this role" }
  ],
  "fixableGaps": [
    { "gap": "specific gap", "fix": "how the resume rewrite will address this" }
  ],
  "hardGaps": [
    { "gap": "genuine skill or experience gap", "toClose": "what it would realistically take to close this" }
  ],
  "applicationTip": "One specific coaching tip beyond the resume",
  "presentKeywords": ["JD keywords clearly in resume"],
  "partialKeywords": ["concepts present but phrasing differs"],
  "missingKeywords": ["important JD keywords completely absent"],
  "priorityActions": [
    "Specific action 1 referencing actual resume content",
    "Specific action 2",
    "Specific action 3"
  ]
}

Match score guide:
75-100 → Strong match, most key requirements clearly met
50-74  → Moderate match, several gaps but transferable experience
0-49   → Weak match, major gaps in required skills or experience level`
  }
}

// ── 4. Resume Generation ──────────────────────────────────────────────────────
const MODE_INSTRUCTIONS = {
  fresh_grad: `Candidate is a fresh graduate.
- Place Education section prominently — right after Summary or even first if it is their strongest credential.
- Elevate Projects section: treat strong academic or personal projects as primary experience evidence.
- Frame all internships as real professional deliverables — not "just an internship". Lead with outcomes and impact.
- Do NOT add a "Years of experience" qualifier or apologize for short history.
- In the summary, lead with academic background + key skills + what they bring, not work history.
- Use "Expected [Year]" for degrees not yet complete.`,

  switcher: `Candidate is switching careers.
- Map transferable skills aggressively into the target field's language in every bullet and the summary.
- Frame the non-linear background as depth and breadth, not a liability.
- In the summary, explicitly bridge old domain to new: "X years in [old field] now applying [transferable skill] to [new field]".
- Prioritize skills and projects relevant to the target role over unrelated titles.
- Reframe job titles in context where appropriate (e.g. "Operations Lead" in a finance background applying to PM roles → frame ops ownership as cross-functional leadership).`,

  gap: `Candidate has an employment gap.
- Do NOT highlight the gap or call attention to it with language like "seeking to return".
- If a gap period contains freelance work, caregiving, upskilling, or personal projects — frame these briefly and professionally.
- If the gap must appear in dates, label it "Career Break" — nothing more.
- In the summary, focus entirely on what the candidate brings today — skills, expertise, results — not the timeline.
- Keep the tone confident and present-tense: what they are, not what they were.`,

  senior: `Candidate is senior or executive level.
- Open with an executive summary: 2-3 sentences on strategic value, leadership scope, and business impact.
- Every bullet should reflect scale: teams led, budgets owned, revenue influenced, organizational transformation.
- Compress early-career roles (>8 years ago) to 1-2 bullets or a single line if they add no differentiated value.
- Amplify leadership, cross-functional influence, board/C-suite exposure, and strategic decision-making throughout.
- Skills section should lead with domain/industry expertise and leadership competencies before tools.`,

  freelance: `Candidate has freelance or independent contractor history.
- Group similar contracts under a single umbrella entry titled "Independent Consultant" or "Freelance [Specialty]" with a date range covering the full period.
- Under the umbrella, list 2-3 key clients or project types as sub-bullets, not separate roles.
- Bullets should highlight cumulative client impact: "Delivered [X] across [N] clients", "Managed [Y] in engagements totalling [Z]".
- Do NOT treat separate contracts as job-hopping — present it as a deliberate consulting practice.
- In the summary, position them as a specialist with proven client-facing delivery, not as someone between jobs.`,

  standard: '',
}

export function generationPrompt(resumeText, jobDescription, analysis, userMode, jobInfo, customInstructions = '') {
  const modeNote = MODE_INSTRUCTIONS[userMode] || ''

  const missingRequired = jobInfo?.mustHaveSkills?.filter(s => !s.inResume).map(s => s.skill) || []

  const strengthsText = analysis.strengths?.length
    ? analysis.strengths.map(s => `  • ${s.strength} — ${s.why}`).join('\n')
    : '  (none identified)'

  const fixableText = analysis.fixableGaps?.length
    ? analysis.fixableGaps.map(g => `  • ${g.gap} → ${g.fix}`).join('\n')
    : '  (none identified)'

  const hardGapsText = analysis.hardGaps?.length
    ? analysis.hardGaps.map(g => `  • ${g.gap}`).join('\n')
    : '  (none)'

  return {
    temperature: 0.35,
    maxOutputTokens: 5000,
    prompt: `You are an expert professional resume writer and ATS specialist. Produce the strongest possible tailored version of this resume — one that passes ATS filters AND compels a human recruiter to call.
${modeNote ? `\n══ CANDIDATE MODE — follow these instructions throughout the entire rewrite ══\n${modeNote}` : ''}
${customInstructions?.trim() ? `\n══ USER INSTRUCTIONS — follow these specifically, they override defaults ══\n${customInstructions.trim()}\n` : ''}
══ ROLE INTELLIGENCE (use throughout) ══
What this role fundamentally wants: ${jobInfo?.whatThisRoleWants || 'see JD below'}
Seniority level: ${jobInfo?.seniority || 'Mid'}
Missing required skills to weave in (only where genuinely applicable to candidate's real work):
  ${missingRequired.length ? missingRequired.join(', ') : 'none'}
Other missing keywords: ${analysis.missingKeywords?.filter(k => !missingRequired.includes(k)).join(', ') || 'none'}

══ CANDIDATE STRENGTHS — amplify these throughout ══
${strengthsText}

══ SPECIFIC FIXES TO APPLY ══
${fixableText}

══ DO NOT FABRICATE — genuine gaps, do not fake these ══
${hardGapsText}

══ ORIGINAL RESUME ══
${resumeText}

══ JOB DESCRIPTION ══
${jobDescription}

══ REWRITING RULES ══

SUMMARY:
- 2-3 sentences that directly address what this role fundamentally wants
- Lead with the candidate's strongest relevant quality from the strengths above
- Naturally embed 2-3 key JD terms (ATS-friendly)
- Match the seniority tone
- NEVER mention the company name or employer being applied to — keep it general and transferable

EXPERIENCE:
- Rewrite EVERY bullet — no bullet should be left in its original weak form
- Reorder bullets within each role: most JD-relevant bullet goes first
- Every bullet format: strong past-tense action verb + specific outcome + metric
- Wrap key metrics, numbers, percentages, and dollar amounts in **double asterisks** — e.g. **40%**, **$2M revenue**, **3x faster** — so they render bold in the PDF
- Preserve ALL existing numbers/metrics/percentages exactly as they appear in the original
- Use [X] as placeholder only where a metric is clearly implied but genuinely missing
- Use JD language/terminology only where it authentically describes what the candidate actually did
- NEVER add a tool, technology, or skill into a bullet that does not appear in the original resume — not even as an inference or related skill
- You may use JD phrasing/terminology for skills that ARE already in the resume — do NOT add skills that are not in the original resume

SKILLS:
- ONLY include skills explicitly present in the candidate's original resume — do NOT add skills from the JD that aren't already there, not even inferred or related ones (e.g. if resume has Docker but not Kubernetes, do NOT add Kubernetes)
- Order: JD-matching skills first → other resume skills → remove only skills with zero relevance to this JD
- Keep all relevant technical, domain, and tool skills that are in the original resume

PRESERVE ALL RELEVANT SECTIONS:
- Keep projects, certifications, awards, publications, languages, volunteer work if they add value for this role
- Strengthen project and certification content if relevant to the JD
- Only omit content with zero relevance to this role
- NEVER invent new jobs, companies, dates, certifications, degrees, or achievements

Return ONLY this JSON, no markdown, no extra text:
{
  "name": "Full Name",
  "email": "email",
  "phone": "phone",
  "location": "City, Country",
  "linkedin": "linkedin url or empty string",
  "github": "github url or empty string",
  "portfolio": "portfolio url or empty string",
  "summary": "2-3 sentence tailored professional summary",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "dates": "Mon YYYY – Mon YYYY or Present",
      "bullets": ["Strong bullet with action verb, outcome, and metric", "..."]
    }
  ],
  "skills": ["most JD-relevant first", "..."],
  "projects": [
    {
      "name": "Project Name",
      "description": "one-line description",
      "technologies": ["tech1", "tech2"],
      "bullets": ["impact-focused bullet"],
      "url": "url or empty string"
    }
  ],
  "certifications": [
    { "name": "Certification Name", "issuer": "Issuing Body", "date": "Mon YYYY or YYYY" }
  ],
  "education": [
    { "degree": "Degree Name", "school": "School Name", "dates": "YYYY or YYYY–YYYY" }
  ],
  "extraSections": [
    { "title": "Section Title", "items": ["item 1", "item 2"] }
  ],
  "changes": {
    "summaryRewrite": "one sentence describing what changed in the summary and why",
    "keywordsAdded": ["keyword or skill woven in that wasn't prominent before"],
    "bulletImprovements": ["Company name: what was improved across their bullets — e.g. added metrics, stronger verbs, reframed outcomes"],
    "skillsChange": "one sentence on what changed in skills — reordering, additions, removals"
  }
}

Rules for optional fields:
- projects: include only if present in original resume; empty array [] if none
- certifications: include only if present in original resume; empty array [] if none
- extraSections: use for awards, publications, languages, volunteer work, honors — only if present and relevant; empty array [] if none
- github/portfolio: include only if present in original resume; empty string if absent
- changes.keywordsAdded: list only genuinely new keywords woven in, max 8
- changes.bulletImprovements: one entry per role that had significant changes, max 5`
  }
}

// ── 5. ATS Score (numeric only) ───────────────────────────────────────────────
const SCORE_MODE_RULES = {
  fresh_grad: 'Candidate is a fresh graduate. Count internships AND academic/personal projects as valid experience — not just full-time jobs. Weight skills section and projects more heavily when evaluating keyword presence.',
  senior:     'Candidate is senior/executive. Weight leadership, strategy, cross-functional, and org-level keywords at 1.5x when scoring.',
  gap:        '',
  freelance:  'Candidate has freelance/contract history. Count contract roles under any grouping as valid experience.',
  switcher:   'Candidate is switching careers. Give partial credit where transferable skills clearly map to a required skill, even if the exact keyword differs.',
  standard:   '',
}

export function scorePrompt(resumeText, jobDescription, userMode = 'standard') {
  const modeRule = SCORE_MODE_RULES[userMode] || ''
  return {
    temperature: 0,
    maxOutputTokens: 2048,
    prompt: `/no_think
ATS resume scanner. Score how well the resume matches the job description.

Rules:
- Required skills/tools found in experience bullets: full credit
- Found in skills section only: half credit
- Absent: no credit
- Required keywords weight 3x preferred keywords
- Normalize to 0-100
${modeRule ? `\nADJUSTMENT FOR THIS CANDIDATE: ${modeRule}\n` : ''}
RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Reply with a single integer 0-100. No words, no explanation. Just the number.`
  }
}

// ── 6. Resume Quality Analysis ────────────────────────────────────────────────
const QUALITY_MODE_RULES = {
  fresh_grad: 'Candidate is a fresh graduate. Do NOT flag short work history, missing career progression, or absence of senior-level metrics. Internships and student projects are valid experience — do not flag them as insufficient.',
  senior:     '',
  gap:        'Candidate has an employment gap. Do NOT flag gaps in employment dates as issues or blockers.',
  freelance:  'Candidate has freelance/contract history. Do NOT flag multiple short stints, many employers, or gaps between contracts as issues.',
  switcher:   'Candidate is switching careers. Do NOT flag unrelated work history or a non-linear career path as issues.',
  standard:   '',
}

export function qualityPrompt(resumeData, userMode = 'standard') {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const modeRule = QUALITY_MODE_RULES[userMode] || ''
  return {
    temperature: 0,
    maxOutputTokens: 2048,
    prompt: `You are a senior resume editor doing a final pre-submission quality check.

Today's date: ${today}. Use this for date evaluation — do NOT flag past dates as errors.
${modeRule ? `\nCANDIDATE CONTEXT (skip flagging issues that don't apply): ${modeRule}\n` : ''}

RESUME:
${JSON.stringify(resumeData)}

DETECTION RULES:

1. PLACEHOLDER: Flag any bullet, summary, or field containing literal "[X]" — unfilled metric placeholders that MUST be filled before submitting. Critical blocker.

2. QUANTIFICATION: Flag bullets where a specific number clearly could exist but is missing (e.g. "Led a team", "Managed a budget", "Improved performance by a significant amount"). Suggest what kind of number to add. Do NOT flag bullets that already have numbers.

CONTACT COMPLETENESS — check in submitCheck blockers if missing:
- Email address
- Phone number

Return ONLY this JSON, no markdown:
{
  "issues": [
    {
      "type": "placeholder | quantification",
      "location": "Job Title at Company · Bullet N  (or  Summary  or  Contact)",
      "before": "exact original text",
      "suggestion": "for quantification: what number/metric to add. for placeholder: 'Fill in this [X] with your actual number.'"
    }
  ],
  "submitCheck": {
    "score": <integer 0-100. 90-100 = ready; 75-89 = minor issues; 50-74 = needs work; below 50 = not ready. Unfilled placeholders or missing contact info should bring score well below 75.>,
    "blockers": ["critical issue — placeholder unfilled, missing contact info"],
    "warnings": ["minor issue worth addressing"],
    "positives": ["genuine strength of this resume"],
    "verdict": "One honest sentence: is this ready to submit or what needs to happen first?"
  }
}`
  }
}

// ── 7. Length Trimmer ─────────────────────────────────────────────────────────
export function countResumeWords(resumeData) {
  let words = 0
  function traverse(val) {
    if (typeof val === 'string') words += val.trim().split(/\s+/).filter(Boolean).length
    else if (Array.isArray(val)) val.forEach(traverse)
    else if (val && typeof val === 'object') Object.values(val).forEach(traverse)
  }
  traverse(resumeData)
  return words
}

export function trimPrompt(resumeData, targetPages, currentPages = null, currentWords = null, wordsPerPage = null, attempt = 1, totalAttempts = 3) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const attemptContext = `This is attempt ${attempt} of ${totalAttempts}.`
  const overflowWords = wordsPerPage && wordsPerPage.length > targetPages
    ? wordsPerPage.slice(targetPages).reduce((a, b) => a + b, 0)
    : null
  const statsContext = [
    currentPages ? `Currently ${currentPages} page${currentPages !== 1 ? 's' : ''}` : null,
    currentWords ? `~${currentWords} words total` : null,
    overflowWords ? `~${overflowWords} words overflowing onto the extra page — that is exactly how much you need to eliminate` : null,
  ].filter(Boolean).join('. ')
  const bulletLimit = attempt === 1 ? 35 : attempt === 2 ? 28 : 20
  const aggression = attempt === 1
    ? 'Make conservative cuts — more passes follow. Remove only the clearest low-value content.'
    : attempt === totalAttempts
    ? 'This is the FINAL pass — be as aggressive as needed to hit the target.'
    : 'Make moderate cuts. One more pass remains if needed.'

  return {
    temperature: 0,
    maxOutputTokens: 5000,
    prompt: `Today's date: ${today}. You are a professional resume editor.
${attemptContext} ${statsContext ? statsContext + '.' : ''} Target: ${targetPages} page${targetPages !== 1 ? 's' : ''}.
${aggression}

STRATEGY: Keep all sections. Reduce bullets within roles rather than removing whole roles. Only remove a role or section if it adds zero unique value.

REMOVAL PRIORITY — apply in order:

STEP 1 — Remove duplicate bullets (same idea repeated in same or different role).

STEP 2 — Remove weak bullets with no metrics: "Assisted", "Helped", "Worked on", "Participated in", "Supported".

STEP 3 — Reduce bullet count per role:
  - 2 most recent roles: keep 2-3 strongest bullets each.
  - Older roles (>3 years): keep 1-2 strongest bullets each.
  - Only remove a role entirely if it has no unique metrics and all its content is already covered by other roles.

STEP 4 — Trim skills: keep top 15 most technical/domain-specific. Remove soft skills and generic tools ("Communication", "Microsoft Office", "Problem-Solving", "Stakeholder Management").

STEP 5 — Trim summary to 2 tight sentences.

STEP 6 — Projects: keep 1 bullet per project. Remove a project only if it adds no technical value.

STEP 7 — Remove extra sections (Leadership, Activities, Event Organization) only if still over limit.

STEP 8 — Last resort: shorten bullets to max ${bulletLimit} words, keeping metric + outcome.

NEVER DO:
- Never remove contact info or education.
- Never remove the skills section entirely.
- Never invent or alter facts — only remove or tighten.
- Never remove both of the 2 most recent roles.

RESUME:
${JSON.stringify(resumeData)}

Return ONLY the trimmed resume in the exact same JSON structure, no markdown.`
  }
}

// ── 8. Language Polish ────────────────────────────────────────────────────────
export function polishPrompt(resumeData) {
  return {
    temperature: 0.2,
    maxOutputTokens: 5000,
    prompt: `You are a senior resume editor doing a full language polish pass. Your goal is crisp, professional, impactful resume language throughout.

WHAT TO FIX — apply every rule below:

1. WEAK VERBS → Strong action verbs
   - Replace weak openers: "Responsible for" → Led/Owned, "Helped" → Supported/Enabled, "Worked on" → Built/Developed, "Was involved in" → Contributed to, "Assisted" → Partnered/Facilitated
   - Use strong verbs: Led, Built, Drove, Architected, Delivered, Designed, Launched, Reduced, Increased, Automated, Spearheaded, Streamlined, Optimized, Managed, Established

2. PASSIVE VOICE → Active voice
   - "Was implemented by the team" → "Implemented by leading the team"
   - "Were reduced through" → "Reduced X through"
   - Convert all passive constructions to active, subject-first sentences

3. FILLER PHRASES → Remove or rephrase
   - Cut: "hardworking", "team player", "passionate about", "go-getter", "results-driven", "detail-oriented", "self-starter", "strong communication skills", "fast learner"
   - Replace with specific evidence if possible, or remove entirely

4. BULLET STRUCTURE → Action + What + Result
   - Each bullet should follow: [Strong verb] + [what you did] + [outcome/impact if present]
   - Tighten wordy bullets to one clean sentence. Do not pad short bullets.

5. REDUNDANT OPENERS → Vary them
   - If 3+ consecutive bullets in a role start with the same verb, vary at least one with a synonym

6. SUMMARY POLISH
   - No first-person pronouns ("I", "my", "me") — omit subject entirely
   - Should be value-proposition focused: what the candidate brings, not just who they are
   - Remove pure adjective phrases with no evidence ("dynamic professional", "passionate engineer")
   - Max 3 sentences, tight and specific

7. CONSISTENCY
   - Date formats consistent throughout (e.g. all "Jan 2022 – Mar 2024" or all "2022 – 2024")
   - Bullet punctuation consistent — either all end with periods or none do
   - Tool/technology names correctly capitalized (JavaScript not javascript, AWS not aws, React not react)

ABSOLUTE LIMITS — violating any is a failure:
- Do NOT add new facts, skills, companies, titles, or any information not already in the resume
- Do NOT remove any existing information (bullets, roles, sections)
- Do NOT change proper nouns, numbers, percentages, dates, or metrics
- Do NOT change anything that is already clean and correct — leave it exactly as-is

RESUME:
${JSON.stringify(resumeData)}

Return ONLY the polished resume in the exact same JSON structure, no markdown.`
  }
}

// ── 9. Bullet Rewrite ─────────────────────────────────────────────────────────
export function bulletRewritePrompt(bullet, title, company, jobDescription) {
  return {
    temperature: 0.3,
    maxOutputTokens: 200,
    prompt: `Rewrite this resume bullet to be stronger, more impact-focused, and more relevant to the target job.

CANDIDATE ROLE: ${title} at ${company}
ORIGINAL BULLET: ${bullet}
${jobDescription ? `\nTARGET JD (for context — weave in relevant keywords naturally if they genuinely apply):\n${jobDescription.slice(0, 1500)}` : ''}

RULES:
- Start with a strong past-tense action verb (never "Responsible for", "Helped", "Worked on", "Assisted").
- Keep it to one concise line — no run-ons.
- Preserve ALL facts, numbers, percentages, company names, and technologies exactly as given.
- Wrap key metrics, numbers, percentages, and dollar amounts in **double asterisks** — e.g. **40%**, **$2M**, **3x faster**.
- If a metric is clearly implied but missing, add [X] as a placeholder (e.g. "reduced load time by [X]%").
- If a JD keyword genuinely describes what this bullet is about, use that language — do not force keywords that don't fit.
- Do NOT invent new achievements, tools, or outcomes not in the original.
- Return ONLY the rewritten bullet — no quotes, no explanation, no label.`
  }
}

// ── 10. Follow-up Email ───────────────────────────────────────────────────────
export function followUpEmailPrompt(app) {
  const days = Math.floor((Date.now() - new Date(app.dateApplied).getTime()) / 86400000)
  const toneGuide =
    days <= 14 ? 'Light, polite check-in. Keep it brief — 3 sentences max. No pressure, just visibility.' :
    days <= 21 ? 'Direct but warm inquiry. 3-4 sentences. Acknowledge the wait, restate fit, ask clearly about timeline.' :
                 'Reconfirm strong interest. 4-5 sentences. Mention something specific about the company or role that still excites you. Ask if the role is still active.'

  const stageContext = app.stage && app.stage !== 'Applied'
    ? `Current stage: ${app.stage} — tailor the email to reflect this stage, not just initial application.`
    : 'Stage: Applied — this is a first follow-up after submitting application.'

  return {
    temperature: 0.4,
    maxOutputTokens: 512,
    prompt: `Write a professional follow-up email for a job application.

CANDIDATE: ${app.candidateName || 'the candidate'}
COMPANY: ${app.company}
ROLE: ${app.role}
DAYS SINCE APPLYING: ${days}
${stageContext}

TONE GUIDE FOR THIS EMAIL: ${toneGuide}

RULES:
- Open with something specific — reference the role, the company, or a genuine reason for interest. Never open with "Just following up", "I wanted to check in", "I hope this email finds you well", or "I am writing to".
- Refer to the role by its exact name.
- Be confident, not apologetic or desperate — you are a strong candidate checking in, not begging.
- End with a single low-pressure ask: timeline, next steps, or whether the role is still active.
- No clichés: no "passionate about", "great opportunity", "please find attached", "I believe I would be a great fit".
- Subject line: specific and professional — e.g. "Following up — [Role] at [Company]" or similar, not generic.

Return ONLY this JSON, no markdown:
{
  "subject": "specific subject line referencing role and company",
  "body": "email body — no salutation, no sign-off, just the 3-5 sentence body"
}`
  }
}

// ── 11. Cover Letter ──────────────────────────────────────────────────────────
export function coverLetterPrompt(resumeData, jobDescription) {
  const topAchievements = resumeData.experience
    ?.flatMap(e => (e.bullets || []).map(b => `${e.title} at ${e.company}: ${b}`))
    .filter(b => /\d|%|\$/.test(b))
    .slice(0, 5)
    .join('\n') || resumeData.experience
    ?.flatMap(e => (e.bullets || []).slice(0, 2).map(b => `${e.title} at ${e.company}: ${b}`))
    .slice(0, 4)
    .join('\n') || ''

  return {
    temperature: 0.5,
    maxOutputTokens: 1500,
    prompt: `Write a tailored, compelling cover letter for this job application.

CANDIDATE:
Name: ${resumeData.name}
Current/Recent role: ${resumeData.experience?.[0]?.title} at ${resumeData.experience?.[0]?.company}
Summary: ${resumeData.summary}
Key skills: ${resumeData.skills?.slice(0, 10).join(', ')}

TOP ACHIEVEMENTS (use 2-3 of these — pick the most relevant to the JD):
${topAchievements}

JOB DESCRIPTION:
${jobDescription.slice(0, 2500)}

STRUCTURE — exactly 3 paragraphs:

PARAGRAPH 1 — Hook + Why this role + Why this company:
- Do NOT open with "I am writing to apply", "I am excited to apply", "My name is", or "Please find attached".
- Open with a specific, confident statement about what you bring OR what drew you to this company.
- Name the exact role. Reference something specific about the company or role from the JD — not generic praise.
- 2-3 sentences max.

PARAGRAPH 2 — Evidence (the strongest part):
- Connect 2-3 specific achievements to specific requirements from the JD.
- Use real numbers and outcomes from the achievements above.
- Mirror the JD's language naturally — if the JD says "cross-functional collaboration", use that framing.
- Do NOT say "as you can see in my resume", "my resume shows", or "I have attached my resume".
- 3-5 sentences.

PARAGRAPH 3 — Closing:
- Restate fit in one sentence.
- Confident, forward-looking call to action — not "I hope to hear from you" or "Thank you for your consideration".
- Express genuine enthusiasm without being sycophantic.
- 2-3 sentences.

ABSOLUTE RULES:
- Professional but human — not stiff, robotic, or template-sounding.
- No clichés: "passionate about", "team player", "hardworking", "great opportunity", "perfect fit", "goes above and beyond".
- Do NOT use placeholder text like [Company Name] — infer the company name from the JD.
- No salutation, no sign-off — body paragraphs only.
- Return ONLY the cover letter text, no JSON, no labels, no headers.`
  }
}

// ── 12. Interview Questions ───────────────────────────────────────────────────
export function interviewQuestionsPrompt(resumeData, jobDescription) {
  const experienceContext = resumeData.experience
    ?.slice(0, 4)
    .map(e => {
      const bullets = (e.bullets || []).slice(0, 3).map(b => `    • ${b}`).join('\n')
      return `  ${e.title} at ${e.company} (${e.dates})\n${bullets}`
    })
    .join('\n') || ''

  return {
    temperature: 0.4,
    maxOutputTokens: 3000,
    prompt: `You are a senior hiring manager conducting a real interview. Generate the 10 most likely and most important interview questions for this specific candidate applying to this specific role.

CANDIDATE SUMMARY: ${resumeData.summary}
CANDIDATE SKILLS: ${resumeData.skills?.join(', ')}

CANDIDATE EXPERIENCE:
${experienceContext}

JOB DESCRIPTION:
${jobDescription.slice(0, 2500)}

QUESTION MIX — generate exactly this distribution:
- 3 behavioral (STAR format) — based on specific requirements in the JD
- 2 technical/skills-based — probe the must-have skills from the JD
- 2 role-specific scenario — "how would you handle X" situations drawn from the JD responsibilities
- 1 culture/motivation — why this company, why this role
- 1 tough/gap question — probe a genuine weakness, gap, or challenge visible in their background
- 1 closing — "do you have any questions for us" style, but reframed as a coaching moment

For each question:
- "tip": specific, actionable guidance — reference the candidate's actual experience where relevant (e.g. "Use your X% achievement at Company Y as the example"). For behavioral questions, remind them to use STAR (Situation, Task, Action, Result).
- "whatToAvoid": the single most common mistake candidates make on this specific question type.
- "difficulty": how hard this question typically is for candidates — "easy", "medium", or "hard".

Return ONLY this JSON array, no markdown:
[
  {
    "question": "question text",
    "type": "behavioral | technical | scenario | motivation | tough | closing",
    "difficulty": "easy | medium | hard",
    "tip": "specific actionable tip — reference their actual resume content where possible",
    "whatToAvoid": "the most common mistake on this question"
  }
]
— exactly 10 items.`
  }
}

// ── 13. LinkedIn About ────────────────────────────────────────────────────────
export function linkedinAboutPrompt(resumeData, jobDescription) {
  const topAchievements = resumeData.experience
    ?.flatMap(e => (e.bullets || []).map(b => `• ${b}`))
    .filter(b => /\d|%|\$/.test(b))
    .slice(0, 5)
    .join('\n') || resumeData.experience
    ?.flatMap(e => (e.bullets || []).slice(0, 2).map(b => `• ${b}`))
    .slice(0, 4)
    .join('\n') || ''

  return {
    temperature: 0.5,
    maxOutputTokens: 1024,
    prompt: `Write an optimized LinkedIn "About" section for this professional.

CANDIDATE:
Name: ${resumeData.name}
Current/Recent role: ${resumeData.experience?.[0]?.title} at ${resumeData.experience?.[0]?.company}
Summary: ${resumeData.summary}
Key skills: ${resumeData.skills?.slice(0, 12).join(', ')}

TOP ACHIEVEMENTS (pick 2-3 of the most impressive to weave in naturally):
${topAchievements}

TARGET ROLE TYPE: infer from this JD: ${jobDescription.slice(0, 1000)}

STRUCTURE — 4 short paragraphs, max 2500 characters total (LinkedIn's limit is 2600):

PARAGRAPH 1 — Hook (2-3 sentences):
- Do NOT start with "I am a [title]", "My name is", or "I have X years of experience".
- Open with what drives you, what problem you solve, or a bold statement about your impact.
- Make it human and specific — not a generic "passionate professional".

PARAGRAPH 2 — Expertise & value (3-4 sentences):
- What you do and what makes you effective at it.
- Mention 2-3 core skill areas naturally.
- Naturally embed keywords relevant to the target role — LinkedIn search ranks profiles by keyword presence.

PARAGRAPH 3 — Proof (2-3 sentences):
- Weave in 2-3 real achievements with numbers from the list above.
- Write in narrative form — not bullet points, not resume language.
- Show scope, scale, or impact concretely.

PARAGRAPH 4 — Closing / intent (2 sentences):
- What you're focused on next or open to — frame as forward-looking, not desperate.
- Use "open to" language if actively looking; use "focused on" if passive.
- End with something that invites connection or conversation.

TONE RULES:
- First person throughout ("I", "my", "me") — LinkedIn is personal, not a resume.
- Conversational but professional — warmer than a resume, not informal.
- No clichés: "passionate", "results-driven", "dynamic", "team player", "hardworking", "go-getter".
- No hashtags, no emoji, no bullet points.
- Return ONLY the About text — no labels, no JSON, no headers.`
  }
}
