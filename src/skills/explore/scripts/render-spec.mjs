#!/usr/bin/env node
// render-spec.mjs — validate + render json-render dashboard specs
//
// Usage:
//   node render-spec.mjs <spec.json>           # validate, print markdown to stdout
//   node render-spec.mjs <spec.json> --check   # validate only, exit 0/1
//   node render-spec.mjs <spec.json> --json    # round-trip parse, print canonical JSON
//
// Zero deps. Used by /ork:explore + /ork:assess for the markdown-fallback path
// and as a structural validator before emission. See references/dashboard-spec.md.

import { readFileSync } from 'node:fs'
import { argv, exit, stdout, stderr } from 'node:process'

const CATALOG = {
  Card: { required: [], optional: ['title'], children: 'allowed' },
  StatGrid: { required: ['items'], optional: [], children: 'forbidden' },
  DataTable: { required: ['columns', 'rows'], optional: [], children: 'forbidden' },
  StatusBadge: { required: ['label', 'status'], optional: [], children: 'forbidden' },
  BarMeter: { required: ['label', 'value'], optional: ['color'], children: 'forbidden' },
  Heatmap: { required: ['xLabels', 'yLabels', 'cells'], optional: [], children: 'forbidden' },
  Markdown: { required: ['content'], optional: [], children: 'forbidden' },
}

const STATUS_ENUM = new Set(['success', 'warning', 'error', 'info', 'pending'])
const COLOR_ENUM = new Set(['green', 'red', 'yellow', 'blue', 'gray'])
const TREND_ENUM = new Set(['up', 'down', 'flat'])

function fail(msg) {
  stderr.write(`render-spec: ${msg}\n`)
  exit(2)
}

function validate(spec) {
  const errors = []
  if (typeof spec !== 'object' || spec === null) errors.push('spec is not an object')
  if (typeof spec.root !== 'string') errors.push('spec.root must be a string id')
  if (typeof spec.elements !== 'object' || spec.elements === null) errors.push('spec.elements must be an object')
  if (errors.length) return errors

  if (!(spec.root in spec.elements)) errors.push(`root id "${spec.root}" not found in elements`)

  for (const [id, el] of Object.entries(spec.elements)) {
    const where = `elements["${id}"]`
    if (!el || typeof el !== 'object') { errors.push(`${where} is not an object`); continue }
    if (typeof el.type !== 'string') { errors.push(`${where}.type missing`); continue }
    const def = CATALOG[el.type]
    if (!def) { errors.push(`${where}.type "${el.type}" not in catalog`); continue }
    if (typeof el.props !== 'object' || el.props === null) errors.push(`${where}.props must be an object`)
    for (const r of def.required) if (!(r in (el.props || {}))) errors.push(`${where}.props.${r} required`)

    if (el.children !== undefined) {
      if (def.children === 'forbidden') errors.push(`${where} type "${el.type}" cannot have children`)
      if (!Array.isArray(el.children)) errors.push(`${where}.children must be an array`)
      else for (const cid of el.children) if (!(cid in spec.elements)) errors.push(`${where}.children references missing id "${cid}"`)
    }

    if (el.type === 'BarMeter') {
      const v = el.props?.value
      if (typeof v !== 'number' || v < 0 || v > 10) errors.push(`${where}.props.value must be number in [0,10]`)
      if (el.props?.color && !COLOR_ENUM.has(el.props.color)) errors.push(`${where}.props.color invalid`)
    }
    if (el.type === 'StatusBadge') {
      if (!STATUS_ENUM.has(el.props?.status)) errors.push(`${where}.props.status invalid`)
    }
    if (el.type === 'StatGrid') {
      if (!Array.isArray(el.props?.items)) errors.push(`${where}.props.items must be array`)
      else for (let i = 0; i < el.props.items.length; i++) {
        const it = el.props.items[i]
        if (typeof it?.label !== 'string') errors.push(`${where}.props.items[${i}].label required`)
        if (typeof it?.value !== 'string') errors.push(`${where}.props.items[${i}].value required`)
        if (it?.color && !COLOR_ENUM.has(it.color)) errors.push(`${where}.props.items[${i}].color invalid`)
        if (it?.trend && !TREND_ENUM.has(it.trend)) errors.push(`${where}.props.items[${i}].trend invalid`)
      }
    }
    if (el.type === 'DataTable') {
      const cols = el.props?.columns
      const rows = el.props?.rows
      if (!Array.isArray(cols)) errors.push(`${where}.props.columns must be array`)
      if (!Array.isArray(rows)) errors.push(`${where}.props.rows must be array`)
      if (Array.isArray(cols) && Array.isArray(rows)) {
        const keys = new Set(cols.map(c => c.key))
        for (let i = 0; i < rows.length; i++) {
          for (const k of Object.keys(rows[i])) if (!keys.has(k)) errors.push(`${where}.props.rows[${i}] has unknown key "${k}"`)
        }
      }
    }
  }
  return errors
}

function renderElement(spec, id, depth = 0) {
  const el = spec.elements[id]
  if (!el) return ''
  const ind = '  '.repeat(depth)
  switch (el.type) {
    case 'Card': {
      const title = el.props?.title ? `${ind}## ${el.props.title}\n\n` : ''
      const childTypes = (el.children || []).map(cid => spec.elements[cid]?.type)
      const allBars = childTypes.length > 0 && childTypes.every(t => t === 'BarMeter')
      const sep = allBars ? '\n' : '\n\n'
      const body = (el.children || []).map(cid => renderElement(spec, cid, depth)).join(sep)
      return title + body + (allBars ? '\n' : '')
    }
    case 'StatGrid': {
      const cells = el.props.items.map(it => {
        const trend = it.trend === 'up' ? ' ↑' : it.trend === 'down' ? ' ↓' : ''
        return `**${it.label}:** ${it.value}${trend}`
      })
      return cells.join(' · ') + '\n'
    }
    case 'StatusBadge': {
      const sym = { success: '✓', warning: '⚠', error: '✗', info: 'ℹ', pending: '…' }[el.props.status] || '•'
      return `> ${sym} **${el.props.label}**\n`
    }
    case 'BarMeter': {
      const v = el.props.value
      const filled = Math.round(v)
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
      return `- ${el.props.label.padEnd(16)} ${bar} ${v.toFixed(1)}/10`
    }
    case 'DataTable': {
      const cols = el.props.columns
      const head = '| ' + cols.map(c => c.label).join(' | ') + ' |'
      const sep = '|' + cols.map(() => '---').join('|') + '|'
      const body = el.props.rows.map(r => '| ' + cols.map(c => String(r[c.key] ?? '')).join(' | ') + ' |').join('\n')
      return [head, sep, body].join('\n') + '\n'
    }
    case 'Heatmap': {
      const { xLabels, yLabels, cells } = el.props
      const head = '| | ' + xLabels.join(' | ') + ' |'
      const sep = '|' + xLabels.map(() => '---').join('|') + '|---|'
      const body = yLabels.map((y, i) => '| ' + y + ' | ' + (cells[i] || []).map(v => v.toFixed(1)).join(' | ') + ' |').join('\n')
      return [head, sep, body].join('\n') + '\n'
    }
    case 'Markdown':
      return el.props.content + '\n'
    default:
      return ''
  }
}

function main() {
  const path = argv[2]
  const flag = argv[3]
  if (!path) fail('usage: render-spec.mjs <spec.json> [--check|--json]')
  let spec
  try { spec = JSON.parse(readFileSync(path, 'utf8')) }
  catch (e) { fail(`parse error: ${e.message}`) }
  const errors = validate(spec)
  if (errors.length) {
    stderr.write(`render-spec: validation failed (${errors.length} error${errors.length > 1 ? 's' : ''})\n`)
    for (const e of errors) stderr.write(`  - ${e}\n`)
    exit(1)
  }
  if (flag === '--check') { stdout.write('ok\n'); exit(0) }
  if (flag === '--json') { stdout.write(JSON.stringify(spec, null, 2) + '\n'); exit(0) }
  stdout.write(renderElement(spec, spec.root, 0))
}

main()
