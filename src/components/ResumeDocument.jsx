import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

function makeColors(t) {
  if (t === 'modern')  return { primary: '#0f766e', accent: '#0d9488', text: '#111827', muted: '#6b7280', rule: '#99f6e4',  link: '#0d9488' }
  if (t === 'minimal') return { primary: '#111827', accent: '#374151', text: '#111827', muted: '#9ca3af', rule: '#d1d5db',  link: '#374151' }
  return                      { primary: '#1e3a5f', accent: '#2563eb', text: '#111827', muted: '#6b7280', rule: '#bfdbfe',  link: '#2563eb' }
}

function makeStyles(t, c) {
  const isModern = t === 'modern'

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: c.text,
      paddingTop: 36,
      paddingBottom: 40,
      paddingHorizontal: 46,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      marginBottom: 12,
      paddingBottom: 9,
      borderBottomWidth: t === 'minimal' ? 1 : 2,
      borderBottomColor: c.primary,
    },
    name: {
      fontSize: 22,
      fontFamily: 'Helvetica-Bold',
      color: c.primary,
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    contactText: { fontSize: 8.5, color: c.muted,  marginRight: 0, marginBottom: 2 },
    contactLink: { fontSize: 8.5, color: c.link,   marginRight: 0, marginBottom: 2 },
    contactSep:  { fontSize: 8.5, color: c.rule,   marginHorizontal: 6, marginBottom: 2 },

    // ── Section title ─────────────────────────────────────────────────────────
    section: { marginBottom: 10 },

    // Classic/Minimal: text + extending rule to right
    sectionRowClassic: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    sectionLabelClassic: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.8,
      marginRight: 8,
    },
    sectionRule: { flex: 1, height: 1, backgroundColor: c.rule },

    // Modern: left accent bar + label
    sectionRowModern: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    sectionAccentBar: { width: 3, minHeight: 14, backgroundColor: c.accent, marginRight: 7 },
    sectionLabelModern: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.8,
    },

    // ── Summary ───────────────────────────────────────────────────────────────
    summary: { fontSize: 9.5, color: c.text, lineHeight: 1.45 },

    // ── Entry (experience / projects) ─────────────────────────────────────────
    entryItem:   { marginBottom: 8 },
    entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2.5 },
    entryTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.text },
    entryTitleSep: { fontSize: 10, color: c.muted, marginHorizontal: 5 },
    entrySub:    { fontSize: 10, color: c.accent, fontFamily: 'Helvetica-Oblique' },
    entryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, flexWrap: 'wrap' },
    entryDates:  { fontSize: 8.5, color: c.muted, flexShrink: 0 },
    entryMeta:   { fontSize: 8.5, color: c.muted, marginBottom: 2, fontFamily: 'Helvetica-Oblique' },
    entryTech:   { fontSize: 8.5, color: c.accent, marginBottom: 2.5 },

    // ── Bullets ───────────────────────────────────────────────────────────────
    bullet:     { flexDirection: 'row', marginBottom: 2, paddingLeft: 4 },
    bulletDot:  { width: 10, fontSize: 9.5, color: c.muted, flexShrink: 0 },
    bulletText: { fontSize: 9.5, color: c.text, flex: 1, lineHeight: 1.4 },

    // ── Skills (dot-separated inline) ─────────────────────────────────────────
    skillsLine: { fontSize: 9.5, color: c.text, lineHeight: 1.5 },
    skillsDot:  { fontSize: 9.5, color: c.rule },

    // ── Education ─────────────────────────────────────────────────────────────
    eduRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    eduLeft:   { flex: 1, marginRight: 10 },
    eduDegree: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.text },
    eduSchool: { fontSize: 9, color: c.muted, fontFamily: 'Helvetica-Oblique', marginTop: 2 },
    eduDates:  { fontSize: 8.5, color: c.muted, flexShrink: 0, marginTop: 1 },

    // ── Certifications ────────────────────────────────────────────────────────
    certRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    certLeft:   { flex: 1, marginRight: 10 },
    certName:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.text },
    certIssuer: { fontSize: 9, color: c.muted, fontFamily: 'Helvetica-Oblique', marginTop: 2 },
    certDate:   { fontSize: 8.5, color: c.muted, flexShrink: 0, marginTop: 1 },

    // ── Footer ────────────────────────────────────────────────────────────────
    footer: {
      position: 'absolute',
      bottom: 16,
      left: 46,
      right: 46,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerText: { fontSize: 7.5, color: c.rule },
  })
}

function SectionTitle({ label, s, isModern }) {
  if (isModern) {
    return (
      <View style={s.sectionRowModern}>
        <View style={s.sectionAccentBar} />
        <Text style={s.sectionLabelModern}>{label}</Text>
      </View>
    )
  }
  return (
    <View style={s.sectionRowClassic}>
      <Text style={s.sectionLabelClassic}>{label}</Text>
      <View style={s.sectionRule} />
    </View>
  )
}

function parseBold(text) {
  const parts = []
  const regex = /\*\*(.*?)\*\*/g
  let lastIndex = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false })
  return parts.length ? parts : [{ text, bold: false }]
}

function Bullet({ text, s }) {
  const parts = parseBold(text)
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>
        {parts.map((p, i) => (
          <Text key={i} style={p.bold ? { fontFamily: 'Helvetica-Bold' } : {}}>{p.text}</Text>
        ))}
      </Text>
    </View>
  )
}

// Contact items with · separators
function ContactRow({ data, s }) {
  const items = [
    data.email    ? { text: data.email,    link: false } : null,
    data.phone    ? { text: data.phone,    link: false } : null,
    data.location ? { text: data.location, link: false } : null,
    data.linkedin ? { text: data.linkedin, link: true  } : null,
    data.github   ? { text: data.github,   link: true  } : null,
    data.portfolio? { text: data.portfolio,link: true  } : null,
  ].filter(Boolean)

  return (
    <View style={s.contactRow}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={item.link ? s.contactLink : s.contactText}>{item.text}</Text>
          {i < items.length - 1 && <Text style={s.contactSep}>·</Text>}
        </View>
      ))}
    </View>
  )
}

// Skills rendered as: Skill1 · Skill2 · Skill3
function SkillsLine({ skills, s }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {skills.map((skill, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={s.skillsLine}>{skill}</Text>
          {i < skills.length - 1 && <Text style={s.skillsDot}>  ·  </Text>}
        </View>
      ))}
    </View>
  )
}

export default function ResumeDocument({ data, template = 'classic' }) {
  const c = makeColors(template)
  const s = makeStyles(template, c)
  const isModern = template === 'modern'

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.name}>{data.name}</Text>
          <ContactRow data={data} s={s} />
        </View>

        {/* Summary */}
        {data.summary && (
          <View style={s.section}>
            <SectionTitle label="Summary" s={s} isModern={isModern} />
            <Text style={s.summary}>{data.summary}</Text>
          </View>
        )}

        {/* Reorderable sections */}
        {(data.sectionOrder ?? ['experience', 'skills', 'projects', 'certifications', 'education']).map(key => {
          if (key === 'experience' && data.experience?.length > 0) return (
            <View key="experience" style={s.section}>
              <SectionTitle label="Experience" s={s} isModern={isModern} />
              {data.experience.map((exp, i) => (
                <View key={i} style={s.entryItem}>
                  <View style={s.entryHeader}>
                    <View style={s.entryHeaderLeft}>
                      <Text style={s.entryTitle}>{exp.title}</Text>
                      {exp.company && <Text style={s.entryTitleSep}>·</Text>}
                      {exp.company && <Text style={s.entrySub}>{exp.company}</Text>}
                    </View>
                    <Text style={s.entryDates}>{exp.dates}</Text>
                  </View>
                  {exp.bullets?.map((b, j) => (
                    <Bullet key={j} text={b} s={s} />
                  ))}
                </View>
              ))}
            </View>
          )
          if (key === 'skills' && data.skills?.length > 0) return (
            <View key="skills" style={s.section}>
              <SectionTitle label="Skills" s={s} isModern={isModern} />
              <SkillsLine skills={data.skills} s={s} />
            </View>
          )
          if (key === 'projects' && data.projects?.length > 0) return (
            <View key="projects" style={s.section}>
              <SectionTitle label="Projects" s={s} isModern={isModern} />
              {data.projects.map((proj, i) => (
                <View key={i} style={s.entryItem}>
                  <View style={s.entryHeader}>
                    <View style={s.entryHeaderLeft}>
                      <Text style={s.entryTitle}>{proj.name}</Text>
                      {proj.technologies?.length > 0 && <Text style={s.entryTitleSep}>·</Text>}
                      {proj.technologies?.length > 0 && <Text style={s.entrySub}>{proj.technologies.join(', ')}</Text>}
                    </View>
                    {proj.url && <Text style={[s.contactLink, { flexShrink: 0 }]}>{proj.url}</Text>}
                  </View>
                  {proj.description && <Text style={s.entryMeta}>{proj.description}</Text>}
                  {proj.bullets?.map((b, j) => (
                    <Bullet key={j} text={b} s={s} />
                  ))}
                </View>
              ))}
            </View>
          )
          if (key === 'certifications' && data.certifications?.length > 0) return (
            <View key="certifications" style={s.section}>
              <SectionTitle label="Certifications" s={s} isModern={isModern} />
              {data.certifications.map((cert, i) => (
                <View key={i} style={s.certRow}>
                  <View style={s.certLeft}>
                    <Text style={s.certName}>{cert.name}</Text>
                    {cert.issuer && <Text style={s.certIssuer}>{cert.issuer}</Text>}
                  </View>
                  {cert.date && <Text style={s.certDate}>{cert.date}</Text>}
                </View>
              ))}
            </View>
          )
          if (key === 'education' && data.education?.length > 0) return (
            <View key="education" style={s.section}>
              <SectionTitle label="Education" s={s} isModern={isModern} />
              {data.education.map((edu, i) => (
                <View key={i} style={s.eduRow}>
                  <View style={s.eduLeft}>
                    <Text style={s.eduDegree}>{edu.degree}</Text>
                    <Text style={s.eduSchool}>{edu.school}</Text>
                  </View>
                  <Text style={s.eduDates}>{edu.dates}</Text>
                </View>
              ))}
            </View>
          )
          return null
        })}

        {/* Extra Sections */}
        {data.extraSections?.map((section, si) => {
          const items = (section.items || []).filter(item => item?.trim())
          if (!items.length) return null
          return (
            <View key={si} style={s.section}>
              <SectionTitle label={section.title} s={s} isModern={isModern} />
              {items.map((item, j) => (
                <Bullet key={j} text={item} s={s} />
              ))}
            </View>
          )
        })}

        {/* Footer — page number only on page 2+ */}
        <View style={s.footer} fixed>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 && pageNumber > 1 ? `Page ${pageNumber} of ${totalPages}` : ''
            }
          />
        </View>

      </Page>
    </Document>
  )
}
