import { zlibInflate } from "./inflate.js";

/**
 * Image payloads that may pass the veil unmasked, and the checks they must pass.
 *
 * An image payload is one long high-entropy base64 run, so the entropy layer
 * covered it and the API rejected every image Read (card
 * image-read-fault-2026-10-18). A payload passes only when ALL hold
 * (Codex XREVIEW HOLD 6288472542 on orchestkit#4801):
 *   - its media type is on the allowlist (a Map: no inherited keys);
 *   - the text is strict base64 (length a multiple of 4, padding only at the
 *     end) and under the size cap;
 *   - the WHOLE decoded file has the structure of its type, end to end
 *     (PNG chunks with CRCs, JPEG segments to EOI, GIF blocks to the trailer,
 *     WebP RIFF chunks to the exact end), not only a file signature;
 *   - the caller checks it holds no named value or vendor shape (holdsSecret).
 * Pure: the mod sandbox may have neither Buffer nor atob.
 */

/** Most base64 characters one image payload may carry (about 12 MB decoded). */
export const MAX_MEDIA_CHARS = 16_000_000;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = new Map<string, number>(Array.from(B64, (c, i) => [c, i] as [string, number]));

/** Strict base64 to bytes, or null: wrong length, bad padding, a foreign character, or over the cap. */
export function decodeBase64Strict(text: string): Uint8Array | null {
  if (typeof text !== "string" || text.length === 0 || text.length % 4 !== 0 || text.length > MAX_MEDIA_CHARS) {
    return null;
  }
  const pad = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const body = text.length - pad;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const q: number[] = [];
    for (let k = 0; k < 4; k++) {
      const pos = i + k;
      if (pos >= body) {
        q.push(0);
        continue;
      }
      const v = B64_INDEX.get(text[pos]);
      if (v === undefined) return null;
      q.push(v);
    }
    const word = (q[0] << 18) | (q[1] << 12) | (q[2] << 6) | q[3];
    const bytes = [(word >> 16) & 0xff, (word >> 8) & 0xff, word & 0xff];
    for (const b of bytes) {
      if (o < out.length) out[o++] = b;
    }
  }
  // Non-canonical padding bits (e.g. "QR==" for one byte) mean the text is not the canonical encoding.
  if (pad === 2 && (B64_INDEX.get(text[body - 1])! & 0x0f) !== 0) return null;
  if (pad === 1 && (B64_INDEX.get(text[body - 1])! & 0x03) !== 0) return null;
  return out;
}

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (CRC_TABLE === null) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32be = (b: Uint8Array, i: number): number => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b: Uint8Array, i: number): number => ((b[i + 3] << 24) | (b[i + 2] << 16) | (b[i + 1] << 8) | b[i]) >>> 0;
const startsWith = (b: Uint8Array, prefix: number[]): boolean => prefix.every((v, i) => b[i] === v);
const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

/**
 * PNG: signature; IHDR first, 13 bytes, nonzero size, a legal bit depth for
 * its colour type; at least one IDAT; every chunk's CRC right; IEND last and
 * exactly at the end. Compressed text (zTXt, or iTXt with its compression
 * flag set) cannot be checked for secrets without inflating it, so such a
 * file is not exempt (Codex HOLD 6290872512).
 */
function validPng(b: Uint8Array): boolean {
  if (!startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return false;
  let i = 8;
  let first = true;
  let idat = 0;
  const idatParts: Uint8Array[] = [];
  let idatBytes = 0;
  let width = 0;
  let height = 0;
  let bitsPerPixel = 0;
  let interlaced = false;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const typeStart = i + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + len;
    if (len > 0x7fffffff || dataEnd + 4 > b.length) return false;
    for (let k = typeStart; k < dataStart; k++) {
      const c = b[k];
      if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
    }
    const type = String.fromCharCode(b[typeStart], b[typeStart + 1], b[typeStart + 2], b[typeStart + 3]);
    if (crc32(b, typeStart, dataEnd) !== u32be(b, dataEnd)) return false;
    if (first) {
      if (type !== "IHDR" || len !== 13) return false;
      const w = u32be(b, dataStart);
      const h = u32be(b, dataStart + 4);
      const depth = b[dataStart + 8];
      const colour = b[dataStart + 9];
      const legal: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      const depths = Object.prototype.hasOwnProperty.call(legal, colour) ? legal[colour] : undefined;
      if (w === 0 || h === 0 || w > 0x7fffffff || h > 0x7fffffff || !depths || !depths.includes(depth)) return false;
      if (b[dataStart + 10] !== 0 || b[dataStart + 11] !== 0 || b[dataStart + 12] > 1) return false;
      const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      width = w;
      height = h;
      bitsPerPixel = depth * channels[colour];
      interlaced = b[dataStart + 12] === 1;
      first = false;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT" && len > 0) {
      idat++;
      idatParts.push(b.subarray(dataStart, dataEnd));
      idatBytes += len;
    }
    if (type === "zTXt") return false;
    if (type === "iTXt") {
      const nul = b.indexOf(0, dataStart);
      if (nul < 0 || nul + 1 >= dataEnd || b[nul + 1] !== 0) return false;
    }
    i = dataEnd + 4;
    if (type === "IEND") {
      if (len !== 0 || i !== b.length || idat === 0) return false;
      const z = new Uint8Array(idatBytes);
      let at = 0;
      for (const part of idatParts) {
        z.set(part, at);
        at += part.length;
      }
      return pixelRowsValid(z, width, height, bitsPerPixel, interlaced);
    }
  }
  return false;
}

/** Most bytes the PNG pixel data may inflate to (64 MiB): a bigger image is not exempt. */
export const MAX_PNG_RAW_BYTES = 64 * 1024 * 1024;

/**
 * The IDAT stream must inflate (bounded) to exactly the expected filtered
 * rows: every row starts with a filter byte 0..4 (Adam7 passes for an
 * interlaced image). Proves real pixel data, not only PNG framing (Codex
 * XREVIEW HOLD 6293176280).
 */
function pixelRowsValid(z: Uint8Array, w: number, h: number, bpp: number, interlaced: boolean): boolean {
  const rowBytes = (pw: number): number => Math.ceil((pw * bpp) / 8);
  const passes: Array<[number, number]> = [];
  if (!interlaced) {
    passes.push([w, h]);
  } else {
    const adam7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    for (const [x0, y0, dx, dy] of adam7) {
      const pw = Math.ceil((w - x0) / dx);
      const ph = Math.ceil((h - y0) / dy);
      if (pw > 0 && ph > 0) passes.push([pw, ph]);
    }
  }
  let expected = 0;
  for (const [pw, ph] of passes) {
    expected += ph * (1 + rowBytes(pw));
    if (expected > MAX_PNG_RAW_BYTES) return false;
  }
  const raw = zlibInflate(z, expected + 1);
  if (raw === null || raw.length !== expected) return false;
  let at = 0;
  for (const [pw, ph] of passes) {
    const stride = 1 + rowBytes(pw);
    for (let r = 0; r < ph; r++, at += stride) if (raw[at] > 4) return false;
  }
  return true;
}

/**
 * JPEG: SOI; marker segments with in-bounds lengths; at least one DQT; a
 * frame header (SOF0..SOF15 minus DHT/JPG/DAC) with nonzero size and 1 to 4
 * components before the first SOS; non-empty entropy data after SOS; EOI
 * exactly at the end.
 */
function validJpeg(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return false;
  let i = 2;
  let dqt = false;
  let frame = false;
  let scans = 0;
  while (i < b.length) {
    if (b[i] !== 0xff) return false;
    while (i < b.length && b[i] === 0xff) i++; // fill bytes
    if (i >= b.length) return false;
    const m = b[i++];
    if (m === 0xd9) return i === b.length && dqt && frame && scans > 0; // EOI
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // standalone markers
    if (m === 0x00 || m === 0xd8) return false;
    if (i + 2 > b.length) return false;
    const len = (b[i] << 8) | b[i + 1];
    if (len < 2 || i + len > b.length) return false;
    if (m === 0xdb) dqt = true;
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) {
      if (len < 8 || frame) return false;
      const h = (b[i + 3] << 8) | b[i + 4];
      const w = (b[i + 5] << 8) | b[i + 6];
      const comps = b[i + 7];
      if (h === 0 || w === 0 || comps < 1 || comps > 4 || len !== 8 + 3 * comps) return false;
      frame = true;
    }
    i += len;
    if (m === 0xda) {
      if (!frame) return false;
      // Entropy-coded data: runs until a marker other than a stuffed 00 or a restart marker; never empty.
      const start = i;
      while (i + 1 < b.length) {
        if (b[i] === 0xff && b[i + 1] !== 0x00 && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7)) break;
        i++;
      }
      if (i + 1 >= b.length || i === start) return false;
      scans++;
    }
  }
  return false;
}

/** GIF: header, logical screen, every block walked, at least one image of nonzero size with data, trailer at the end. */
function validGif(b: Uint8Array): boolean {
  if (!(startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"))) || b.length < 14) return false;
  let i = 13;
  const flags = b[10];
  if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
  let images = 0;
  const subBlocks = (): number => {
    let total = 0;
    while (i < b.length) {
      const n = b[i++];
      if (n === 0) return total;
      total += n;
      i += n;
    }
    return -1;
  };
  while (i < b.length) {
    const tag = b[i++];
    if (tag === 0x3b) return i === b.length && images > 0;
    if (tag === 0x21) {
      if (i >= b.length) return false;
      i++; // label
      if (subBlocks() < 0) return false;
    } else if (tag === 0x2c) {
      if (i + 9 > b.length) return false;
      const w = b[i + 4] | (b[i + 5] << 8);
      const h = b[i + 6] | (b[i + 7] << 8);
      const f = b[i + 8];
      i += 9;
      if (w === 0 || h === 0) return false;
      if (f & 0x80) i += 3 * (1 << ((f & 0x07) + 1));
      if (i >= b.length) return false;
      const lzw = b[i++];
      if (lzw < 2 || lzw > 8) return false;
      if (subBlocks() <= 0) return false;
      images++;
    } else {
      return false;
    }
  }
  return false;
}

/**
 * The media types whose payload may pass, each with its whole-file validator. A Map: no inherited keys.
 * WebP is not on it (operator decision 2026-10-20): its bitstream cannot be proven without a full
 * decoder, so a WebP Read stays masked while the veil is on.
 */
export const MEDIA_VALIDATORS: ReadonlyMap<string, (b: Uint8Array) => boolean> = new Map([
  ["image/png", validPng],
  ["image/jpeg", validJpeg],
  ["image/gif", validGif],
]);

/** The decoded image when the payload passes every structural check, else null. */
export function validImage(mediaType: unknown, data: unknown): Uint8Array | null {
  if (typeof mediaType !== "string" || typeof data !== "string") return null;
  const validator = MEDIA_VALIDATORS.get(mediaType);
  if (validator === undefined) return null;
  const bytes = decodeBase64Strict(data);
  if (bytes === null) return null;
  return validator(bytes) === true ? bytes : null;
}

/**
 * True when a secret appears in the image. The caller withholds the result.
 *   - named values (8+ chars): in the decoded bytes (read as Latin-1, so text
 *     in a PNG tEXt chunk or EXIF is seen) or in the base64 text itself;
 *   - vendor shapes (sk-ant-, AKIA, PEM header, ...): in the decoded bytes
 *     only. In the base64 text a 4-letter shape such as AKIA occurs by chance
 *     in about 2 % of large images, which would withhold ordinary screenshots.
 */
export function holdsSecret(
  bytes: Uint8Array,
  base64: string,
  named: readonly string[],
  shapes: readonly string[],
): boolean {
  if (named.length === 0 && shapes.length === 0) return false;
  let text = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    text += String.fromCharCode(...bytes.subarray(i, i + STEP));
  }
  // The decoded bytes are read as Latin-1 (one char per byte), so a value is
  // matched in each byte encoding a metadata field may use: UTF-8 (PNG iTXt,
  // XMP), UTF-16LE (EXIF XP* tags) and plain Latin-1 (PNG tEXt, GIF comment).
  // Codex HOLD 6290872512: a non-ASCII named value in UTF-8 metadata was missed.
  const encodings = (v: string): string[] => {
    const utf8 = byteString(new TextEncoder().encode(v));
    // Every UTF-16 code unit by index: Array.from(v) walks code points and would drop the low
    // surrogate of a supplementary character (Codex HOLD 6293176280).
    let utf16 = "";
    for (let k = 0; k < v.length; k++) {
      const u = v.charCodeAt(k);
      utf16 += String.fromCharCode(u & 0xff, u >> 8);
    }
    return Array.from(new Set([v, utf8, utf16]));
  };
  for (const n of named) {
    if (n.length === 0) continue;
    if (base64.includes(n)) return true;
    if (encodings(n).some((e) => text.includes(e))) return true;
  }
  return shapes.some((s) => s.length > 0 && encodings(s).some((e) => text.includes(e)));
}

function byteString(bytes: Uint8Array): string {
  let out = "";
  for (const x of bytes) out += String.fromCharCode(x);
  return out;
}
