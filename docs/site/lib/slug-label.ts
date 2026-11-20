import acronyms from "./slug-acronyms.json";

const WORDS: Record<string, string> = acronyms.words;
const PHRASES: Record<string, string> = acronyms.phrases;
const MAX_PHRASE_LEN = Math.max(
  1,
  ...Object.keys(PHRASES).map((k) => k.split("-").length),
);

/**
 * Turn a kebab-case slug into a display label. Acronyms keep their canonical
 * casing ("ai" -> "AI", "ci-cd" -> "CI/CD") instead of "Ai" / "Ci Cd".
 * The acronym list lives in slug-acronyms.json, shared with the Python and
 * Node doc generators.
 */
export function slugLabel(slug: string): string {
  const tokens = slug.split("-");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let n = Math.min(MAX_PHRASE_LEN, tokens.length - i); n > 1; n--) {
      const phrase = PHRASES[tokens.slice(i, i + n).join("-")];
      if (phrase) {
        out.push(phrase);
        i += n;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const w = tokens[i];
    out.push(WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1));
    i += 1;
  }
  return out.join(" ");
}
