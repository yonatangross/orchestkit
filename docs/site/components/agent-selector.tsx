"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Search,
  X,
  HelpCircle,
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

// ── Icon lookup for quiz step ───────────────────────────────
const TASK_ICONS: Record<TaskType, React.ReactNode> = {
  build: <Hammer className="h-5 w-5" />,
  review: <Eye className="h-5 w-5" />,
  debug: <Bug className="h-5 w-5" />,
  test: <FlaskConical className="h-5 w-5" />,
  deploy: <Rocket className="h-5 w-5" />,
  design: <Compass className="h-5 w-5" />,
  research: <Search className="h-5 w-5" />,
  document: <FileText className="h-5 w-5" />,
  optimize: <Gauge className="h-5 w-5" />,
  secure: <Shield className="h-5 w-5" />,
  plan: <ListTodo className="h-5 w-5" />,
};

const MODEL_LABELS: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  inherit: "Inherit",
};

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
        const haystack = `${agent.name} ${agent.description} ${agent.keywords.join(" ")}`.toLowerCase();
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

  const allCategories = Object.keys(CATEGORY_META) as Category[];

  return (
    <div className="not-prose">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fd-muted-foreground">
          {filtered.length} of {AGENTS.length} agents
        </p>
        <button
          ref={quizTriggerRef}
          type="button"
          onClick={startQuiz}
          className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          <HelpCircle className="h-4 w-4" />
          Help me choose
        </button>
      </div>

      {/* Scenario presets */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => {
            const active = activeScenario === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  active ? clearFilters() : applyScenario(s)
                }
                className={`group rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-fd-primary bg-fd-primary/10 text-fd-primary"
                    : "border-fd-border text-fd-muted-foreground hover:bg-fd-accent"
                }`}
                aria-pressed={active}
              >
                <span>{s.label}</span>
                <span
                  className={`ml-1 hidden text-[11px] font-normal sm:inline ${
                    active
                      ? "text-fd-primary/70"
                      : "text-fd-muted-foreground/60"
                  }`}
                >
                  {s.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
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
          className="h-10 w-full rounded-md border border-fd-border bg-fd-secondary pl-10 pr-8 text-sm outline-none transition-colors placeholder:text-fd-muted-foreground focus:border-fd-primary"
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

      {/* Category filters — labeled */}
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Category
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {allCategories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? `${meta.bg} ${meta.color} border-current`
                    : "border-fd-border text-fd-muted-foreground hover:bg-fd-accent"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Task type filters — labeled */}
      <fieldset className="mb-5">
        <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
          Task type
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TASK_TYPE_META) as TaskType[]).map((tt) => {
            const active = selectedTaskTypes.includes(tt);
            return (
              <button
                key={tt}
                type="button"
                onClick={() => toggleTaskType(tt)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-fd-primary bg-fd-primary/10 text-fd-primary"
                    : "border-fd-border text-fd-muted-foreground hover:bg-fd-accent"
                }`}
              >
                {TASK_TYPE_META[tt].label}
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full px-2.5 py-1 text-xs text-fd-muted-foreground underline decoration-fd-border underline-offset-2 hover:text-fd-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </fieldset>

      {/* Agent grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-fd-border px-8 py-12 text-center">
          <SearchX className="mx-auto mb-3 h-8 w-8 text-fd-muted-foreground/50" />
          <p className="text-sm font-medium">No agents match your filters</p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            Try broadening your search or removing some filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 rounded-md border border-fd-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-fd-accent"
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

// ── Agent Card ──────────────────────────────────────────────
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
  const isOpus = agent.model === "opus";

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isOpus ? "border-l-2 border-l-purple-500/40" : ""
      } ${
        expanded
          ? "border-fd-primary bg-fd-accent/50"
          : "border-fd-border hover:bg-fd-accent/30"
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
            <span className="text-sm font-semibold">{agent.name}</span>
            <span
              className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${catMeta.bg} ${catMeta.color}`}
            >
              {catMeta.label}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-fd-muted-foreground">
            {agent.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-fd-muted-foreground">
            <span
              className={`font-medium ${isOpus ? "text-purple-500" : ""}`}
            >
              {MODEL_LABELS[agent.model]}
            </span>
            <span className="text-fd-muted-foreground/70">
              {agent.taskTypes.map((t) => TASK_TYPE_META[t].label).join(", ")}
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
        className={`grid transition-all duration-200 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
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
                  className="rounded-md bg-fd-secondary px-3 py-2 text-xs leading-relaxed"
                >
                  &ldquo;{prompt}&rdquo;
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <code className="rounded bg-fd-secondary px-2 py-0.5 text-[11px] font-mono">
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

// ── Focus trap hook ─────────────────────────────────────────
function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [ref, active]);
}

// ── Quiz Modal ──────────────────────────────────────────────
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

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-[fade-in_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Agent selection quiz"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-xl border border-fd-border bg-fd-background p-6 shadow-xl animate-[slide-up_200ms_ease-out]"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Help me choose</h3>
            <p className="text-xs text-fd-muted-foreground">
              Step {step + 1} of 3
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-fd-primary" : "bg-fd-border"
              }`}
            />
          ))}
        </div>

        {/* Step content with fade transition */}
        <div key={step} className="animate-[fade-in_200ms_ease-out]">
          {/* Step 0: Task type */}
          {step === 0 && (
            <div>
              <p className="mb-4 text-sm font-medium">
                What are you trying to do?
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(Object.keys(TASK_TYPE_META) as TaskType[]).map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => onSelectTaskType(tt)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-fd-border p-3 text-center transition-colors hover:bg-fd-accent hover:border-fd-primary"
                  >
                    {TASK_ICONS[tt]}
                    <span className="text-xs font-medium">
                      {TASK_TYPE_META[tt].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Category */}
          {step === 1 && (
            <div>
              <p className="mb-4 text-sm font-medium">
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
                      className="rounded-lg border border-fd-border p-3 text-center transition-colors hover:bg-fd-accent hover:border-fd-primary"
                    >
                      <span className={`text-sm font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
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

          {/* Step 2: Results */}
          {step === 2 && (
            <div>
              <p className="mb-1 text-sm font-medium">
                {results.length === 0
                  ? "No exact matches"
                  : `${results.length} agent${results.length === 1 ? "" : "s"} match${results.length === 1 ? "es" : ""}`}
              </p>
              <p className="mb-4 text-xs text-fd-muted-foreground">
                {taskType && (
                  <span>
                    Task: <strong>{TASK_TYPE_META[taskType].label}</strong>
                  </span>
                )}
                {category && (
                  <span>
                    {" "}
                    &middot; Domain:{" "}
                    <strong>{CATEGORY_META[category].label}</strong>
                  </span>
                )}
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {results.map((agent) => {
                  const catMeta = CATEGORY_META[agent.category];
                  return (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-fd-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {agent.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${catMeta.bg} ${catMeta.color}`}
                        >
                          {catMeta.label}
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
                  className="flex-1 rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
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
  );
}
