import Link from "next/link";
import { SKILLS } from "@/lib/generated/skills-data";
import { CopyInvocationChip } from "./copy-invocation-chip";

/**
 * Skill Dossier — server-rendered anatomy strip for skill reference pages.
 *
 * Surfaces the structured data behind a skill (from lib/generated/skills-data):
 * hero (name, one-line pitch, complexity meter, /ork:<name> invocation chip),
 * Use-when / Don't-use-when guidance parsed from the description, and a
 * Relationships row (wired agents, dependency / used-by / related skills).
 *
 * Brand mapping: amber (george-warm) = active/attention accents,
 * ice (george-cool) = metadata, indigo (fd-primary) = links.
 * When a george token is used AS TEXT, the -text variant is required
 * (theme-aware, WCAG AA in light mode); the base tokens are
 * icon/border/marker scale only.
 * Everything except the copy button is server-rendered — no layout shift.
 */

const COMPLEXITY_SEGMENTS: Record<string, number> = {
  simple: 1,
  low: 2,
  medium: 3,
  high: 4,
  complex: 5,
  max: 5,
};

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface ParsedDescription {
  pitch: string;
  useWhen: string | null;
  dontUseWhen: string | null;
}

/**
 * Conservative parse of the generated skill description.
 * Positive guidance starts at "Use when" / "Use after" / "Triggers on";
 * negative guidance at "Do NOT use" / "Don't use" / "Do not use" /
 * "NOT for" / "Skip ". If a marker is absent, that card is simply not
 * rendered — nothing is fabricated.
 */
function parseDescription(description: string): ParsedDescription {
  const useMatch = /(?:^|\s)(Use when|Use after|Triggers on)\b/.exec(
    description,
  );
  const dontMatch = /(?:^|\s)(Do NOT use|Do not use|Don't use|NOT for|Skip)\b/.exec(
    description,
  );

  const useStart = useMatch ? useMatch.index + (useMatch[0].startsWith(" ") ? 1 : 0) : -1;
  const dontStart = dontMatch
    ? dontMatch.index + (dontMatch[0].startsWith(" ") ? 1 : 0)
    : -1;

  const cut = [useStart, dontStart].filter((i) => i >= 0);
  const pitchEnd = cut.length > 0 ? Math.min(...cut) : description.length;
  // The page suppresses DocsDescription on skill pages, so the dossier is
  // the description's only home: keep the FULL text before the use-when
  // markers (nothing is lost, nothing renders twice).
  const pitch = description.slice(0, pitchEnd).trim() || description.trim();

  let useWhen: string | null = null;
  if (useStart >= 0) {
    const end = dontStart > useStart ? dontStart : description.length;
    useWhen = description.slice(useStart, end).trim();
  }

  let dontUseWhen: string | null = null;
  if (dontStart >= 0) {
    const end = useStart > dontStart ? useStart : description.length;
    dontUseWhen = description.slice(dontStart, end).trim();
  }

  return { pitch, useWhen, dontUseWhen };
}

function SkillChip({ name }: { name: string }) {
  return (
    <Link
      href={`/docs/reference/skills/${name}`}
      className="inline-block rounded-md border border-fd-border bg-fd-secondary px-2 py-0.5 text-xs text-fd-primary transition-colors hover:border-fd-primary hover:underline"
    >
      {titleCase(name)}
    </Link>
  );
}

function AgentChip({ name }: { name: string }) {
  return (
    <Link
      href={`/docs/reference/agents/${name}`}
      className="inline-block rounded-md border border-fd-border bg-fd-secondary px-2 py-0.5 text-xs text-fd-primary transition-colors hover:border-fd-primary hover:underline"
    >
      {titleCase(name)}
    </Link>
  );
}

function RelationshipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--yy-george-cool-text)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function SkillDossier({ slug }: { slug: string }) {
  const skill = SKILLS[slug];
  if (!skill) return null;

  const { pitch, useWhen, dontUseWhen } = parseDescription(skill.description);
  const segments = COMPLEXITY_SEGMENTS[skill.complexity] ?? null;

  const plugin = skill.plugins[0] ?? "ork";
  const invocation = `/${plugin}:${skill.name}`;

  // Agents wired to this skill: primary agent + generated relatedAgents.
  const agents = Array.from(
    new Set([...(skill.agent ? [skill.agent] : []), ...skill.relatedAgents]),
  );

  // Reverse dependency: skills that list this one in their skills[].
  const usedBy = Object.entries(SKILLS)
    .filter(([, s]) => s.skills.includes(slug))
    .map(([name]) => name)
    .sort();

  // Tag-overlap related skills (excluding self, deps, and dependents).
  const myTags = new Set(skill.tags);
  const exclude = new Set([slug, ...skill.skills, ...usedBy]);
  const related = Object.entries(SKILLS)
    .filter(([name]) => !exclude.has(name))
    .map(([name, s]) => ({
      name,
      overlap: s.tags.filter((t) => myTags.has(t)).length,
    }))
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map((s) => s.name);

  const hasRelationships =
    agents.length > 0 ||
    skill.skills.length > 0 ||
    usedBy.length > 0 ||
    related.length > 0;

  return (
    <section
      aria-label={`${titleCase(skill.name)} skill dossier`}
      className="not-prose mb-8 flex flex-col gap-4"
    >
      {/* Hero strip */}
      <div className="rounded-lg border border-fd-border bg-fd-card p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-fd-foreground">
            {titleCase(skill.name)}
          </span>
          {segments !== null && (
            <span
              className="inline-flex items-center gap-1"
              role="img"
              aria-label={`Complexity: ${skill.complexity} (${segments} of 5)`}
              title={`Complexity: ${skill.complexity}`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={
                    i < segments
                      ? "h-1.5 w-3.5 rounded-full bg-[var(--yy-george-warm)]"
                      : "h-1.5 w-3.5 rounded-full bg-fd-border"
                  }
                />
              ))}
              <span className="ml-1 text-[11px] uppercase tracking-wider text-[var(--yy-george-cool-text)]">
                {skill.complexity}
              </span>
            </span>
          )}
          {skill.userInvocable ? (
            <CopyInvocationChip invocation={invocation} />
          ) : (
            <span className="inline-flex items-center rounded-md border border-[var(--yy-george-cool)]/40 bg-[var(--yy-george-cool)]/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-fd-muted-foreground">
              Auto-activated
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-fd-muted-foreground">{pitch}</p>
        {skill.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full border border-[var(--yy-george-cool)]/30 px-2 py-0.5 text-[11px] text-fd-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Use-when / Don't-use-when — rendered only when derivable */}
      {(useWhen || dontUseWhen) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {useWhen && (
            <div className="rounded-lg border border-[var(--yy-george-warm)]/40 bg-[var(--yy-george-warm)]/5 p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--yy-george-warm-text)]">
                Use when
              </div>
              <p className="text-sm leading-relaxed text-fd-foreground/90">
                {useWhen}
              </p>
            </div>
          )}
          {dontUseWhen && (
            <div className="rounded-lg border border-fd-border bg-fd-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                Don&apos;t use when
              </div>
              <p className="text-sm leading-relaxed text-fd-muted-foreground">
                {dontUseWhen}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Relationships row */}
      {hasRelationships && (
        <div className="rounded-lg border border-fd-border bg-fd-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
            Relationships
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.length > 0 && (
              <RelationshipGroup label="Agents">
                {agents.map((a) => (
                  <AgentChip key={a} name={a} />
                ))}
              </RelationshipGroup>
            )}
            {skill.skills.length > 0 && (
              <RelationshipGroup label="Depends on">
                {skill.skills.map((s) => (
                  <SkillChip key={s} name={s} />
                ))}
              </RelationshipGroup>
            )}
            {usedBy.length > 0 && (
              <RelationshipGroup label="Used by">
                {usedBy.map((s) => (
                  <SkillChip key={s} name={s} />
                ))}
              </RelationshipGroup>
            )}
            {related.length > 0 && (
              <RelationshipGroup label="Related">
                {related.map((s) => (
                  <SkillChip key={s} name={s} />
                ))}
              </RelationshipGroup>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
