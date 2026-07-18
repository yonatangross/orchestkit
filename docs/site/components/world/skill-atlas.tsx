// Server component: builds the full 114-skill atlas from generated data at
// render time. The grid + filter bar live in ./skill-atlas-grid.tsx (client),
// which is SSR-rendered — the complete list is in the HTML without JS, and
// the facet chips are plain useState progressive enhancement on top.

import { SKILLS } from "@/lib/generated/skills-data";
import type { SkillMeta } from "@/lib/generated/types";
import {
  SkillAtlasGrid,
  type AtlasCluster,
  type AtlasEntry,
} from "./skill-atlas-grid";

// ── Tag → cluster mapping ───────────────────────────────────
// Kept in sync with TAG_CATEGORY_MAP in components/skill-browser.tsx
// (that copy lives in a "use client" module, so it cannot be imported here
// without dragging the whole browser into the client reference graph).
const TAG_CLUSTER_MAP: Record<string, string[]> = {
  backend: [
    "api",
    "backend",
    "database",
    "fastapi",
    "sqlalchemy",
    "grpc",
    "rest",
    "graphql",
    "sql",
    "postgres",
    "redis",
  ],
  frontend: [
    "react",
    "frontend",
    "css",
    "tailwind",
    "component",
    "ui",
    "next.js",
    "nextjs",
    "vite",
  ],
  ai: [
    "llm",
    "ai",
    "openai",
    "anthropic",
    "rag",
    "embeddings",
    "langgraph",
    "langchain",
    "prompt",
    "ml",
  ],
  security: [
    "security",
    "owasp",
    "auth",
    "vulnerability",
    "authentication",
    "authorization",
    "encryption",
  ],
  testing: [
    "test",
    "e2e",
    "unit-test",
    "coverage",
    "playwright",
    "jest",
    "vitest",
    "testing",
  ],
  devops: [
    "ci-cd",
    "deployment",
    "kubernetes",
    "terraform",
    "monitoring",
    "docker",
    "ci",
    "cd",
    "infrastructure",
  ],
  product: [
    "product",
    "strategy",
    "requirements",
    "okr",
    "prioritization",
    "business",
    "market",
  ],
  research: ["research", "web-research", "browser", "scraping"],
  data: ["data", "pipeline", "vector", "embeddings", "analytics", "etl"],
};

const CLUSTER_LABELS: Record<string, string> = {
  development: "Development",
  ai: "AI",
  backend: "Backend",
  frontend: "Frontend",
  testing: "Testing",
  security: "Security",
  devops: "DevOps",
  product: "Product",
  data: "Data",
  research: "Research",
};

const CLUSTER_ORDER = Object.keys(CLUSTER_LABELS);

function clusterOf(skill: SkillMeta): string {
  const tags = skill.tags.map((t) => t.toLowerCase());
  for (const [cluster, keywords] of Object.entries(TAG_CLUSTER_MAP)) {
    if (keywords.some((kw) => tags.some((tag) => tag.includes(kw)))) {
      return cluster;
    }
  }
  return "development";
}

function firstSentence(text: string): string {
  const idx = text.indexOf(". ");
  return idx === -1 ? text : text.slice(0, idx + 1);
}

// ── Public server component ─────────────────────────────────
export function SkillAtlas() {
  const byCluster = new Map<string, AtlasEntry[]>();

  for (const skill of Object.values(SKILLS)) {
    const cluster = clusterOf(skill);
    const entry: AtlasEntry = {
      name: skill.name,
      blurb: firstSentence(skill.description),
      tags: skill.tags,
      complexity: skill.complexity || "medium",
      userInvocable: skill.userInvocable,
      cluster,
    };
    const bucket = byCluster.get(cluster);
    if (bucket) bucket.push(entry);
    else byCluster.set(cluster, [entry]);
  }

  const clusters: AtlasCluster[] = CLUSTER_ORDER.filter((id) =>
    byCluster.has(id),
  ).map((id) => ({
    id,
    label: CLUSTER_LABELS[id],
    entries: (byCluster.get(id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));

  return <SkillAtlasGrid clusters={clusters} />;
}
