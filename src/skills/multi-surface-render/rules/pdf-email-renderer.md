---
title: Use native react-pdf and react-email renderers instead of browser-based workarounds
impact: HIGH
impactDescription: "Using Puppeteer for PDF or manual HTML for email produces fragile output, adds heavy dependencies, and loses catalog validation"
tags: [pdf, email, react-pdf, react-email, renderToBuffer, renderToFile, renderToStream, renderToHtml]
---

## PDF & Email Renderer

`@json-render/react-pdf` renders specs to PDF using react-pdf primitives (`View`, `Text`, `Image`). `@json-render/react-email` renders specs to HTML email strings using react-email components. Both validate against the same catalog.

**Incorrect — using Puppeteer to screenshot React for PDF:**
```typescript
// WRONG: Launches a browser, takes a screenshot, converts to PDF
import puppeteer from 'puppeteer'

async function generatePdf(spec) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setContent(renderToString(<Dashboard spec={spec} />))
  const pdf = await page.pdf({ format: 'A4' })
  await browser.close()
  return pdf // slow, ~2s startup, CSS rendering differences, no catalog validation
}
```

**Correct — native PDF rendering via react-pdf:**
```typescript
import { renderToBuffer, renderToFile, renderToStream } from '@json-render/react-pdf'
import { catalog } from './catalog'
import { pdfRegistry } from './registries/pdf'

// Buffer — for HTTP responses, S3 upload, attachments
const buffer = await renderToBuffer(spec, { catalog, registry: pdfRegistry })

// File — direct disk write
await renderToFile(spec, './output/report.pdf', { catalog, registry: pdfRegistry })

// Stream — for large documents, pipe to HTTP response
const stream = await renderToStream(spec, { catalog, registry: pdfRegistry })
res.setHeader('Content-Type', 'application/pdf')
stream.pipe(res)
```

**Incorrect — manual HTML string for email:**
```typescript
// WRONG: Manual HTML, no validation, rendering inconsistencies
const html = `<table><tr><td>${data.title}</td></tr></table>`
```

**Correct — react-email rendering:**
```typescript
import { renderToHtml } from '@json-render/react-email'
import { catalog } from './catalog'
import { emailRegistry } from './registries/email'

const html = await renderToHtml(spec, { catalog, registry: emailRegistry })
await transporter.sendMail({ to: user.email, subject: 'Report', html })
```

**Key rules:**
- Use `renderToBuffer` for in-memory PDF (HTTP responses, email attachments, cloud storage upload)
- Use `renderToFile` for disk output (batch report generation, CI artifacts)
- Use `renderToStream` for large documents to avoid buffering the entire PDF in memory
- PDF registry components must use react-pdf primitives (`View`, `Text`, `Image`) — not HTML elements
- Email registry components must use react-email primitives (`Section`, `Text`, `Heading`) — not arbitrary HTML
- Both renderers validate specs against the catalog — invalid types or props throw at render time

### PDF Registry Pattern

```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  card: { border: '1pt solid #e5e7eb', padding: 12, borderRadius: 4 },
})

export const pdfRegistry = {
  Heading: ({ text, level }) => (
    <Text style={{ ...styles.heading, fontSize: level === 'h1' ? 24 : level === 'h2' ? 18 : 14 }}>
      {text}
    </Text>
  ),
  StatCard: ({ label, value }) => (
    <View style={styles.card}>
      <Text style={{ fontSize: 10, color: '#6b7280' }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{value}</Text>
    </View>
  ),
}
```
