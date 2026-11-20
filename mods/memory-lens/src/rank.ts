/**
 * BM25F over name, description and body head, with a score floor.
 *
 * Measured on 33 real prompts (2026-09-28): 46 % of shown memories useful at
 * query p95 21.6 ms in Python over 2,035 memories. The floor makes a weak
 * prompt show nothing instead of noise.
 */

import { tokenize } from './tokenize.js';
import type { Hit, MemoryDoc } from './types.js';

const FIELDS = { name: 3.0, desc: 2.0, body: 1.0 } as const;
type Field = keyof typeof FIELDS;
const K1 = 1.2;
const B = 0.75;

/** Below this a match is noise. */
export const FLOOR = 7.0;
/** A match needs this many query words, or one rare word. */
export const MIN_TERMS = 2;
/** idf at or above this makes one word enough. */
export const RARE = 4.0;
/** Session digests and index hubs match everything; they count half. */
const PENALTY = /(handoff|hub_)/;

export class LensIndex {
  readonly size: number;
  private readonly docs: MemoryDoc[];
  private readonly tf: Array<Record<Field, Map<string, number>>> = [];
  private readonly len: Record<Field, number[]> = { name: [], desc: [], body: [] };
  private readonly avg: Record<Field, number> = { name: 1, desc: 1, body: 1 };
  private readonly df = new Map<string, number>();

  constructor(docs: MemoryDoc[]) {
    this.docs = docs;
    this.size = docs.length;
    for (const doc of docs) {
      const seen = new Set<string>();
      const per = { name: new Map(), desc: new Map(), body: new Map() } as Record<Field, Map<string, number>>;
      for (const f of Object.keys(FIELDS) as Field[]) {
        const text = f === 'name' ? doc.name.replace(/[_-]/g, ' ') + ' ' + doc.name : doc[f];
        const toks = tokenize(text);
        this.len[f].push(toks.length);
        for (const t of toks) {
          per[f].set(t, (per[f].get(t) ?? 0) + 1);
          seen.add(t);
        }
      }
      for (const t of seen) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(per);
    }
    for (const f of Object.keys(FIELDS) as Field[]) {
      const v = this.len[f];
      this.avg[f] = v.length ? v.reduce((a, b) => a + b, 0) / v.length || 1 : 1;
    }
  }

  /** Top k hits above the floor, best first. `skip` ids are never returned. */
  query(text: string, k = 3, skip: ReadonlySet<string> = new Set()): Hit[] {
    const q = [...new Set(tokenize(text))];
    if (!q.length || !this.size) return [];
    const idf = new Map<string, number>();
    for (const t of q) {
      const df = this.df.get(t);
      if (df) idf.set(t, Math.log(1 + (this.size - df + 0.5) / (df + 0.5)));
    }
    if (!idf.size) return [];
    const hits: Hit[] = [];
    this.tf.forEach((per, i) => {
      const doc = this.docs[i];
      if (skip.has(doc.id)) return;
      let score = 0;
      let rare = false;
      const why: Array<[string, number]> = [];
      for (const [t, w0] of idf) {
        let w = 0;
        for (const f of Object.keys(FIELDS) as Field[]) {
          const tf = per[f].get(t);
          if (tf) w += (FIELDS[f] * tf) / (1 - B + (B * this.len[f][i]) / this.avg[f]);
        }
        if (!w) continue;
        const part = (w0 * w * (K1 + 1)) / (w + K1);
        score += part;
        why.push([t, part]);
        if (w0 >= RARE) rare = true;
      }
      if (PENALTY.test(doc.id.split('/').pop() ?? '')) score *= 0.5;
      if (score >= FLOOR && (why.length >= MIN_TERMS || rare)) {
        why.sort((a, b) => b[1] - a[1]);
        hits.push({ doc, score, why: why.map(([t]) => t) });
      }
    });
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, k);
  }
}
