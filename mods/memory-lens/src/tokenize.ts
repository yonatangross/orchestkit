/**
 * Tokenizer for memory-lens: lower-case words, compound slugs split, filler dropped.
 *
 * The stop list carries conversational filler and profanity as well as grammar
 * words: measured on real prompts, "fix all" or "this is ugly" otherwise matched
 * whichever long memory repeated those words most.
 */

const WORD = /[a-z0-9][a-z0-9_.+-]*[a-z0-9]|[a-z0-9]/g;

export const STOP = new Set(
  (
    'a an the and or but if then so of to in on at for with from by as is are was were be been it its this that ' +
    'these those i you we he she they me my our your us them do does did done not no yes can could should would will ' +
    'just also very more most much many some any all what which who whom why how when where there here into out up ' +
    'down over under again about than too only own same other such each both few new now get got make made go going ' +
    'want need like see show let lets please pls ok okay im dont doesnt didnt cant wont thats whats btw etc ' +
    'one two image seems still fuck fucked fucking wtf shit shitty ugly damn think maybe better good well part ' +
    'first last right have give everything never continue really missing fix ahead tell him her use find alot lot ' +
    'thing things stuff way work because since yet even though already always something anything nothing doing ' +
    'said say says theres wasnt isnt arent explain'
  ).split(' '),
);

/** Tokens for matching. A slug like "og-card" also yields "og" and "card". */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(WORD) ?? []) {
    const t = raw.replace(/^[.+_-]+|[.+_-]+$/g, '');
    if (t.length < 2 || STOP.has(t)) continue;
    out.push(t);
    if (/[-_.]/.test(t)) {
      for (const part of t.split(/[-_.]/)) {
        if (part.length > 1 && !STOP.has(part)) out.push(part);
      }
    }
  }
  return out;
}
