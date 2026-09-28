/**
 * What the human sees and what the model gets.
 *
 * Screen line: title, why it matched, where it lives. A client memory shows as
 * "client memory (title hidden)": screens get shared and recorded. Model context:
 * the same hits with their descriptions, capped. Secret-shaped text reaches
 * neither.
 */

import type { Hit, LensPrivate } from './types.js';

/** Hard cap on hits per prompt. */
export const MAX_HITS = 3;
/** About 600 tokens at 4 characters per token. */
export const MAX_CONTEXT_CHARS = 2400;
const DESC_CHARS = 240;

const SECRET = /(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16}|ops_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;

/** True when text carries something shaped like a credential. */
export function looksSecret(text: string): boolean {
  return SECRET.test(text);
}

/**
 * True when any field either surface prints is secret-shaped: name and
 * description, and also the id, source and image path, which the screen line
 * and the context print for mirrored and local memories alike.
 */
export function docLooksSecret(doc: Hit['doc']): boolean {
  return looksSecret([doc.name, doc.desc, doc.id, doc.source, doc.image ?? ''].join(' '));
}

/** True when a hit must not show its title on screen. */
export function isClient(hit: Hit, priv: LensPrivate): boolean {
  const hay = `${hit.doc.id} ${hit.doc.name} ${hit.doc.desc}`.toLowerCase();
  if (/(^|[/-])clients?-/.test(hit.doc.id.toLowerCase())) return true;
  return priv.clientTerms.some((t) => t.length > 1 && hay.includes(t.toLowerCase()));
}

function shortPath(id: string, home: string): string {
  if (!id.startsWith('/')) return id;
  const m = /\/\.claude\/projects\/([^/]+)\/memory\/(.+)$/.exec(id);
  if (!m) return home && id.startsWith(home) ? '~' + id.slice(home.length) : id;
  const proj = m[1].replace(/^-Users-[^-]+-coding-/, '').replace(/^-/, '');
  return `${proj}/memory/${m[2]}`;
}

function title(hit: Hit): string {
  const d = hit.doc.desc.trim();
  const t = d && d.length <= 90 ? d : hit.doc.name.replace(/[_-]+/g, ' ');
  return t.length > 90 ? t.slice(0, 87) + '...' : t;
}

/**
 * The rows the human sees under the prompt, one per memory. Each row is one
 * $.ui.log call: measured in the 2.1.283 TUI (2026-09-28), a newline inside a
 * single log call renders as a replacement glyph, and Claude Code already
 * prefixes every row with the plugin name, so rows carry neither.
 */
export function screenLines(hits: Hit[], priv: LensPrivate, home = ''): string[] {
  return hits.slice(0, MAX_HITS).map((h, i) => {
    const n = `${i + 1}/${Math.min(hits.length, MAX_HITS)}`;
    if (isClient(h, priv) || docLooksSecret(h.doc)) return `${n} [locked] client memory (title hidden)`;
    // the file name on screen, the full path in the model's context
    const where = h.doc.source === 'local' ? (shortPath(h.doc.id, home).split('/').pop() ?? h.doc.id) : `${h.doc.source}: ${h.doc.id}`;
    const image = h.doc.image ? ` · image ${h.doc.image}` : '';
    const why = h.why.length ? ` · ${h.why.slice(0, 2).join(', ')}` : '';
    return `${n} ${title(h)} (${where}${image})${why}`;
  });
}

/** The context entry the model gets, or null when nothing is safe to send. */
export function contextText(hits: Hit[]): string | null {
  const lines: string[] = [];
  for (const h of hits.slice(0, MAX_HITS)) {
    if (docLooksSecret(h.doc)) continue;
    const desc = h.doc.desc.length > DESC_CHARS ? h.doc.desc.slice(0, DESC_CHARS - 3) + '...' : h.doc.desc;
    const where = h.doc.source === 'local' ? h.doc.id : `${h.doc.source} id ${h.doc.id} (fetch the body only if needed)`;
    lines.push(`- ${h.doc.name}: ${desc || '(no description)'} [${where}]`);
  }
  if (!lines.length) return null;
  let text = 'Related memories (memory-lens; weigh them, they may be stale or disagree with the prompt):\n' + lines.join('\n');
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS - 3) + '...';
  return text;
}

/** p50 and p95 of recorded query times, in ms. */
export function percentiles(ms: number[]): { p50: number; p95: number; n: number } {
  const s = [...ms].sort((a, b) => a - b);
  if (!s.length) return { p50: 0, p95: 0, n: 0 };
  return { p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(0.95 * (s.length - 1))], n: s.length };
}
