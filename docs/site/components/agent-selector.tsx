"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import {
  Search,
  X,
  ChevronRight,
  ExternalLink,
  Hammer,
  Eye,
  Bug,
  FlaskConical,
  Rocket,
  Compass,
  FileText,
  Gauge,
  Shield,
  ListTodo,
  SearchX,
  Sparkles,
} from "lucide-react";
import {
  AGENTS,
  CATEGORY_META,
  TASK_TYPE_META,
  SCENARIOS,
  type Agent,
  type Category,
  type TaskType,
} from "@/lib/agent-data";

// ── Icon components by task type ────────────────────────────
const TASK_ICON_MAP: Record<TaskType, typeof Hammer> = {
  build: Hammer,
  review: Eye,
  debug: Bug,
  test: FlaskConical,
  deploy: Rocket,
  design: Compass,
  research: Search,
  document: FileText,
  optimize: Gauge,
  secure: Shield,
  plan: ListTodo,
};

const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  inherit: "Inherit",
};

const MODEL_STYLES: Record<string, string> = {
  opus: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  sonnet: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  inherit:
    "bg-fd-muted text-fd-muted-foreground",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as Category[];

// ── Main component ──────────────────────────────────────────
export function AgentSelector() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<TaskType[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizTaskType, setQuizTaskType] = useState<TaskType | null>(null);
  const [quizCategory, setQuizCategory] = useState<Category | null>(null);
  const quizTriggerRef = useRef<HTMLButtonElement>(null);

  // Filter agents
  const filtered = useMemo(() => {
    return AGENTS.filter((agent) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack =
          `${agent.name} ${agent.description} ${agent.keywords.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(agent.category)
      ) {
        return false;
      }
      if (
        selectedTaskTypes.length > 0 &&
        !selectedTaskTypes.some((t) => agent.taskTypes.includes(t))
      ) {
        return false;
      }
      return true;
    });
  }, [search, selectedCategories, selectedTaskTypes]);

  // Quiz results
  const quizResults = useMemo(() => {
    if (!quizTaskType) return [];
    return AGENTS.filter((agent) => {
      if (!agent.taskTypes.includes(quizTaskType)) return false;
      if (quizCategory && agent.category !== quizCategory) return false;
      return true;
    });
  }, [quizTaskType, quizCategory]);

  const toggleCategory = useCallback((cat: Category) => {
    setActiveScenario(null);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const toggleTaskType = useCallback((tt: TaskType) => {
    setActiveScenario(null);
    setSelectedTaskTypes((prev) =>
      prev.includes(tt) ? prev.filter((t) => t !== tt) : [...prev, tt],
    );
  }, []);

  const applyScenario = useCallback(
    (scenario: (typeof SCENARIOS)[number]) => {
      setActiveScenario(scenario.id);
      setSelectedCategories(scenario.categories);
      setSelectedTaskTypes(scenario.taskTypes);
      setSearch("");
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setSelectedCategories([]);
    setSelectedTaskTypes([]);
    setActiveScenario(null);
  }, []);

  const startQuiz = useCallback(() => {
    setShowQuiz(true);
    setQuizStep(0);
    setQuizTaskType(null);
    setQuizCategory(null);
  }, []);

  const closeQuiz = useCallback(() => {
    setShowQuiz(false);
    quizTriggerRef.current?.focus();
  }, []);

  const applyQuizResults = useCallback(() => {
    if (quizTaskType) setSelectedTaskTypes([quizTaskType]);
    if (quizCategory) setSelectedCategories([quizCategory]);
    setActiveScenario(null);
    setShowQuiz(false);
    quizTriggerRef.current?.focus();
  }, [quizTaskType, quizCategory]);

  const hasFilters =
    search !== "" ||
    selectedCategories.length > 0 ||
    selectedTaskTypes.length > 0;

  return (
    <div className="not-prose">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fd-muted-foreground" role="status" aria-live="polite">
          Showing{" "}
          <span className="font-semibold tabular-nums text-fd-foreground">
            {filtered.length}
          </span>{" "}
          of {AGENTS.length} agents
        </p>
        <button
          ref={quizTriggerRef}
          type="button"
          onClick={startQuiz}
          className="inline-flex items-center gap-2 rounded-lg border border-fd-primary/30 bg-fd-primary/10 px-4 py-2 text-sm font-medium text-fd-primary transition-all hover:bg-fd-primary/20 hover:shadow-sm"
        >
          <Sparkles className="h-4 w-4" />
          Help me choose
        </button>
      </div>

      {/* Scenario presets — with category-colored dots */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => {
            const active = activeScenario === s.id;
            const scenarioDot = CATEGORY_META[s.categories[0]].dot;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  active ? clearFilters() : applyScenario(s)
                }
                className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary shadow-sm"
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
                aria-pressed={active}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${scenarioDot}`}
                />
                <span>{s.label}</span>
                <span
                  className={`hidden text-[11px] font-normal sm:inline ${
                    active
                      ? "text-fd-primary/60"
                      : "text-fd-muted-foreground"
                  }`}
                >
                  {s.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search — with teal focus ring */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fd-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveScenario(null);
          }}
          placeholder="Search agents by name, keyword, or description..."
          aria-label="Search agents by name, keyword, or description"
          className="h-10 w-full rounded-lg border border-fd-border bg-fd-background pl-10 pr-8 text-sm outline-none transition-all placeholder:text-fd-muted-foreground focus:border-fd-ring focus:ring-2 focus:ring-fd-ring/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fd-muted-foreground hover:text-fd-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filters — with colored dots */}
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Category
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? `${meta.bg} ${meta.color} border-current shadow-sm`
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    active ? "opacity-100" : "opacity-60"
                  } ${meta.dot}`}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Task type filters — with inline icons */}
      <fieldset className="mb-5">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Task type
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TASK_TYPE_META) as TaskType[]).map((tt) => {
            const active = selectedTaskTypes.includes(tt);
            const Icon = TASK_ICON_MAP[tt];
            return (
              <button
                key={tt}
                type="button"
                onClick={() => toggleTaskType(tt)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary shadow-sm"
                    : "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
                }`}
              >
                <Icon className="h-3 w-3 opacity-70" />
                {TASK_TYPE_META[tt].label}
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-2.5 py-1 text-xs text-fd-muted-foreground underline decoration-fd-border underline-offset-2 hover:text-fd-foreground"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}
        </div>
      </fieldset>

      {/* Agent grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-muted px-8 py-12 text-center">
          <SearchX className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
          <p className="text-sm font-medium text-fd-foreground">
            No agents match your filters
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Try broadening your search or removing some filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 rounded-md border border-fd-border px-3 py-1.5 text-xs font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              expanded={expandedAgent === agent.id}
              onToggle={() =>
                setExpandedAgent(
                  expandedAgent === agent.id ? null : agent.id,
                )
              }
            />
          ))}
        </div>
      )}

      {/* Quiz modal */}
      {showQuiz && (
        <QuizModal
          step={quizStep}
          taskType={quizTaskType}
          category={quizCategory}
          results={quizResults}
          onSelectTaskType={(tt) => {
            setQuizTaskType(tt);
            setQuizStep(1);
          }}
          onSelectCategory={(cat) => {
            setQuizCategory(cat);
            setQuizStep(2);
          }}
          onSkipCategory={() => setQuizStep(2)}
          onApply={applyQuizResults}
          onClose={closeQuiz}
          onBack={() => {
            if (quizStep === 2) {
              setQuizCategory(null);
              setQuizStep(1);
            } else if (quizStep === 1) {
              setQuizTaskType(null);
              setQuizStep(0);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Agent Card — colored left border + model tier badge ─────
function AgentCard({
  agent,
  expanded,
  onToggle,
}: {
  agent: Agent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catMeta = CATEGORY_META[agent.category];

  return (
    <div
      className={`rounded-lg border border-fd-border border-l-[3px] ${catMeta.border} transition-all duration-200 ${
        expanded
          ? `${catMeta.bg} shadow-sm`
          : "hover:bg-fd-muted"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-fd-foreground">
              {agent.name}
            </span>
            <span
              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${catMeta.bg} ${catMeta.color}`}
            >
              {catMeta.label}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-fd-muted-foreground">
            {agent.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${MODEL_STYLES[agent.model]}`}
            >
              {MODEL_LABELS[agent.model]}
            </span>
            <span className="text-[11px] text-fd-muted-foreground">
              {agent.taskTypes
                .map((t) => TASK_TYPE_META[t].label)
                .join(", ")}
            </span>
          </div>
        </div>
        <ChevronRight
          className={`mt-1 h-4 w-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      <div
        aria-hidden={!expanded}
        className={`grid transition-all duration-200 ease-out ${
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-fd-border px-4 pb-4 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
              Example prompts
            </p>
            <ul className="space-y-1.5">
              {agent.examplePrompts.map((prompt, i) => (
                <li
                  key={i}
                  className="rounded-md bg-fd-muted px-3 py-2 text-xs leading-relaxed text-fd-foreground"
                >
                  &ldquo;{prompt}&rdquo;
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <code className="rounded bg-fd-muted px-2 py-0.5 text-[11px] font-mono text-fd-foreground">
                {agent.id}
              </code>
              <a
                href={`/docs/reference/agents#${agent.id}`}
                className="inline-flex items-center gap-1 text-[11px] text-fd-primary hover:underline"
                tabIndex={expanded ? 0 : -1}
              >
                Full reference
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quiz Modal — gradient progress + colored cards ──────────
function QuizModal({
  step,
  taskType,
  category,
  results,
  onSelectTaskType,
  onSelectCategory,
  onSkipCategory,
  onApply,
  onClose,
  onBack,
}: {
  step: number;
  taskType: TaskType | null;
  category: Category | null;
  results: Agent[];
  onSelectTaskType: (tt: TaskType) => void;
  onSelectCategory: (cat: Category) => void;
  onSkipCategory: () => void;
  onApply: () => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);
  useScrollLock(true);

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fd-overlay p-4 backdrop-blur-sm animate-[fade-in_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-heading"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-fd-border bg-fd-background shadow-2xl animate-[slide-up_200ms_ease-out]"
      >
        {/* Colored header bar */}
        <div className="bg-fd-primary px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 id="quiz-heading" className="text-lg font-semibold text-fd-primary-foreground">
                Help me choose
              </h3>
              <p className="text-xs text-fd-primary-foreground/80">Step {step + 1} of 3</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-fd-primary-foreground/80 transition-colors hover:bg-fd-primary-foreground/20 hover:text-fd-primary-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Gradient progress */}
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-white/90" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content with fade transition */}
        <div className="p-6">
          <div key={step} className="animate-[fade-in_200ms_ease-out]">
            {/* Step 0: Task type — with icons */}
            {step === 0 && (
              <div>
                <p className="mb-4 text-sm font-medium text-fd-foreground">
                  What are you trying to do?
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(Object.keys(TASK_TYPE_META) as TaskType[]).map((tt) => {
                    const Icon = TASK_ICON_MAP[tt];
                    return (
                      <button
                        key={tt}
                        type="button"
                        onClick={() => onSelectTaskType(tt)}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-fd-border p-3 text-center transition-all hover:border-fd-primary/40 hover:bg-fd-primary/10"
                      >
                        <Icon className="h-5 w-5 text-fd-muted-foreground" />
                        <span className="text-xs font-medium text-fd-foreground">
                          {TASK_TYPE_META[tt].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Category — with colored dots + left borders */}
            {step === 1 && (
              <div>
                <p className="mb-4 text-sm font-medium text-fd-foreground">
                  What domain or stack?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => onSelectCategory(cat)}
                        className={`rounded-lg border border-fd-border border-l-[3px] ${meta.border} p-3 text-left transition-all hover:bg-fd-muted`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                          />
                          <span
                            className={`text-sm font-medium ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onSkipCategory}
                  className="mt-3 w-full text-center text-xs text-fd-muted-foreground hover:text-fd-foreground"
                >
                  Skip &mdash; show all categories
                </button>
              </div>
            )}

            {/* Step 2: Results — with colored card borders */}
            {step === 2 && (
              <div>
                <p className="mb-1 text-sm font-medium text-fd-foreground">
                  {results.length === 0
                    ? "No exact matches"
                    : `${results.length} agent${results.length === 1 ? "" : "s"} match${results.length === 1 ? "es" : ""}`}
                </p>
                <p className="mb-4 text-xs text-fd-muted-foreground">
                  {taskType && (
                    <span>
                      Task:{" "}
                      <strong className="text-fd-foreground">
                        {TASK_TYPE_META[taskType].label}
                      </strong>
                    </span>
                  )}
                  {category && (
                    <span>
                      {" "}
                      &middot; Domain:{" "}
                      <strong className={CATEGORY_META[category].color}>
                        {CATEGORY_META[category].label}
                      </strong>
                    </span>
                  )}
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {results.map((agent) => {
                    const catMeta = CATEGORY_META[agent.category];
                    return (
                      <div
                        key={agent.id}
                        className={`rounded-lg border border-fd-border border-l-[3px] ${catMeta.border} p-3`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-fd-foreground">
                            {agent.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${catMeta.bg} ${catMeta.color}`}
                          >
                            {catMeta.label}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${MODEL_STYLES[agent.model]}`}
                          >
                            {MODEL_LABELS[agent.model]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-fd-muted-foreground">
                          {agent.description}
                        </p>
                      </div>
                    );
                  })}
                  {results.length === 0 && (
                    <p className="py-4 text-center text-xs text-fd-muted-foreground">
                      Try a different combination. Click Back to change your
                      selection.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={onApply}
                    className="flex-1 rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm transition-all hover:bg-fd-primary/90 hover:shadow"
                  >
                    Apply to grid
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          {step > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="mt-4 text-xs text-fd-muted-foreground hover:text-fd-foreground"
            >
              &larr; Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
