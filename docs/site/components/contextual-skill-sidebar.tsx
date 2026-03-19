"use client";

import { useMemo } from "react";
import Link from "next/link";
import { SKILLS } from "@/lib/generated/skills-data";

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface Props {
  slug: string;
}

export function ContextualSkillSidebar({ slug }: Props) {
  const skill = SKILLS[slug];

  const { usedBy, related } = useMemo(() => {
    if (!skill) return { usedBy: [], related: [] };

    // Reverse dependency: which skills list this one in their skills[]
    const usedByList = Object.entries(SKILLS)
      .filter(([, s]) => s.skills.includes(slug))
      .map(([name]) => name)
      .sort();

    // Same-tag skills: find skills with overlapping tags (exclude self and deps)
    const myTags = new Set(skill.tags);
    const exclude = new Set([slug, ...skill.skills, ...usedByList]);
    const scored = Object.entries(SKILLS)
      .filter(([name]) => !exclude.has(name))
      .map(([name, s]) => ({
        name,
        overlap: s.tags.filter((t) => myTags.has(t)).length,
      }))
      .filter((s) => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 5)
      .map((s) => s.name);

    return { usedBy: usedByList, related: scored };
  }, [skill, slug]);

  if (!skill) return null;

  const hasDeps = skill.skills.length > 0;
  const hasUsedBy = usedBy.length > 0;
  const hasAgent = !!skill.agent;
  const hasRelated = related.length > 0;

  if (!hasDeps && !hasUsedBy && !hasAgent && !hasRelated) return null;

  return (
    <div className="not-prose mb-6 rounded-lg border border-fd-border bg-fd-card p-4 text-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
        Connections
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {hasDeps && (
          <Section title="Depends on" items={skill.skills} />
        )}
        {hasUsedBy && (
          <Section title="Used by" items={usedBy} />
        )}
        {hasAgent && (
          <div>
            <div className="mb-1 text-xs font-medium text-fd-muted-foreground">
              Agent
            </div>
            <Link
              href={`/docs/reference/agents/${skill.agent}`}
              className="text-fd-primary hover:underline"
            >
              {titleCase(skill.agent!)}
            </Link>
          </div>
        )}
        {hasRelated && (
          <Section title="Related" items={related} />
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-fd-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((name) => (
          <Link
            key={name}
            href={`/docs/reference/skills/${name}`}
            className="inline-block rounded-md border border-fd-border bg-fd-secondary px-2 py-0.5 text-xs text-fd-secondary-foreground transition-colors hover:border-fd-primary hover:text-fd-primary"
          >
            {titleCase(name)}
          </Link>
        ))}
      </div>
    </div>
  );
}
