/**
 * A bounded zlib (RFC 1950) + DEFLATE (RFC 1951) decoder, pure: the mod
 * sandbox may have no zlib. Used to prove a PNG's IDAT data really decodes to
 * its pixel rows before the payload may pass unmasked (Codex XREVIEW HOLD
 * 6293176280 on orchestkit#4801). It never writes more than `limit` bytes:
 * one byte past the limit is a failure, so a crafted stream cannot blow up.
 * Returns the inflated bytes, or null on any error (bad header, bad code,
 * distance too far back, truncated input, output over the limit, a trailing
 * byte, or a wrong Adler-32).
 */

class Bits {
  pos = 0;
  bit = 0;
  constructor(private readonly b: Uint8Array, start: number, private readonly end: number) {
    this.pos = start;
  }
  /** n bits, least significant first; -1 when the input runs out. */
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (this.pos >= this.end) return -1;
      v |= ((this.b[this.pos] >> this.bit) & 1) << i;
      if (++this.bit === 8) {
        this.bit = 0;
        this.pos++;
      }
    }
    return v;
  }
  align(): void {
    if (this.bit !== 0) {
      this.bit = 0;
      this.pos++;
    }
  }
}

/** Canonical Huffman table: counts per length and symbols in code order. */
interface Huffman {
  counts: Int32Array;
  symbols: Int32Array;
}

/**
 * kind: "codes" = the code-length tree, "dynamic" = a literal/length or
 * distance tree of a dynamic block, "fixed" = the RFC 1951 fixed tables.
 * zlib's rule (inflate_table): an over-subscribed tree is never valid; an
 * incomplete tree is valid only outside "codes" and only when it holds a
 * single code of length 1 (RFC 1951 allows one distance code). An all-zero
 * tree is accepted here and fails on first use, as in zlib. The fixed
 * distance table (30 codes of length 5) is incomplete by design and is not
 * checked. Codex XREVIEW HOLD 6293967301: incomplete dynamic trees were
 * accepted.
 */
function huffman(lengths: ArrayLike<number>, n: number, kind: "codes" | "dynamic" | "fixed"): Huffman | null {
  const counts = new Int32Array(16);
  let max = 0;
  for (let i = 0; i < n; i++) {
    counts[lengths[i]]++;
    if (lengths[i] > max) max = lengths[i];
  }
  counts[0] = 0;
  let left = 1;
  for (let len = 1; len < 16; len++) {
    left = (left << 1) - counts[len];
    if (left < 0) return null; // over-subscribed
  }
  if (kind !== "fixed" && max > 0 && left > 0 && (kind === "codes" || max !== 1)) return null; // incomplete
  const offs = new Int32Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + counts[len];
  const symbols = new Int32Array(n);
  for (let i = 0; i < n; i++) if (lengths[i] !== 0) symbols[offs[lengths[i]]++] = i;
  return { counts, symbols };
}

function decodeSym(bits: Bits, h: Huffman): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len < 16; len++) {
    const bit = bits.read(1);
    if (bit < 0) return -1;
    code |= bit;
    const count = h.counts[len];
    if (code - count < first) return h.symbols[index + (code - first)];
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  return -1;
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

let FIXED: { lit: Huffman; dist: Huffman } | null = null;
function fixedTables(): { lit: Huffman; dist: Huffman } {
  if (FIXED === null) {
    const l = new Array<number>(288);
    for (let i = 0; i < 144; i++) l[i] = 8;
    for (let i = 144; i < 256; i++) l[i] = 9;
    for (let i = 256; i < 280; i++) l[i] = 7;
    for (let i = 280; i < 288; i++) l[i] = 8;
    FIXED = { lit: huffman(l, 288, "fixed")!, dist: huffman(new Array<number>(30).fill(5), 30, "fixed")! };
  }
  return FIXED;
}

export function zlibInflate(src: Uint8Array, limit: number): Uint8Array | null {
  if (src.length < 6) return null;
  const cmf = src[0];
  const flg = src[1];
  if ((cmf & 0x0f) !== 8 || cmf >> 4 > 7 || ((cmf << 8) | flg) % 31 !== 0 || flg & 0x20) return null;
  const out = new Uint8Array(limit);
  let o = 0;
  const bits = new Bits(src, 2, src.length - 4);
  let last = 0;
  while (!last) {
    last = bits.read(1);
    const type = bits.read(2);
    if (last < 0 || type < 0) return null;
    if (type === 0) {
      bits.align();
      const p = bits.pos;
      if (p + 4 > src.length - 4) return null;
      const len = src[p] | (src[p + 1] << 8);
      const nlen = src[p + 2] | (src[p + 3] << 8);
      if ((len ^ 0xffff) !== nlen || p + 4 + len > src.length - 4 || o + len > limit) return null;
      out.set(src.subarray(p + 4, p + 4 + len), o);
      o += len;
      bits.pos = p + 4 + len;
      continue;
    }
    let lit: Huffman;
    let dist: Huffman;
    if (type === 1) {
      ({ lit, dist } = fixedTables());
    } else if (type === 2) {
      const hlit = bits.read(5) + 257;
      const hdist = bits.read(5) + 1;
      const hclen = bits.read(4) + 4;
      if (hlit < 257 || hdist < 1 || hclen < 4 || hlit > 286 || hdist > 30) return null;
      const cl = new Array<number>(19).fill(0);
      for (let i = 0; i < hclen; i++) {
        const v = bits.read(3);
        if (v < 0) return null;
        cl[ORDER[i]] = v;
      }
      const clh = huffman(cl, 19, "codes");
      if (clh === null) return null;
      const lens: number[] = [];
      while (lens.length < hlit + hdist) {
        const sym = decodeSym(bits, clh);
        if (sym < 0) return null;
        if (sym < 16) {
          lens.push(sym);
        } else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            if (lens.length === 0) return null;
            val = lens[lens.length - 1];
            rep = 3 + bits.read(2);
          } else if (sym === 17) {
            rep = 3 + bits.read(3);
          } else {
            rep = 11 + bits.read(7);
          }
          if (rep < 3 || lens.length + rep > hlit + hdist) return null;
          for (let r = 0; r < rep; r++) lens.push(val);
        }
      }
      if (lens[256] === 0) return null; // no end-of-block code
      const l = huffman(lens.slice(0, hlit), hlit, "dynamic");
      const d = huffman(lens.slice(hlit), hdist, "dynamic");
      if (l === null || d === null) return null;
      lit = l;
      dist = d;
    } else {
      return null;
    }
    for (;;) {
      const sym = decodeSym(bits, lit);
      if (sym < 0) return null;
      if (sym < 256) {
        if (o >= limit) return null;
        out[o++] = sym;
      } else if (sym === 256) {
        break;
      } else {
        const li = sym - 257;
        if (li >= 29) return null;
        const le = bits.read(LEN_EXTRA[li]);
        const ds = decodeSym(bits, dist);
        if (le < 0 || ds < 0 || ds >= 30) return null;
        const de = bits.read(DIST_EXTRA[ds]);
        if (de < 0) return null;
        const len = LEN_BASE[li] + le;
        const back = DIST_BASE[ds] + de;
        if (back > o || o + len > limit) return null;
        for (let k = 0; k < len; k++, o++) out[o] = out[o - back];
      }
    }
  }
  bits.align();
  if (bits.pos !== src.length - 4) return null; // trailing bytes before the checksum
  let a = 1;
  let b = 0;
  for (let i = 0; i < o; i++) {
    a = (a + out[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = (((src[src.length - 4] << 24) | (src[src.length - 3] << 16) | (src[src.length - 2] << 8) | src[src.length - 1]) >>> 0);
  if ((((b << 16) | a) >>> 0) !== adler) return null;
  return out.subarray(0, o);
}
