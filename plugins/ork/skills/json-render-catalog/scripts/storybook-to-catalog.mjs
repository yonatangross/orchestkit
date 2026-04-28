#!/usr/bin/env node
// storybook-to-catalog.mjs — generate a Zod-typed json-render catalog from
// a Storybook MCP manifest (output of `list-all-documentation`).
//
// Issue #1529 (Lane C • Tier B): genui-architect imports Storybook stories
// as AI-safe catalog. Storybook becomes the single source of truth.
//
// Usage:
//   node storybook-to-catalog.mjs <manifest.json> --out <catalog.ts>
//   node storybook-to-catalog.mjs <manifest.json> --out <catalog.ts> --components <components.tsx>
//   node storybook-to-catalog.mjs <manifest.json> --project-root .         # anchor filePath resolution
//   node storybook-to-catalog.mjs <manifest.json> --check                  # validate only, no emit
//   node storybook-to-catalog.mjs <manifest.json> --json                   # emit catalog as JSON to stdout
//
// Zero deps. See references/storybook-import.md for the arg→Zod mapping.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { argv, exit, stderr, stdout } from 'node:process'

function fail(msg) {
  stderr.write(`storybook-to-catalog: ${msg}\n`)
  exit(2)
}

function parseArgs(args) {
  const opts = { input: null, out: null, components: null, check: false, json: false, projectRoot: process.cwd() }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--out') opts.out = args[++i]
    else if (a === '--components') opts.components = args[++i]
    else if (a === '--project-root') opts.projectRoot = resolve(args[++i])
    else if (a === '--check') opts.check = true
    else if (a === '--json') opts.json = true
    else if (!opts.input && !a.startsWith('--')) opts.input = a
    else fail(`unknown arg: ${a}`)
  }
  if (!opts.input) fail('usage: storybook-to-catalog.mjs <manifest.json> --out <catalog.ts>')
  return opts
}

// Storybook arg control type → Zod expression + safety notes.
// `dropped` entries return null and produce a stderr warning.
function argToZod(argType) {
  if (!argType || typeof argType !== 'object') return null

  const tsType = argType.tsType || ''
  const control = argType.control
  // Functions/callbacks: AI cannot generate executables — drop.
  if (/=>|\bvoid\b/.test(tsType)) return { drop: true, reason: 'callback/function' }

  // ReactNode: container marker, not a prop.
  if (tsType === 'ReactNode' || /\bReactNode\b/.test(tsType)) return { drop: true, reason: 'ReactNode (handled via children: allowed)' }

  if (control === null || control === undefined) {
    return { drop: true, reason: 'no control type' }
  }

  // String case object form: { control: 'text' } OR shorthand 'text'
  const ctrl = typeof control === 'object' ? control.type || null : control
  const opts = (typeof control === 'object' && control.options) || argType.options

  switch (ctrl) {
    case 'text': {
      const max = argType.max ?? 500
      return { zod: `z.string().max(${max})` }
    }
    case 'number': {
      let z = 'z.number()'
      if (typeof argType.min === 'number') z += `.min(${argType.min})`
      if (typeof argType.max === 'number') z += `.max(${argType.max})`
      return { zod: z }
    }
    case 'boolean':
      return { zod: 'z.boolean()' }
    case 'select':
    case 'radio': {
      if (!Array.isArray(opts) || opts.length === 0) return { drop: true, reason: 'select/radio with no options' }
      const enums = opts.map(o => `'${String(o).replace(/'/g, "\\'")}'`).join(', ')
      return { zod: `z.enum([${enums}])` }
    }
    case 'color':
      return { zod: 'z.string().regex(/^#[0-9a-fA-F]{6}$/)' }
    case 'date':
      return { zod: 'z.string().datetime()' }
    case 'array': {
      const max = argType.max ?? 20
      return { zod: `z.array(z.string()).max(${max})` }
    }
    case 'object':
      return { drop: true, reason: 'object control — too open for AI safety; add manually' }
    default:
      return { drop: true, reason: `unsupported control: ${ctrl}` }
  }
}

function buildCatalog(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.components)) {
    fail('manifest missing top-level `components` array')
  }
  const components = []
  const dropped = []
  const seen = new Set()

  for (const comp of manifest.components) {
    if (!comp.name || typeof comp.name !== 'string') {
      dropped.push({ component: '<unnamed>', reason: 'missing name' })
      continue
    }
    if (seen.has(comp.name)) {
      dropped.push({ component: comp.name, reason: 'duplicate name' })
      continue
    }
    seen.add(comp.name)

    const argTypes = comp.argTypes || {}
    const props = []
    let childrenAllowed = false

    for (const [propName, argType] of Object.entries(argTypes)) {
      // Special-case `children` arg: don't emit as prop, mark catalog entry as container.
      if (propName === 'children') {
        const tsType = argType?.tsType || ''
        if (/ReactNode|ReactElement/.test(tsType) || argType?.control === 'object') {
          childrenAllowed = true
          continue
        }
      }
      const result = argToZod(argType)
      if (!result) { dropped.push({ component: comp.name, prop: propName, reason: 'unmappable' }); continue }
      if (result.drop) {
        dropped.push({ component: comp.name, prop: propName, reason: result.reason })
        continue
      }
      const required = argType.required === true
      const zod = required ? result.zod : `${result.zod}.optional()`
      props.push({ name: propName, zod, required })
    }

    components.push({
      name: comp.name,
      description: comp.description || '',
      filePath: comp.filePath || null,
      props,
      children: childrenAllowed ? 'allowed' : false,
      stories: comp.stories || [],
    })
  }

  if (components.length === 0) fail('no components survived import — check manifest shape and dropped log')

  return { components, dropped, manifest }
}

function emitCatalogTs(cat, sourcePath) {
  const hash = createHash('sha1').update(JSON.stringify(cat.manifest)).digest('hex').slice(0, 12)
  const ts = new Date().toISOString()
  const lines = []
  lines.push(`// AUTO-GENERATED from Storybook — do not edit by hand`)
  lines.push(`// Source: ${basename(sourcePath)} (sha1: ${hash})`)
  lines.push(`// Generated: ${ts}`)
  lines.push(`// Regenerate via: storybook-to-catalog.mjs <manifest> --out <this file>`)
  lines.push(``)
  lines.push(`import { defineCatalog } from '@json-render/core'`)
  lines.push(`import { z } from 'zod'`)
  lines.push(``)
  lines.push(`export const catalog = defineCatalog({`)
  for (const c of cat.components) {
    lines.push(`  ${c.name}: {`)
    if (c.description) lines.push(`    description: ${JSON.stringify(c.description)},`)
    if (c.props.length === 0) {
      lines.push(`    props: z.object({}),`)
    } else {
      lines.push(`    props: z.object({`)
      for (const p of c.props) lines.push(`      ${p.name}: ${p.zod},`)
      lines.push(`    }),`)
    }
    lines.push(`    children: ${c.children === 'allowed' ? `'allowed'` : 'false'},`)
    lines.push(`  },`)
  }
  lines.push(`})`)
  lines.push(``)
  return lines.join('\n')
}

function emitComponentsTsx(cat, outDir, projectRoot) {
  const lines = []
  lines.push(`// AUTO-GENERATED from Storybook — wires catalog to actual React components.`)
  lines.push(`// Edit imports if your story files live elsewhere.`)
  lines.push(``)
  lines.push(`import type { CatalogComponents } from '@json-render/react'`)
  lines.push(`import type { catalog } from './catalog'`)
  for (const c of cat.components) {
    if (!c.filePath) {
      lines.push(`// ${c.name}: no filePath — wire manually`)
      continue
    }
    // filePath is project-relative (from Storybook). Resolve via projectRoot,
    // strip .stories.* suffix, then compute path relative to the components.tsx outDir.
    const compFile = c.filePath.replace(/\.stories\.(tsx?|jsx?|mdx)$/, '')
    const compAbs = resolve(projectRoot, compFile)
    const rel = relative(outDir, compAbs)
    const importPath = rel.startsWith('.') ? rel : `./${rel}`
    lines.push(`import { ${c.name} } from '${importPath}'`)
  }
  lines.push(``)
  lines.push(`export const components: CatalogComponents<typeof catalog> = {`)
  for (const c of cat.components) lines.push(`  ${c.name},`)
  lines.push(`}`)
  lines.push(``)
  return lines.join('\n')
}

function logDropped(dropped) {
  if (dropped.length === 0) return
  stderr.write(`storybook-to-catalog: dropped ${dropped.length} entries (AI safety):\n`)
  for (const d of dropped) {
    const where = d.prop ? `${d.component}.${d.prop}` : d.component
    stderr.write(`  - ${where}: ${d.reason}\n`)
  }
}

function validateCatalog(cat) {
  const errors = []
  for (const c of cat.components) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(c.name)) errors.push(`${c.name}: invalid PascalCase name`)
    for (const p of c.props) {
      if (/z\.any\(\)|z\.unknown\(\)/.test(p.zod)) errors.push(`${c.name}.${p.name}: emitted unsafe Zod (z.any/z.unknown)`)
    }
  }
  return errors
}

function main() {
  const opts = parseArgs(argv.slice(2))
  let manifest
  try { manifest = JSON.parse(readFileSync(opts.input, 'utf8')) }
  catch (e) { fail(`parse error: ${e.message}`) }

  const cat = buildCatalog(manifest)
  logDropped(cat.dropped)

  const errors = validateCatalog(cat)
  if (errors.length) {
    stderr.write(`storybook-to-catalog: validation failed (${errors.length}):\n`)
    for (const e of errors) stderr.write(`  - ${e}\n`)
    exit(1)
  }

  if (opts.check) {
    stdout.write(`ok — ${cat.components.length} components, ${cat.dropped.length} dropped\n`)
    exit(0)
  }

  if (opts.json) {
    const json = {
      components: cat.components.map(c => ({
        name: c.name, description: c.description, props: c.props, children: c.children,
      })),
      dropped: cat.dropped,
    }
    stdout.write(JSON.stringify(json, null, 2) + '\n')
    exit(0)
  }

  if (!opts.out) fail('--out <catalog.ts> required (or use --check / --json)')

  const outDir = dirname(resolve(opts.out))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(opts.out, emitCatalogTs(cat, opts.input))
  stderr.write(`wrote ${opts.out} (${cat.components.length} components)\n`)

  if (opts.components) {
    const compsDir = dirname(resolve(opts.components))
    mkdirSync(compsDir, { recursive: true })
    writeFileSync(opts.components, emitComponentsTsx(cat, compsDir, opts.projectRoot))
    stderr.write(`wrote ${opts.components}\n`)
  }
}

main()
