"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Server,
  Monitor,
  Layers,
  Code2,
  Shield,
  Rocket,
  Brain,
  Video,
  BarChart3,
  Layout,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Plugin } from "@/lib/generated/types";
import { PLUGINS } from "@/lib/generated/plugins-data";

// ── Types ────────────────────────────────────────────────────

type Step = 0 | 1 | 2;

type StackOption = "backend" | "frontend" | "fullstack" | "python";
type FocusOption =
  | "backend"
  | "frontend"
  | "ai"
  | "video"
  | "product"
  | "security";

interface FeatureToggles {
  memory: boolean;
  webResearch: boolean;
  mcp: boolean;
  a11y: boolean;
}

type PresetKey =
  | "minimal"
  | "backend"
  | "frontend"
  | "fullstack"
  | "ai"
  | "everything";

interface PresetConfig {
  label: string;
  stack: StackOption | null;
  focus: FocusOption | null;
  features: FeatureToggles;
}

// ── Config data ──────────────────────────────────────────────

const STACK_OPTIONS: {
  id: StackOption;
  label: string;
  description: string;
  icon: typeof Server;
}[] = [
  {
    id: "backend",
    label: "Backend",
    description: "Server-side APIs, databases, microservices",
    icon: Server,
  },
  {
    id: "frontend",
    label: "Frontend",
    description: "React, UI, design systems",
    icon: Monitor,
  },
  {
    id: "fullstack",
    label: "Full-Stack",
    description: "Both backend and frontend",
    icon: Layers,
  },
  {
    id: "python",
    label: "Python",
    description: "FastAPI, SQLAlchemy, data science",
    icon: Code2,
  },
];

const FOCUS_OPTIONS: {
  id: FocusOption;
  label: string;
  description: string;
  icon: typeof Shield;
}[] = [
  {
    id: "backend",
    label: "Backend Architecture",
    description: "API design, databases, event-driven",
    icon: Rocket,
  },
  {
    id: "frontend",
    label: "Frontend Engineering",
    description: "React, a11y, performance",
    icon: Layout,
  },
  {
    id: "ai",
    label: "AI / LLM",
    description: "RAG, LangGraph, embeddings, function calling",
    icon: Brain,
  },
  {
    id: "video",
    label: "Video Production",
    description: "Demo videos, Remotion, Kling",
    icon: Video,
  },
  {
    id: "product",
    label: "Product Strategy",
    description: "PRDs, OKRs, business cases",
    icon: BarChart3,
  },
  {
    id: "security",
    label: "Security",
    description: "OWASP, defense-in-depth, AI safety",
    icon: Shield,
  },
];

const FEATURE_OPTIONS: {
  id: keyof FeatureToggles;
  label: string;
  description: string;
}[] = [
  {
    id: "memory",
    label: "Memory",
    description: "Graph + Local knowledge persistence",
  },
  {
    id: "webResearch",
    label: "Web Research",
    description: "Tavily search + BrightData scraping",
  },
  {
    id: "mcp",
    label: "MCP Integration",
    description: "Memory MCP server",
  },
  {
    id: "a11y",
    label: "Accessibility Testing",
    description: "WCAG 2.2 compliance",
  },
];

const DEFAULT_FEATURES: FeatureToggles = {
  memory: true,
  webResearch: false,
  mcp: true,
  a11y: false,
};

const PRESETS: Record<PresetKey, PresetConfig> = {
  minimal: {
    label: "Minimal",
    stack: null,
    focus: null,
    features: { memory: false, webResearch: false, mcp: false, a11y: false },
  },
  backend: {
    label: "Backend",
    stack: "backend",
    focus: "backend",
    features: { memory: true, webResearch: false, mcp: false, a11y: false },
  },
  frontend: {
    label: "Frontend",
    stack: "frontend",
    focus: "frontend",
    features: { memory: true, webResearch: false, mcp: false, a11y: true },
  },
  fullstack: {
    label: "Full-Stack",
    stack: "fullstack",
    focus: null,
    features: { memory: true, webResearch: false, mcp: true, a11y: false },
  },
  ai: {
    label: "AI",
    stack: "python",
    focus: "ai",
    features: { memory: true, webResearch: false, mcp: true, a11y: false },
  },
  everything: {
    label: "Everything",
    stack: "fullstack",
    focus: null,
    features: { memory: true, webResearch: true, mcp: true, a11y: true },
  },
};

const PRESET_KEYS: PresetKey[] = [
  "minimal",
  "backend",
  "frontend",
  "fullstack",
  "ai",
  "everything",
];

// ── Recommendation logic ─────────────────────────────────────

function getRecommendedPlugin(
  stack: StackOption | null,
  focus: FocusOption | null,
): "ork" | "orkl" {
  if (stack === "python") return "ork";
  if (focus === "ai") return "ork";
  if (focus === "security") return "ork";
  return "orkl";
}

function findPlugin(name: string): Plugin | undefined {
  return PLUGINS.find((p) => p.name === name);
}

// ── Main component ───────────────────────────────────────────

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [selectedStack, setSelectedStack] = useState<StackOption | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<FocusOption | null>(null);
  const [features, setFeatures] = useState<FeatureToggles>({
    ...DEFAULT_FEATURES,
  });
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [copied, setCopied] = useState(false);

  const recommended = useMemo(
    () => getRecommendedPlugin(selectedStack, selectedFocus),
    [selectedStack, selectedFocus],
  );

  const plugin = useMemo(() => findPlugin(recommended), [recommended]);

  const installCommand = `claude install orchestkit/${recommended}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [installCommand]);

  const applyPreset = useCallback((key: PresetKey) => {
    const preset = PRESETS[key];
    setActivePreset(key);
    setSelectedStack(preset.stack);
    setSelectedFocus(preset.focus);
    setFeatures({ ...preset.features });
    setCurrentStep(0);
  }, []);

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, 2) as Step);
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0) as Step);
  }, []);

  const toggleFeature = useCallback((id: keyof FeatureToggles) => {
    setActivePreset(null);
    setFeatures((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectStack = useCallback((stack: StackOption) => {
    setActivePreset(null);
    setSelectedStack((prev) => (prev === stack ? null : stack));
  }, []);

  const selectFocus = useCallback((focus: FocusOption) => {
    setActivePreset(null);
    setSelectedFocus((prev) => (prev === focus ? null : focus));
  }, []);

  return (
    <div className="not-prose">
      <div className="overflow-hidden rounded-xl border border-fd-border">
        {/* Presets bar */}
        <div className="border-b border-fd-border bg-fd-muted/50 px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
            Quick presets
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_KEYS.map((key) => {
              const active = activePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (active ? setActivePreset(null) : applyPreset(key))}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary shadow-sm"
                      : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                  }`}
                >
                  {PRESETS[key].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main layout: steps + preview */}
        <div className="flex flex-col lg:flex-row">
          {/* Steps panel */}
          <div className="flex-1 p-5 lg:w-[60%]">
            {/* Step indicators */}
            <div className="mb-5 flex items-center gap-2">
              {([0, 1, 2] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  aria-current={currentStep === i ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${
                    i === 0
                      ? "Stack Selection"
                      : i === 1
                        ? "Focus Area"
                        : "Features"
                  }`}
                  className={`flex items-center gap-2 ${i < 2 ? "flex-1" : ""}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      currentStep === i
                        ? "bg-fd-primary text-fd-primary-foreground shadow-sm"
                        : currentStep > i
                          ? "bg-fd-primary/15 text-fd-primary"
                          : "bg-fd-muted text-fd-muted-foreground"
                    }`}
                  >
                    {currentStep > i ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`hidden text-xs font-medium sm:inline ${
                      currentStep === i
                        ? "text-fd-foreground"
                        : "text-fd-muted-foreground"
                    }`}
                  >
                    {i === 0
                      ? "Stack"
                      : i === 1
                        ? "Focus"
                        : "Features"}
                  </span>
                  {i < 2 && (
                    <div
                      className={`mx-2 hidden h-px flex-1 sm:block ${
                        currentStep > i
                          ? "bg-fd-primary/40"
                          : "bg-fd-border"
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Step 0: Stack Selection */}
            {currentStep === 0 && (
              <div>
                <p className="mb-3 text-sm font-medium text-fd-foreground">
                  What is your primary stack?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {STACK_OPTIONS.map((opt) => {
                    const active = selectedStack === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => selectStack(opt.id)}
                        aria-pressed={active}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
                          active
                            ? "border-fd-primary/40 bg-fd-primary/10 shadow-sm"
                            : "border-fd-border hover:border-fd-border hover:bg-fd-muted"
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            active
                              ? "text-fd-primary"
                              : "text-fd-muted-foreground"
                          }`}
                        />
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              active
                                ? "text-fd-primary"
                                : "text-fd-foreground"
                            }`}
                          >
                            {opt.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-fd-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Focus Area */}
            {currentStep === 1 && (
              <div>
                <p className="mb-3 text-sm font-medium text-fd-foreground">
                  What is your primary focus area?
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {FOCUS_OPTIONS.map((opt) => {
                    const active = selectedFocus === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => selectFocus(opt.id)}
                        aria-pressed={active}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all ${
                          active
                            ? "border-fd-primary/40 bg-fd-primary/10 shadow-sm"
                            : "border-fd-border hover:border-fd-border hover:bg-fd-muted"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            active
                              ? "text-fd-primary"
                              : "text-fd-muted-foreground"
                          }`}
                        />
                        <div>
                          <p
                            className={`text-xs font-medium ${
                              active
                                ? "text-fd-primary"
                                : "text-fd-foreground"
                            }`}
                          >
                            {opt.label}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-tight text-fd-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Feature Toggles */}
            {currentStep === 2 && (
              <div>
                <p className="mb-3 text-sm font-medium text-fd-foreground">
                  Optional features
                </p>
                <div className="space-y-3">
                  {FEATURE_OPTIONS.map((opt) => {
                    const enabled = features[opt.id];
                    return (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between rounded-lg border border-fd-border px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-fd-foreground">
                            {opt.label}
                          </p>
                          <p className="text-xs text-fd-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${opt.label}`}
                          onClick={() => toggleFeature(opt.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            enabled
                              ? "bg-fd-primary"
                              : "bg-fd-border"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              enabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step navigation */}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={currentStep === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  currentStep === 0
                    ? "cursor-not-allowed border-fd-border/50 text-fd-muted-foreground/30"
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={currentStep === 2}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  currentStep === 2
                    ? "cursor-not-allowed bg-fd-muted text-fd-muted-foreground/30"
                    : "bg-fd-primary text-fd-primary-foreground shadow-sm hover:bg-fd-primary/90 hover:shadow"
                }`}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Preview panel */}
          <div
            className="border-t border-fd-border bg-fd-muted/50 p-5 lg:w-[40%] lg:border-l lg:border-t-0"
            role="status"
            aria-live="polite"
          >
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
              Recommendation
            </p>

            {/* Plugin badge */}
            <div className="mb-4 flex items-center gap-2">
              <span
                className={`inline-flex rounded-md px-2.5 py-1 text-sm font-bold ${
                  recommended === "ork"
                    ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                }`}
              >
                {recommended}
              </span>
              <span className="text-sm text-fd-muted-foreground">
                {recommended === "ork" ? "Full toolkit" : "Universal toolkit"}
              </span>
            </div>

            {/* Decision rationale */}
            <div className="mb-4 rounded-lg border border-fd-border bg-fd-background p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                Why?
              </p>
              <p className="text-xs leading-relaxed text-fd-muted-foreground">
                {recommended === "ork"
                  ? selectedStack === "python"
                    ? "Python stack requires specialized FastAPI, SQLAlchemy, and data science patterns available only in the full toolkit."
                    : selectedFocus === "ai"
                      ? "AI/LLM focus requires RAG, LangGraph, embeddings, and function calling patterns available only in the full toolkit."
                      : selectedFocus === "security"
                        ? "Security focus benefits from advanced guardrails, OWASP patterns, and AI safety auditing in the full toolkit."
                        : `Your configuration benefits from the full ${plugin?.skillCount ?? 61}-skill toolkit with specialized patterns.`
                  : `The universal toolkit covers your needs with ${plugin?.skillCount ?? 44} language-agnostic skills. Lighter weight, works for any stack.`}
              </p>
            </div>

            {/* Stats */}
            {plugin && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-fd-border bg-fd-background p-2.5 text-center">
                  <p className="text-lg font-bold text-fd-foreground">
                    {plugin.skillCount}
                  </p>
                  <p className="text-[10px] text-fd-muted-foreground">
                    Skills
                  </p>
                </div>
                <div className="rounded-lg border border-fd-border bg-fd-background p-2.5 text-center">
                  <p className="text-lg font-bold text-fd-foreground">
                    {plugin.agentCount}
                  </p>
                  <p className="text-[10px] text-fd-muted-foreground">
                    Agents
                  </p>
                </div>
                <div className="rounded-lg border border-fd-border bg-fd-background p-2.5 text-center">
                  <p className="text-lg font-bold text-fd-foreground">
                    {plugin.hooks}
                  </p>
                  <p className="text-[10px] text-fd-muted-foreground">
                    Hooks
                  </p>
                </div>
              </div>
            )}

            {/* Install command */}
            <div className="rounded-lg border border-fd-border bg-fd-background">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                  Install
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={
                    copied
                      ? "Copied install command to clipboard"
                      : "Copy install command to clipboard"
                  }
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-fd-primary" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="border-t border-fd-border px-3 py-2.5">
                <code className="text-xs font-mono text-fd-foreground">
                  <span className="text-fd-muted-foreground">$ </span>
                  {installCommand}
                </code>
              </div>
            </div>

            {/* Summary of selections */}
            <div className="mt-4 space-y-1.5">
              {selectedStack && (
                <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                  <Check className="h-3 w-3 text-fd-primary" />
                  <span>
                    Stack:{" "}
                    <span className="font-medium text-fd-foreground">
                      {STACK_OPTIONS.find((s) => s.id === selectedStack)?.label}
                    </span>
                  </span>
                </div>
              )}
              {selectedFocus && (
                <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                  <Check className="h-3 w-3 text-fd-primary" />
                  <span>
                    Focus:{" "}
                    <span className="font-medium text-fd-foreground">
                      {FOCUS_OPTIONS.find((f) => f.id === selectedFocus)?.label}
                    </span>
                  </span>
                </div>
              )}
              {Object.entries(features)
                .filter(([, enabled]) => enabled)
                .map(([id]) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 text-xs text-fd-muted-foreground"
                  >
                    <Check className="h-3 w-3 text-fd-primary" />
                    <span>
                      {
                        FEATURE_OPTIONS.find(
                          (f) => f.id === (id as keyof FeatureToggles),
                        )?.label
                      }
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
