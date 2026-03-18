"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SKILLS } from "@/lib/generated/skills-data";

// --- Quiz data -----------------------------------------------------------

interface Option {
  id: string;
  label: string;
  icon: string;
  tags: string[]; // matched against skill tags for scoring
}

interface Step {
  question: string;
  options: Option[];
}

const STEPS: Step[] = [
  {
    question: "What's your role?",
    options: [
      { id: "backend", label: "Backend Dev", icon: "</>", tags: ["rest", "fastapi", "database", "sqlalchemy", "postgresql", "graphql", "asyncio", "python", "api-design", "distributed-systems"] },
      { id: "frontend", label: "Frontend Dev", icon: "{ }", tags: ["react", "ui", "component", "design-tokens", "css", "animation", "responsive", "storybook", "zustand", "vite"] },
      { id: "ai", label: "AI Engineer", icon: "AI", tags: ["llm", "rag", "agent", "mcp", "embedding", "vector", "langgraph", "multimodal", "evaluation"] },
      { id: "devops", label: "DevOps", icon: "CI", tags: ["devops", "ci-cd", "docker", "kubernetes", "terraform", "monitoring", "observability", "deployment"] },
      { id: "qa", label: "QA / Testing", icon: "QA", tags: ["testing", "unit", "integration", "e2e", "playwright", "vitest", "jest", "pytest", "coverage", "mocking"] },
      { id: "product", label: "Product / PM", icon: "PM", tags: ["prd", "product", "roi", "persona", "market", "competitive", "okr", "prioritization", "user-research"] },
    ],
  },
  {
    question: "What are you working on?",
    options: [
      { id: "feature", label: "New Feature", icon: "+", tags: ["implementation", "feature", "full-stack", "workflow"] },
      { id: "bugfix", label: "Bug Fix", icon: "!", tags: ["debugging", "fix", "investigation", "error"] },
      { id: "review", label: "Code Review", icon: "PR", tags: ["review", "pr", "code-review", "quality"] },
      { id: "security", label: "Security Audit", icon: "S", tags: ["security", "owasp", "authentication", "pii", "vulnerability", "audit"] },
      { id: "planning", label: "Planning", icon: "P", tags: ["architecture", "planning", "brainstorm", "design", "prd", "requirements"] },
      { id: "testing", label: "Writing Tests", icon: "T", tags: ["testing", "unit", "integration", "e2e", "coverage", "mocking"] },
    ],
  },
  {
    question: "What stack?",
    options: [
      { id: "react", label: "React / Next.js", icon: "R", tags: ["react", "typescript", "next", "zustand", "vite", "storybook", "responsive"] },
      { id: "python", label: "Python / FastAPI", icon: "Py", tags: ["python", "fastapi", "sqlalchemy", "celery", "pytest", "asyncio"] },
      { id: "fullstack", label: "Full-Stack", icon: "FS", tags: ["react", "python", "typescript", "fastapi", "full-stack"] },
      { id: "any", label: "Language Agnostic", icon: "*", tags: [] },
    ],
  },
];

// --- Scoring --------------------------------------------------------------

function scoreSkills(selections: string[]) {
  const selectedOptions = STEPS.map(
    (step, i) => step.options.find((o) => o.id === selections[i])!
  ).filter(Boolean);

  const allTags = new Set(selectedOptions.flatMap((o) => o.tags));

  const scored = Object.entries(SKILLS).map(([key, skill]) => {
    let score = 0;
    const skillTags = new Set(skill.tags.map((t) => t.toLowerCase()));

    // Tag overlap with selected options
    for (const tag of allTags) {
      if (skillTags.has(tag)) score += 3;
    }

    // Bonus for user-invocable (actionable commands)
    if (skill.userInvocable) score += 2;

    // Bonus for skills with high dependency count (hub skills)
    if (skill.skills.length > 3) score += 1;

    return { key, skill, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// --- Component ------------------------------------------------------------

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function SkillRecommender() {
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<string[]>([]);

  const isComplete = step >= STEPS.length;

  const results = useMemo(() => {
    if (!isComplete) return [];
    return scoreSkills(selections);
  }, [isComplete, selections]);

  const commands = results.filter((r) => r.skill.userInvocable);
  const reference = results.filter((r) => !r.skill.userInvocable);

  function select(optionId: string) {
    const next = [...selections];
    next[step] = optionId;
    setSelections(next);
    setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function reset() {
    setStep(0);
    setSelections([]);
  }

  return (
    <div className="not-prose my-6 rounded-lg border border-fd-border bg-fd-card p-5">
      {/* Progress */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step
                ? "bg-fd-primary"
                : i === step && !isComplete
                  ? "bg-fd-primary/50"
                  : "bg-fd-muted"
            }`}
          />
        ))}
        <div
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            isComplete ? "bg-fd-primary" : "bg-fd-muted"
          }`}
        />
      </div>

      {!isComplete ? (
        <>
          {/* Question */}
          <h3 className="mb-4 text-lg font-semibold">
            {STEPS[step].question}
          </h3>

          {/* Options grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STEPS[step].options.map((option) => (
              <button
                key={option.id}
                onClick={() => select(option.id)}
                className={`group flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:border-fd-primary hover:bg-fd-primary/5 ${
                  selections[step] === option.id
                    ? "border-fd-primary bg-fd-primary/10"
                    : "border-fd-border"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fd-muted text-sm font-bold text-fd-muted-foreground group-hover:bg-fd-primary/20 group-hover:text-fd-primary">
                  {option.icon}
                </span>
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>

          {/* Back button */}
          {step > 0 && (
            <button
              onClick={back}
              className="mt-3 text-sm text-fd-muted-foreground hover:text-fd-foreground"
            >
              Back
            </button>
          )}
        </>
      ) : (
        <>
          {/* Results */}
          <h3 className="mb-1 text-lg font-semibold">
            Recommended for you
          </h3>
          <p className="mb-4 text-sm text-fd-muted-foreground">
            Based on your selections: {selections.map((s, i) => STEPS[i].options.find((o) => o.id === s)?.label).join(" / ")}
          </p>

          {commands.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
                Commands you can invoke
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {commands.map(({ key, skill }) => (
                  <Link
                    key={key}
                    href={`/docs/reference/skills/${key}`}
                    className="flex items-center gap-3 rounded-lg border border-fd-border p-3 transition-colors hover:border-fd-primary hover:bg-fd-primary/5"
                  >
                    <code className="shrink-0 rounded bg-fd-primary/10 px-2 py-0.5 text-xs font-semibold text-fd-primary">
                      /ork:{key}
                    </code>
                    <span className="truncate text-sm">
                      {skill.description.split(".")[0]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {reference.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
                Reference skills (auto-activated)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reference.map(({ key }) => (
                  <Link
                    key={key}
                    href={`/docs/reference/skills/${key}`}
                    className="inline-block rounded-md border border-fd-border bg-fd-secondary px-2.5 py-1 text-xs text-fd-secondary-foreground transition-colors hover:border-fd-primary hover:text-fd-primary"
                  >
                    {titleCase(key)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
          >
            Start over
          </button>
        </>
      )}
    </div>
  );
}
