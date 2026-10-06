"use client";

// Interactive islands for /docs/guides/output-modes. Built against the
// operator-approved mockup at content/docs/guides/output-modes/approved-design/mockup.txt.
// The query string is the single source of truth for the picked mode, so the
// sections stay in sync without a shared store and a pick is a shareable link.

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import {
  AUDIENCES,
  SURFACES,
  buildFlag,
  buildJson,
  buildPrompt,
  modeToSearch,
  parseMode,
  type Audience,
  type Mode,
  type Surface,
} from "@/lib/output-modes";

const MODE_EVENT = "ork-output-mode";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(MODE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(MODE_EVENT, onChange);
  };
}

function useMode(): [Mode, (next: Mode) => void] {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const mode = useMemo(() => parseMode(search), [search]);
  const setMode = useCallback((next: Mode) => {
    const url = `${window.location.pathname}${modeToSearch(next)}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(MODE_EVENT));
  }, []);
  return [mode, setMode];
}

// ── The same answer, rendered per surface and audience ──────────────────────

const ANSWERS: Record<Surface, Record<Audience, string>> = {
  chat: {
    operator: `→ chat · operator

beta.160 ships after one docs fix.
🚀 RELEASE beta.160 · gates
[▓▓▓▓▓▓░░░] 2 of 3 green
✅ tests       412/412
✅ security    gitleaks clean
⚠️ docs build  search index exit 1`,
    novice: `→ chat · novice

Almost ready: 2 of 3 checks passed.
Like a pre-flight list: one check
failed, so the plane waits at the
gate until it is fixed.
[▓▓▓▓▓▓░░░] 2 of 3 checks
✅ the code works
✅ no secrets leaked
⚠️ the docs website did not build`,
  },
  ask: {
    operator: `→ ask · operator

Ship which way?
❯ 1. Ship now
     docs fix rides beta.161
  2. Wait for docs
     one fix, then ship
  3. Hold
     re-run every gate first
(the reply waits for a pick)`,
    novice: `→ ask · operator

Ship which way?
❯ 1. Ship now
  2. Wait for docs
  3. Hold
(you answer; then the pick is
explained in plain words:)
"You chose to wait. One fix to
the website, then it ships."`,
  },
  page: {
    operator: `→ page · operator

┌ ○ ○ ○ ── release-160.localhost ┐
│ beta.160: ship after docs fix │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ 412 │ │  0  │ │  1  │       │
│ │tests│ │leaks│ │ red │       │
│ └─────┘ └─────┘ └─────┘       │
│ ▓▓▓▓▓▓░░░ gates over time      │
│ ▸ raw evidence (folded)        │
└────────────────────────────────┘`,
    novice: `→ page · novice

┌ ○ ○ ○ ── release-160.localhost ┐
│ Is the new version ready?      │
│ 1. Three safety checks         │
│ 2. Two passed (picture)        │
│ 3. One failed: the website     │
│ ┌ What it means ┐┌ If ignored ┐│
│ │ one fix left  ││ broken docs ││
│ └───────────────┘└─────────────┘│
└────────────────────────────────┘`,
  },
};

const SIGNOFF_WITHOUT = `… verdict, evidence.
✅ 3 of 3 checks passed.

(the reply ends here;
you judge it yourself)`;

const SIGNOFF_WITH = `✅ 3 of 3 checks passed.

Sign-off: Accept as done?
❯ 1. Accept done
  2. Show me the evidence
  3. Not satisfied`;

const SURFACE_NOTE: Record<Surface, string> = {
  chat: "inline, one render up to about 50 lines",
  ask: "2 to 4 options; the reply waits for a pick",
  page: "a served URL that persists",
};

// ── Shared bits ─────────────────────────────────────────────────────────────

function Panel({
  title,
  body,
  active,
  note,
}: {
  title: string;
  body: string;
  active: boolean;
  note?: string;
}) {
  return (
    <figure
      className={`m-0 flex min-w-0 flex-col rounded-lg bg-fd-card transition-opacity ${
        active ? "border-2 border-fd-primary" : "border border-fd-border opacity-60"
      }`}
      aria-current={active ? "true" : undefined}
    >
      <figcaption className="flex items-center justify-between border-b border-fd-border px-3 py-1.5 font-mono text-xs font-semibold">
        <span>{title}</span>
        {active ? <span className="text-fd-primary">your pick</span> : null}
      </figcaption>
      <pre className="m-0 flex-1 overflow-x-auto whitespace-pre bg-transparent p-3 font-mono text-[11px] leading-snug">
        {body}
      </pre>
      {note ? <p className="m-0 px-3 pb-2 text-xs text-fd-muted-foreground">{note}</p> : null}
    </figure>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const onCopy = () => {
    const showFallback = () => {
      setState("manual");
      requestAnimationFrame(() => fallbackRef.current?.select());
    };
    if (!navigator.clipboard) {
      showFallback();
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
      },
      showFallback,
    );
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm font-medium hover:border-fd-primary"
      >
        {state === "copied" ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span aria-live="polite">{state === "copied" ? "Copied" : label}</span>
      </button>
      {state === "manual" ? (
        <label className="text-xs text-fd-muted-foreground">
          The browser blocked the clipboard. The text is selected: press Cmd+C (Ctrl+C).
          <textarea
            ref={fallbackRef}
            readOnly
            value={text}
            rows={3}
            className="mt-1 block w-full rounded border border-fd-border bg-fd-background p-2 font-mono text-xs"
          />
        </label>
      ) : null}
    </span>
  );
}

function RadioRow<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  hint?: Partial<Record<T, string>>;
}) {
  return (
    <fieldset className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 border-0 p-0">
      <legend className="float-left mr-4 w-20 font-mono text-sm text-fd-muted-foreground">
        {legend}
      </legend>
      {options.map((opt) => (
        <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4 accent-[var(--color-fd-primary)]"
          />
          <span className="font-medium">{opt}</span>
          {hint?.[opt] ? (
            <code className="text-xs text-fd-muted-foreground">{hint[opt]}</code>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

// ── 01 Pick a mode ──────────────────────────────────────────────────────────

export function ModePicker() {
  const [mode, setMode] = useMode();
  const flag = buildFlag(mode);
  return (
    <div className="not-prose my-4 flex flex-col gap-3 rounded-lg border border-fd-border bg-fd-card p-4">
      <RadioRow
        legend="surface"
        name="om-surface"
        options={SURFACES}
        value={mode.surface}
        onChange={(surface) => setMode({ ...mode, surface })}
      />
      <RadioRow
        legend="audience"
        name="om-audience"
        options={AUDIENCES}
        value={mode.audience}
        onChange={(audience) => setMode({ ...mode, audience })}
        hint={{ novice: "--eli5" }}
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <span className="w-20 font-mono text-fd-muted-foreground">sign-off</span>
        <input
          type="checkbox"
          checked={mode.signoff}
          onChange={(e) => setMode({ ...mode, signoff: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-fd-primary)]"
        />
        <span>end with &ldquo;accept done?&rdquo;</span>
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <output
          aria-label="your flag"
          className="min-w-0 flex-1 rounded-md border border-fd-border bg-fd-background px-3 py-2 font-mono text-sm"
        >
          {flag}
        </output>
        <CopyButton text={flag} label="Copy flag" />
      </div>
    </div>
  );
}

// ── 02 One answer, three surfaces ───────────────────────────────────────────

export function SurfaceCompare() {
  const [mode] = useMode();
  return (
    <div className="not-prose my-4 grid gap-3 md:grid-cols-3">
      {SURFACES.map((s) => (
        <Panel
          key={s}
          title={s}
          body={ANSWERS[s][mode.audience]}
          active={mode.surface === s}
          note={SURFACE_NOTE[s]}
        />
      ))}
    </div>
  );
}

// ── 03 Audience ─────────────────────────────────────────────────────────────

export function AudienceCompare() {
  const [mode] = useMode();
  return (
    <div className="not-prose my-4 grid gap-3 md:grid-cols-2">
      {AUDIENCES.map((a) => (
        <Panel
          key={a}
          title={a === "novice" ? "novice (--eli5)" : "operator"}
          body={ANSWERS[mode.surface][a]}
          active={mode.audience === a}
        />
      ))}
    </div>
  );
}

// ── 04 Done sign-off ────────────────────────────────────────────────────────

export function SignoffCompare() {
  const [mode] = useMode();
  return (
    <div className="not-prose my-4 grid gap-3 md:grid-cols-2">
      <Panel title="without" body={SIGNOFF_WITHOUT} active={!mode.signoff} />
      <Panel title="with --signoff" body={SIGNOFF_WITH} active={mode.signoff} />
    </div>
  );
}

// ── 06 Copy as prompt ───────────────────────────────────────────────────────

export function CopyPrompt() {
  const [mode] = useMode();
  const prompt = buildPrompt(mode);
  const json = buildJson(mode);
  return (
    <div className="not-prose my-4 flex flex-col gap-3">
      <output
        aria-label="prompt"
        className="block rounded-md border border-fd-border bg-fd-card p-3 font-mono text-sm"
      >
        {prompt}
      </output>
      <div className="flex flex-wrap gap-3">
        <CopyButton text={prompt} label="Copy as prompt" />
        <CopyButton text={json} label="Copy JSON" />
      </div>
    </div>
  );
}
