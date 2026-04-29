import { Document, Packer, Paragraph, TextRun, BorderStyle } from 'docx'

function makeDocxColors(template) {
  if (template === 'modern')  return { primary: '0f766e', accent: '0d9488', rule: '99f6e4', muted: '6b7280' }
  if (template === 'minimal') return { primary: '111827', accent: '374151', rule: 'd1d5db', muted: '9ca3af' }
  return                             { primary: '1e3a5f', accent: '2563eb', rule: 'bfdbfe', muted: '6b7280' }
}

function parseBoldRuns(text, fontSize = 20) {
  const parts = []
  const regex = /\*\*(.*?)\*\*/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(new TextRun({ text: text.slice(lastIndex, match.index), size: fontSize }))
    }
    parts.push(new TextRun({ text: match[1], bold: true, size: fontSize }))
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(new TextRun({ text: text.slice(lastIndex), size: fontSize }))
  }
  return parts.length > 0 ? parts : [new TextRun({ text: text || '', size: fontSize })]
}

function makeSectionHeader(title, colors) {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: colors.primary })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: colors.rule } },
  })
}

export async function generateDocxBlob(resumeData, template = 'classic') {
  const colors = makeDocxColors(template)
  const sectionHeader = (title) => makeSectionHeader(title, colors)
  const {
    name = '', email = '', phone = '', linkedin = '', location = '',
    summary = '', experience = [], skills = [], education = [],
    projects = [], certifications = [], customSections = [],
  } = resumeData

  const children = []

  // ── Name ──
  children.push(new Paragraph({
    children: [new TextRun({ text: name, bold: true, size: 36, color: colors.primary })],
    spacing: { after: 80 },
  }))

  // ── Contact ──
  const contactParts = [email, phone, linkedin, location].filter(Boolean)
  if (contactParts.length > 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  |  '), size: 18, color: '6b7280' })],
      spacing: { after: 160 },
    }))
  }

  // ── Summary ──
  if (summary?.trim()) {
    children.push(sectionHeader('Summary'))
    children.push(new Paragraph({
      children: parseBoldRuns(summary, 20),
      spacing: { after: 120 },
    }))
  }

  // ── Experience ──
  if (experience.length > 0) {
    children.push(sectionHeader('Experience'))
    for (const exp of experience) {
      const titleLine = [exp.title, exp.company].filter(Boolean).join(' — ')
      children.push(new Paragraph({
        children: [
          new TextRun({ text: titleLine, bold: true, size: 20 }),
          exp.dates ? new TextRun({ text: `  ${exp.dates}`, size: 18, color: '6b7280' }) : null,
        ].filter(Boolean),
        spacing: { before: 120, after: 40 },
      }))
      if (exp.location) {
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.location, size: 18, color: '6b7280', italics: true })],
          spacing: { after: 40 },
        }))
      }
      for (const bullet of (exp.bullets || [])) {
        if (!bullet?.trim()) continue
        children.push(new Paragraph({
          children: [new TextRun({ text: '\u2022  ', size: 20 }), ...parseBoldRuns(bullet, 20)],
          spacing: { after: 40 },
          indent: { left: 360 },
        }))
      }
    }
  }

  // ── Skills ──
  if (skills.length > 0) {
    children.push(sectionHeader('Skills'))
    children.push(new Paragraph({
      children: [new TextRun({ text: skills.join(', '), size: 20 })],
      spacing: { after: 120 },
    }))
  }

  // ── Education ──
  if (education.length > 0) {
    children.push(sectionHeader('Education'))
    for (const edu of education) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: [edu.degree, edu.school].filter(Boolean).join(', '), bold: true, size: 20 }),
          edu.dates ? new TextRun({ text: `  ${edu.dates}`, size: 18, color: '6b7280' }) : null,
        ].filter(Boolean),
        spacing: { before: 80, after: 80 },
      }))
    }
  }

  // ── Projects ──
  if (projects.length > 0) {
    children.push(sectionHeader('Projects'))
    for (const proj of projects) {
      const projTitle = [proj.name, proj.tech].filter(Boolean).join(' · ')
      children.push(new Paragraph({
        children: [new TextRun({ text: projTitle, bold: true, size: 20 })],
        spacing: { before: 100, after: 40 },
      }))
      if (proj.description?.trim()) {
        children.push(new Paragraph({
          children: parseBoldRuns(proj.description, 20),
          spacing: { after: 40 },
        }))
      }
      for (const bullet of (proj.bullets || [])) {
        if (!bullet?.trim()) continue
        children.push(new Paragraph({
          children: [new TextRun({ text: '\u2022  ', size: 20 }), ...parseBoldRuns(bullet, 20)],
          spacing: { after: 40 },
          indent: { left: 360 },
        }))
      }
    }
  }

  // ── Certifications ──
  if (certifications.length > 0) {
    children.push(sectionHeader('Certifications'))
    for (const cert of certifications) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: cert.name, bold: true, size: 20 }),
          cert.issuer ? new TextRun({ text: ` · ${cert.issuer}`, size: 18, color: '6b7280' }) : null,
          cert.date ? new TextRun({ text: `  ${cert.date}`, size: 18, color: '6b7280' }) : null,
        ].filter(Boolean),
        spacing: { before: 80, after: 80 },
      }))
    }
  }

  // ── Custom Sections ──
  for (const section of (customSections || [])) {
    if (!section.title?.trim()) continue
    children.push(sectionHeader(section.title))
    for (const item of (section.items || [])) {
      if (!item?.trim()) continue
      children.push(new Paragraph({
        children: [new TextRun({ text: '\u2022  ', size: 20 }), ...parseBoldRuns(item, 20)],
        spacing: { after: 40 },
        indent: { left: 360 },
      }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
      },
      children,
    }],
  })

  return await Packer.toBlob(doc)
}
