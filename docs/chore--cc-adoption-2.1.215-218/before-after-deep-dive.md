# Before and After: the mechanism behind every finding

This document is the technical companion to the audit. For each finding it states the measured
BEFORE, the target AFTER, and, most importantly, the MECHANISM: why the runtime behaves this way, so
the fix is understood rather than copied.

Audit date 2026-07-23. Claude Code running: 2.1.218. OrchestKit 8.84.4.

---

## 0. The frame: a scheduling-model divergence, not a bug list

OrchestKit was authored against a Claude Code that scheduled work one way. Between 2.1.217 and
2.1.218 the runtime changed how it schedules forked skills and nested agents. ork's declarations did
not move with it. Every high-severity finding below is a consequence of that one divergence.

The useful mental model: ork's frontmatter is a *contract with the scheduler*. When the scheduler
changes its defaults, every contract that relied on an unstated default silently changes meaning.
None of these are syntax errors. All of them still parse. That is exactly why no test caught them.

---

## 1. Forked skills now run in the background

BEFORE
78 of 114 skills declare `context: fork` in frontmatter. Zero declare `background:`. The authors
treated `context: fork` as "run this in a clean context window so it does not pollute the parent
transcript", which is what it meant when the lines were written.

AFTER
Every fork skill declares its execution intent explicitly. Interactive skills declare
`background: false`. Report-producing skills declare `background: true`. Nothing relies on the
default.

MECHANISM
Claude Code 2.1.218 changed the default: "Changed skills with `context: fork` to run in the
background by default; opt out per skill with `background: false`." A backgrounded skill does not
own the foreground turn. Anything it renders for a human, an AskUserQuestion picker, a verdict, a
diff to approve, is produced somewhere the human is not looking. The skill still runs, still
succeeds, and still returns. It simply returns into a channel the user is not reading.

This is why the failure is dangerous: it is not a crash, it is a silent relocation of output.

SCOPE, measured precisely
Splitting the 78 by invocation path rather than counting them as one blob:
39 are `disable-model-invocation: true`, meaning slash-only.
39 remain model-invocable, meaning Claude can call them mid-turn on its own.
The second group is the true risk set. It includes assess, cover, expect, explore, fix-issue,
review-pr, verify, design-ship, design-to-code.

HONEST LIMIT
During this very audit, `/ork:brainstorm` was invoked. It carries `context: fork`, declares no
`background:`, and it ran inline, in the foreground, on 2.1.218. It is also slash-only. So the
observed evidence supports "the config is unguarded" and does not yet support "all 78 are
relocating their output". Treat this as a confirmed configuration gap with an unconfirmed runtime
symptom. The fix is cheap and the ambiguity is not worth preserving.

---

## 2. Nested agent spawning is off by default

BEFORE
13 `Agent(ork:*)` grants across 11 agents. chain-patterns Pattern 9 documents nested delegation up
to three levels deep, and several agent bodies instruct the agent to hand a sub-question to a
specialist. Zero references to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` anywhere in src or manifests.

AFTER
Either the skills that genuinely need depth set the environment variable and own the cost, or the
grants and the prose that assumes nesting are removed in favour of a flat, lead-driven fan-out.

MECHANISM
Claude Code 2.1.217: "Changed subagents to no longer spawn nested subagents by default; set
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to allow deeper nesting." The same release added a default
cap of 20 concurrently-running subagents.

A tool grant is permission, not capability. The runtime now refuses the nested spawn regardless of
the grant. So the 13 grants are inert: they cost frontmatter tokens on every spawn and buy nothing.
Worse, the prose that tells an agent to delegate is now instructing it to attempt something the
runtime will refuse, which degrades into the agent guessing inline instead, the exact outcome the
delegation was designed to prevent.

WHY FLAT IS USUALLY RIGHT ANYWAY
The parallel teammates a lead spawns already are the fan-out. Depth buys specialisation, not
throughput, and it multiplies cost geometrically. ork already caps its own fan-out at 6 to 12, well
under the new ceiling of 20, so flat fan-out has headroom that depth does not.

---

## 3. One hook consumes 87 percent of all hook time

BEFORE, measured not estimated
From 202,229 records parsed out of a 207 MB `hook-timing.jsonl` with zero parse failures:

stop/security-scan-aggregator: 765 calls, mean 19,149 ms, p95 50,122 ms, max 159,640 ms, total
14,649 seconds. Its declared budget in hooks.json is `timeout: 10`, in seconds.
posttool/commit-nudge: 12,278 calls, mean 114 ms, total 1,402 seconds.
lifecycle/webhook-forwarder: 20,705 calls, mean 25 ms, total 511 seconds.

AFTER
The aggregator finishes inside its declared budget, or the budget is raised to match the real
distribution and the heavy work moves off the Stop path.

MECHANISM
The Stop event fires at the end of a turn. Work placed there is paid at the moment the user is
waiting for the session to settle, which is the most expensive place in the session to be slow. A
p95 of 50 seconds against a declared 10 second budget is a 5x overrun; the 160 second maximum is a
16x overrun. The declared timeout is not enforcement, it is documentation, and here the
documentation is wrong by an order of magnitude.

The correct sequence is: profile which scanner inside the aggregator dominates, then decide. Raising
the timeout first would merely legitimise a 50 second stall.

---

## 4. Two deny rules that can never match

BEFORE
`src/settings/ork.settings.json` lines 40 and 41 deny `Bash(find:*-delete*)` and
`Bash(find:*-fprint*)`. Lines 50 and 51 deny `Bash(> /dev/sd*)` and a literal fork bomb.

AFTER
The rules match the shapes real commands actually take, or they are deleted so the security posture
is honest about what it does not cover.

MECHANISM
Permission rules match against the literal command string. No real invocation begins with the
characters `find:`. A user typing `find . -name '*.tmp' -delete` produces a string that starts
`find ` with a space, so the rule never fires. The consequence: that command is not blocked, and the
settings file reads as though it is.

The `> /dev/sd*` rule depends on the redirect appearing in a specific position, and the fork-bomb
literal misses on any whitespace variation. These are silent no-ops that present as protection,
which is worse than an absent rule because it suppresses the instinct to add a real one.

IMPORTANT FRAMING
OrchestKit's permission layer is a policy and guardrail layer, not a containment boundary. These
rules are meant to catch mistakes, not to stop an adversary. Fixing them raises the floor on
accidents. It does not make the layer a sandbox, and it should not be described as one.

---

## 5. A shipped instruction users cannot follow

BEFORE
`src/hooks/src/lifecycle/analytics-consent-check.ts` line 109 and line 124 both tell the user to run
`/ork:feedback opt-in`. The feedback skill declares `user-invocable: false` and
`disable-model-invocation: true`.

AFTER
Either the skill becomes invocable, or the hook text names a path that exists.

MECHANISM
A skill is reachable by exactly two routes: a user typing its slash command, which requires
`user-invocable: true`, or the model choosing it, which requires that `disable-model-invocation` is
not true. The feedback skill closes both doors. The command in the consent message therefore does
not exist. A user who wants to grant analytics consent, follows the instruction, and is told the
command is unknown, will reasonably conclude the whole consent mechanism is broken.

The cheap fix is the hook string, not the frontmatter. Flipping `user-invocable` adds to the
per-session token cost that a previous pull request was reverted over.

---

## 6. Why all of the above survived: three missing guardrails

BEFORE
`tests/agents/` contains 15 validators. Not one checks a declared tool name against a known
vocabulary. The hook-id invariant test scans SKILL.md only, and only ids prefixed `skill/`, leaving
13 agent-frontmatter hook ids unguarded. The 500-line SKILL.md limit is honour-system.

AFTER
A tool-name allowlist fails CI on any unknown tool. One invariant test covers all three dispatch
surfaces. A line-count test enforces the documented limit.

MECHANISM AND EVIDENCE
`MultiEdit` is not in the live tool surface and not in the deferred registry, yet it is granted in
`tools:` by five agents and treated as real in three infrastructure files: tool-categories.ts line
49, test-agent-model-tool-correlation.sh line 75, static-analysis.sh line 201. It survived precisely
because nothing validates tool names. This is the highest-leverage item in the whole plan: it
converts a recurring class of defect into a one-time fix, and every other dead-tool finding here is
a symptom of its absence.

On the hook registry: it has three dispatch surfaces, not one. 150 entries in hooks.json, 45 in
agent frontmatter, 22 in skill frontmatter, totalling 217. An audit that joins only hooks.json
against the entries map produces 91 false positives. The sweeping agent hit exactly that, noticed
the implausible result, and re-ran with the correct three-surface join, which then came back clean
in both directions. That correction is itself the lesson: an audit that returns a suspiciously large
number of failures is usually measuring the wrong thing.

---

## 7. Token cost: dead conditionals in the hottest files

BEFORE
433 mentions of Claude Code versions below the 2.1.206 support floor across 63 of 114 skill bodies.
1,566 including reference files. Concentrated in the largest and most frequently loaded skills:
setup 31, implement 29, configure 29, brainstorm 27, help 21.

AFTER
Every gate below the floor is deleted and its guidance stated unconditionally.

MECHANISM
A line reading "Tip (CC 2.1.69+): do X" is a conditional whose condition is always true, because the
supported floor is 2.1.206. The reader, human or model, pays to read the condition and then pays
again to evaluate it. Removing the gate does not remove the guidance; it removes the ceremony around
it. This also drags implement, cover and brainstorm back under the 500-line limit, which is why the
line-count gate must land after this cleanup rather than before.

---

## 8. Two findings that did not survive verification

Recorded here because a discarded finding that is not written down gets re-raised next quarter.

REFUTED: "review-pr and explore advertise parallel agents but define zero spawns."
The sweeping agent searched SKILL.md and references/ and stopped. Searching the whole tree,
including rules/, returns 21 `subagent_type` hits for review-pr and 22 for explore. The spawns exist.

DOWNGRADED: "security-auditor instructs a spawn it cannot perform."
Line 89 reads "Spawn all four in ONE message". Reading lines 85 to 92, the four things are
`npm audit`, `pip-audit`, and a secrets grep. They are parallel Bash calls, not agent spawns. No
Agent grant is required and nothing is broken.

---

## 9. What was checked and came back genuinely clean

Stating these matters, because "we looked and found nothing" is a different and more valuable claim
than "we did not look".

Dead Team tool usage. Empty tools arrays. Dangling skill references. Stale or nonexistent model IDs.
Fable pins, meaning premium spend. Broken subagent_type names. Dead-dispatch in both directions.
Orphan handler files. Hyphenated matchers. Manifest and documentation count drift. The 2.1.207
`${user_config.*}` breaking change. Path-scoped permission rules from the 2.1.210 and 2.1.214
tightening. Agent names containing a colon, rejected in 2.1.218, where all 36 ork agents use bare
names.

---

## 10. The four corrective rules

1. Declare execution intent explicitly. Every fork skill states background true or false. Never rely
   on a scheduler default that can move under you.
2. Spawn depth is a budget, not a capability. Either own the cost explicitly or fan out flat.
3. Effort tiers the fan-out, not the prose. Heavy skills read CLAUDE_EFFORT and scale agent count.
   Only 4 of 114 skills do this today, and the five most expensive skills are not among them.
4. Background implies a merge contract. No agent may both mutate files and run backgrounded inside
   an isolated worktree unless the spawning skill merges the branch back. Seven agents currently
   violate this, and release-engineer is the sharpest case: it cuts a release into a worktree the
   operator never sees.

---
---

# לפני ואחרי: המנגנון מאחורי כל ממצא

המסמך הזה הוא הנספח הטכני לביקורת. לכל ממצא מתואר המצב שנמדד לפני, מצב היעד אחרי, והכי חשוב: המנגנון, כלומר למה זמן הריצה מתנהג ככה, כדי שהתיקון יהיה מובן ולא מועתק.

תאריך הביקורת 2026-07-23. גרסת Claude Code שרצה בפועל: 2.1.218. גרסת OrchestKit: 8.84.4.

## 0. המסגרת: פער במודל התזמון, לא רשימת באגים

OrchestKit נכתב מול גרסה של Claude Code שתזמנה עבודה בצורה מסוימת. בין 2.1.217 ל 2.1.218 זמן הריצה שינה את האופן שבו הוא מתזמן מיומנויות מפוצלות וסוכנים מקוננים. ההצהרות של ork לא זזו יחד איתו. כל ממצא בחומרה גבוהה למטה הוא תוצאה של הפער הזה.

המודל המנטלי השימושי: ה frontmatter של ork הוא חוזה מול המתזמן. כשהמתזמן משנה ברירת מחדל, כל חוזה שהסתמך על ברירת מחדל לא מפורשת משנה משמעות בשקט. אף אחד מאלה אינו שגיאת תחביר. כולם עדיין נפרסים תקין. בדיוק בגלל זה שום בדיקה לא תפסה אותם.

## 1. מיומנויות מפוצלות רצות עכשיו ברקע

לפני: 78 מתוך 114 מיומנויות מצהירות context: fork ב frontmatter. אף אחת לא מצהירה background. הכותבים התייחסו ל context: fork כאל הרצה בחלון הקשר נקי שלא מזהם את התמלול של ההורה, וזו אכן היתה המשמעות כשהשורות נכתבו.

אחרי: כל מיומנות מפוצלת מצהירה במפורש על כוונת ההרצה שלה. מיומנויות אינטראקטיביות מצהירות background: false. מיומנויות שמפיקות דוח מצהירות background: true. שום דבר לא מסתמך על ברירת המחדל.

המנגנון: גרסה 2.1.218 שינתה את ברירת המחדל, כך שמיומנות עם context: fork רצה ברקע אלא אם מבטלים זאת עם background: false. מיומנות שרצה ברקע לא מחזיקה את התור הקדמי. כל דבר שהיא מציגה לבן אדם, בורר שאלה, פסק דין, דיף לאישור, מיוצר במקום שהמשתמש לא מסתכל בו. המיומנות עדיין רצה, עדיין מצליחה, ועדיין מחזירה. היא פשוט מחזירה לערוץ שאף אחד לא קורא.

בגלל זה הכשל מסוכן: זו לא קריסה, זו העתקה שקטה של הפלט למקום אחר.

היקף מדוד: פיצול 78 המיומנויות לפי נתיב ההפעלה ולא ספירה שלהן כגוש אחד מראה ש 39 הן slash-only, כלומר disable-model-invocation: true, ו 39 נשארות ניתנות להפעלה על ידי המודל. הקבוצה השנייה היא קבוצת הסיכון האמיתית והיא כוללת את assess, cover, expect, explore, fix-issue, review-pr, verify, design-ship.

מגבלה כנה: במהלך הביקורת הזו הופעלה ork:brainstorm. היא נושאת context: fork, לא מצהירה background, והיא רצה בחזית על 2.1.218. היא גם slash-only. לכן הראיות תומכות בקביעה שהתצורה לא מוגנת, ולא תומכות עדיין בקביעה שכל 78 מעתיקות את הפלט שלהן. זהו פער תצורה מאומת עם סימפטום ריצה לא מאומת. התיקון זול והעמימות לא שווה שימור.

## 2. ייצור סוכנים מקוננים כבוי כברירת מחדל

לפני: 13 הרשאות Agent(ork:*) על פני 11 סוכנים, ותיעוד של האצלה מקוננת עד שלוש רמות. אפס אזכורים למשתנה הסביבה CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH בכל הקוד.

אחרי: או שהמיומנויות שבאמת צריכות עומק מגדירות את משתנה הסביבה ולוקחות אחריות על העלות, או שההרשאות והטקסט שמניח קינון מוסרים לטובת פיזור שטוח שמנוהל על ידי המוביל.

המנגנון: גרסה 2.1.217 קבעה שסוכני משנה לא מייצרים עוד סוכני משנה מקוננים כברירת מחדל, ובאותה גרסה נוסף תקרה של 20 סוכנים במקביל. הרשאת כלי היא רשות, לא יכולת. זמן הריצה מסרב עכשיו לייצור המקונן בלי קשר להרשאה. לכן 13 ההרשאות מתות: הן עולות טוקנים בכל ייצור סוכן ולא קונות כלום. גרוע מזה, הטקסט שמורה לסוכן להאציל מורה לו עכשיו לנסות פעולה שזמן הריצה יסרב לה, וזה מתדרדר לכך שהסוכן מנחש לבד, בדיוק התוצאה שההאצלה נועדה למנוע.

למה שטוח בדרך כלל נכון ממילא: הסוכנים המקבילים שהמוביל מייצר הם כבר הפיזור. עומק קונה התמחות, לא תפוקה, והוא מכפיל עלות בצורה גיאומטרית. ork ממילא מגביל את הפיזור שלו ל 6 עד 12, הרבה מתחת לתקרה החדשה.

## 3. הוק אחד צורך 87 אחוז מכל זמן ההוקים

לפני, נמדד ולא הוערך: מתוך 202,229 רשומות שנפרסו מקובץ בגודל 207 מגה בייט, בלי כשלי פרסור, ההוק stop/security-scan-aggregator רץ 765 פעמים, ממוצע 19,149 מילישניות, אחוזון 95 עומד על 50,122 מילישניות, מקסימום 159,640 מילישניות, ובסך הכל 14,649 שניות. התקציב המוצהר שלו הוא 10 שניות.

אחרי: ההוק מסיים בתוך התקציב המוצהר שלו, או שהתקציב מותאם להתפלגות האמיתית והעבודה הכבדה יוצאת מאירוע הסיום.

המנגנון: אירוע ה Stop נורה בסוף תור. עבודה שממוקמת שם משולמת בדיוק ברגע שהמשתמש מחכה שהסשן ייסגר, שזה המקום היקר ביותר בסשן להיות איטי בו. אחוזון 95 של 50 שניות מול תקציב מוצהר של 10 שניות הוא חריגה פי 5, והמקסימום הוא חריגה פי 16. התקציב המוצהר אינו אכיפה אלא תיעוד, וכאן התיעוד שגוי בסדר גודל. הרצף הנכון הוא קודם למדוד איזה סורק בתוך המצרף דומיננטי, ורק אז להחליט. העלאת התקציב קודם רק תכשיר עצירה של 50 שניות.

## 4. שני כללי חסימה שלא יכולים להתאים לעולם

לפני: קובץ ההגדרות חוסם בשורות 40 ו 41 את התבניות find:*-delete* ו find:*-fprint*.

אחרי: הכללים מתאימים לצורה שפקודות אמיתיות באמת לובשות, או שהם נמחקים כדי שתנוחת האבטחה תהיה כנה לגבי מה שהיא לא מכסה.

המנגנון: כללי הרשאה מותאמים מול מחרוזת הפקודה המילולית. שום הפעלה אמיתית לא מתחילה בתווים find עם נקודתיים. משתמש שמקליד find נקודה עם name ועם delete מייצר מחרוזת שמתחילה ב find ורווח, ולכן הכלל לעולם לא נורה. התוצאה: הפקודה הזו אינה חסומה, וקובץ ההגדרות נקרא כאילו היא כן.

מסגור חשוב: שכבת ההרשאות של OrchestKit היא שכבת מדיניות ומעקות בטיחות, לא גבול הכלה. הכללים נועדו לתפוס טעויות, לא לעצור יריב. תיקונם מעלה את הרצפה על תאונות. הוא לא הופך את השכבה לארגז חול ואין לתאר אותה ככזו.

## 5. הוראה שנשלחה למשתמשים ואי אפשר לבצע אותה

לפני: קובץ ההוק של בדיקת ההסכמה לאנליטיקה אומר למשתמש בשתי שורות נפרדות להריץ את הפקודה ork:feedback opt-in. מיומנות ה feedback מצהירה user-invocable: false וגם disable-model-invocation: true.

אחרי: או שהמיומנות הופכת לניתנת להפעלה, או שטקסט ההוק מפנה לנתיב שקיים.

המנגנון: מיומנות נגישה בשני מסלולים בלבד, הקלדת פקודת הלוכסן על ידי המשתמש, שדורשת user-invocable אמת, או בחירה של המודל, שדורשת ש disable-model-invocation אינו אמת. מיומנות ה feedback סוגרת את שתי הדלתות, ולכן הפקודה אינה קיימת. משתמש שירצה לאשר אנליטיקה, יבצע את ההוראה, ויקבל שהפקודה לא מוכרת, יסיק בצדק שכל מנגנון ההסכמה שבור. התיקון הזול הוא מחרוזת ההוק ולא ה frontmatter.

## 6. למה כל זה שרד: שלושה מעקות חסרים

לפני: תיקיית בדיקות הסוכנים מכילה 15 מאמתים, ואף אחד מהם לא בודק שם כלי מול אוצר מילים ידוע. בדיקת האינווריאנטה של מזהי ההוקים סורקת רק קבצי SKILL.md ורק מזהים עם קידומת skill, ולכן 13 מזהי הוקים בצד הסוכנים אינם מוגנים. מגבלת 500 השורות היא מגבלת כבוד בלבד.

המנגנון והראיה: הכלי MultiEdit אינו קיים לא במשטח הכלים החי ולא ברישום הנדחה, ובכל זאת הוא מוענק בחמישה סוכנים ומטופל כאמיתי בשלושה קבצי תשתית. הוא שרד בדיוק מפני ששום דבר לא מאמת שמות כלים. זהו הפריט בעל המנוף הגבוה ביותר בכל התוכנית, כי הוא הופך מחלקה חוזרת של תקלות לתיקון חד פעמי.

לגבי רישום ההוקים: יש לו שלושה משטחי שיגור ולא אחד. 150 רשומות בקובץ ההוקים, 45 ב frontmatter של סוכנים, ו 22 ב frontmatter של מיומנויות, ובסך הכל 217. ביקורת שמצליבה רק את קובץ ההוקים מול מפת הכניסות מייצרת 91 התראות שווא. הסוכן הסורק נתקל בדיוק בזה, שם לב שהתוצאה לא סבירה, והריץ מחדש עם ההצלבה הנכונה, שחזרה נקייה בשני הכיוונים. התיקון הזה הוא עצמו הלקח: ביקורת שמחזירה מספר חשוד של כשלים בדרך כלל מודדת את הדבר הלא נכון.

## 7. עלות טוקנים: תנאים מתים בקבצים החמים ביותר

לפני: 433 אזכורים של גרסאות מתחת לרצפת התמיכה 2.1.206, ב 63 מתוך 114 גופי מיומנויות, ו 1,566 כולל קבצי הפניה. הריכוז הגבוה ביותר הוא דווקא במיומנויות הגדולות והנטענות ביותר.

אחרי: כל תנאי מתחת לרצפה נמחק וההנחיה נאמרת ללא תנאי.

המנגנון: שורה שאומרת טיפ לגרסה מסוימת ומעלה היא תנאי שתמיד מתקיים, כי הרצפה הנתמכת גבוהה ממנו. הקורא, אדם או מודל, משלם כדי לקרוא את התנאי ואז משלם שוב כדי להעריך אותו. הסרת התנאי לא מסירה את ההנחיה, היא מסירה את הטקס סביבה. זה גם מחזיר שלוש מיומנויות אל מתחת למגבלת 500 השורות, ולכן שער ספירת השורות חייב לנחות אחרי הניקוי ולא לפניו.

## 8. שני ממצאים שלא שרדו אימות

מתועדים כאן כי ממצא שנפסל ולא נכתב חוזר לעלות ברבעון הבא.

נדחה: הטענה ש review-pr ו explore מפרסמות סוכנים מקבילים אך לא מגדירות אף ייצור. הסוכן הסורק חיפש רק בקובץ הראשי ובתיקיית ההפניות ועצר. חיפוש בכל העץ, כולל תיקיית הכללים, מחזיר 21 התאמות עבור review-pr ו 22 עבור explore. הייצורים קיימים.

הופחת: הטענה ש security-auditor מורה על ייצור שאינו יכול לבצע. קריאת השורות סביב מראה שארבעת הדברים הם פקודות מעטפת מקבילות, לא סוכנים. שום דבר לא שבור.

## 9. מה נבדק וחזר נקי באמת

אמירת הדברים האלה חשובה, כי בדקנו ולא מצאנו היא טענה שונה ובעלת ערך גבוה יותר מאשר לא בדקנו.

כלי צוות מתים. מערכי כלים ריקים. הפניות מיומנות תלושות. מזהי מודל מיושנים או לא קיימים. הצמדות למודל פרימיום. שמות סוכן שבורים בייצור. שיגור מת בשני הכיוונים. קבצי מטפל יתומים. התאמות עם מקף. סטיית ספירה במניפסטים ובתיעוד. שינוי שובר ההרשאות מגרסה 2.1.207. כללי הרשאה מבוססי נתיב. שמות סוכן עם נקודתיים, שנדחים מגרסה 2.1.218, כאשר כל 36 הסוכנים משתמשים בשמות פשוטים.

## 10. ארבעת כללי התיקון

ראשית, להצהיר על כוונת הרצה במפורש. כל מיומנות מפוצלת קובעת background אמת או שקר ולא מסתמכת על ברירת מחדל שיכולה לזוז.

שנית, עומק ייצור הוא תקציב ולא יכולת. או שלוקחים אחריות מפורשת על העלות, או שמפזרים שטוח.

שלישית, מאמץ מדרג את הפיזור ולא את הטקסט. מיומנויות כבדות קוראות את משתנה המאמץ ומדרגות את מספר הסוכנים. רק 4 מתוך 114 עושות זאת היום, וחמש המיומנויות היקרות ביותר אינן ביניהן.

רביעית, רקע מחייב חוזה מיזוג. אסור לסוכן גם לשנות קבצים וגם לרוץ ברקע בתוך עץ עבודה מבודד, אלא אם המיומנות שמייצרת אותו ממזגת את הענף בחזרה. שבעה סוכנים מפרים זאת כרגע, והחד ביותר הוא release-engineer, שחותך גרסה לתוך עץ עבודה שהמפעיל לעולם לא רואה.
