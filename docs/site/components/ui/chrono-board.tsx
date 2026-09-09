import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import type { ChronoBoardCardModel, ChronoTone } from "@/lib/chrono-board-release";

/**
 * Chrono Board — 21st.dev `dhileepkumargm/chrono-board` (demo 9216), adapted.
 * Timeline rail, status-cued cards, and two hover/focus actions. Slate/green
 * demo chrome is replaced with fd-* / George tokens. Wired to OrchestKit
 * release data by the caller — this file does not invent activity.
 */

function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}

const TONE_NODE: Record<ChronoTone, string> = {
  live: "bg-[var(--color-fd-primary-20)] text-fd-primary",
  added: "bg-[var(--color-fd-primary-20)] text-fd-primary",
  fixed: "bg-fd-muted text-[var(--yy-george-cool-text)]",
  changed: "bg-fd-muted text-fd-foreground",
  removed: "bg-fd-muted text-fd-error",
  deprecated: "bg-fd-muted text-[var(--yy-george-warm-text)]",
  security: "border border-fd-error/40 bg-fd-muted text-fd-error",
};

const TONE_PILL: Record<ChronoTone, string> = {
  live: "bg-[var(--color-fd-primary-20)] text-fd-primary",
  added: "bg-[var(--color-fd-primary-10)] text-fd-primary",
  fixed: "bg-fd-muted text-[var(--yy-george-cool-text)]",
  changed: "bg-fd-muted text-fd-foreground",
  removed: "bg-fd-muted text-fd-error",
  deprecated: "bg-fd-muted text-[var(--yy-george-warm-text)]",
  security: "border border-fd-error/40 bg-fd-muted text-fd-error",
};

const TONE_ICON: Record<ChronoTone, typeof Zap> = {
  live: CheckCircle2,
  added: Zap,
  fixed: CheckCircle2,
  changed: RefreshCw,
  removed: XCircle,
  deprecated: AlertTriangle,
  security: ShieldAlert,
};

export function DisplayCard({
  title,
  description,
  date,
  status,
  tone,
  active = false,
  notesHref,
  diffHref,
  showRail,
}: ChronoBoardCardModel & { showRail: boolean }) {
  const Icon = TONE_ICON[tone];

  return (
    <article
      className="group/card relative flex items-start gap-x-4"
      aria-current={active ? "true" : undefined}
    >
      {showRail ? (
        <div
          aria-hidden="true"
          className="absolute left-[11px] top-6 h-full w-px bg-fd-border"
        />
      ) : null}

      <span
        className={cn(
          "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          TONE_NODE[tone],
        )}
        aria-hidden="true"
      >
        <Icon className="h-3 w-3" />
      </span>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border p-4 motion-reduce:transition-none",
          active
            ? "border-fd-primary/40 bg-[var(--color-fd-surface-raised)] shadow-[0_0_0_4px_var(--color-fd-glow)]"
            : "border-transparent group-hover/card:border-fd-border group-hover/card:bg-[var(--color-fd-surface-raised)] group-focus-within/card:border-fd-border",
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold tracking-[-0.01em] text-fd-foreground">
            {title}
          </h3>
          {date ? (
            <time className="font-mono text-[11px] text-fd-muted-foreground">
              {date}
            </time>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] leading-[1.55] text-fd-muted-foreground">
          {description}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              TONE_PILL[tone],
            )}
          >
            {status}
          </span>
          <div
            className={cn(
              "flex items-center gap-2 opacity-0 transition-opacity duration-200",
              "group-hover/card:opacity-100 group-focus-within/card:opacity-100",
              "motion-reduce:opacity-100 motion-reduce:transition-none",
            )}
          >
            <a
              href={notesHref}
              aria-label={`Release notes for ${title}`}
              className="rounded-md bg-fd-muted px-3 py-1 text-[12px] text-fd-foreground transition-colors hover:text-fd-primary"
            >
              Notes
            </a>
            {diffHref ? (
              <a
                href={diffHref}
                aria-label={`Diff for ${title}`}
                target={diffHref.startsWith("http") ? "_blank" : undefined}
                rel={diffHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className="rounded-md bg-fd-muted px-3 py-1 text-[12px] text-fd-foreground transition-colors hover:text-fd-primary"
              >
                Diff
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function DisplayCards({ cards }: { cards: ChronoBoardCardModel[] }) {
  return (
    <ol className="relative w-full space-y-4">
      {cards.map((card, index) => (
        <li key={card.id}>
          <DisplayCard {...card} showRail={index < cards.length - 1} />
        </li>
      ))}
    </ol>
  );
}

export function ChronoBoard({
  cards,
  labelledBy,
  caption,
}: {
  cards: ChronoBoardCardModel[];
  labelledBy?: string;
  caption?: ReactNode;
}) {
  if (cards.length === 0) return null;

  return (
    <div
      className="relative w-full"
      aria-labelledby={labelledBy}
    >
      {caption}
      <DisplayCards cards={cards} />
    </div>
  );
}
