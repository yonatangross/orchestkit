import Link from "next/link";
import { ArrowRight, BadgeCheck, Ban } from "lucide-react";
import { CopyInstallButton } from "@/app/(home)/copy-button";
import { COUNTS } from "@/lib/constants";
import { GeorgeMark } from "@/components/world/george";
import FactoryRide from "@/components/world/factory-ride";

/**
 * Cinematic factory-ride story. Used to be the homepage hero; catalog-first
 * `/` replaced it, so the ride lives at `/factory-ride` as a showcase piece.
 * Overlay copy stays server-renderable (this module is imported from a server
 * page) so crawlers still see the h1 + CTAs in stop 1.
 */
export function FactoryRideStory() {
  return (
    <FactoryRide
      hero={
        <div key="hero" className="mx-auto max-w-[880px] text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.62_0.2_264/0.35)] bg-[oklch(0.62_0.2_264/0.14)] px-2.5 py-1.5 font-mono text-[12px] font-medium text-[oklch(0.82_0.08_270)]">
            <GeorgeMark />
            Factory ride
          </span>

          <h1
            id="hero-heading"
            className="mt-5 text-fluid-h1 font-semibold leading-[1.02] tracking-[-0.025em] text-[oklch(0.93_0.012_270)]"
          >
            <span className="sr-only">OrchestKit. </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, oklch(0.96 0.006 270) 0%, oklch(0.78 0.02 264) 100%)",
              }}
            >
              Stop explaining your stack.
            </span>
            <br />
            <span className="headline-trace">Start shipping.</span>
          </h1>

          <p
            data-speakable-summary
            className="mx-auto mt-4 max-w-[620px] text-[clamp(0.95rem,0.3vw+0.9rem,1.125rem)] leading-[1.55] text-[oklch(0.86_0.015_264)] [text-wrap:balance]"
          >
            <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
              <span className="text-[var(--yy-george-warm)]">{COUNTS.skills}</span>{" "}
              <span className="text-[oklch(0.95_0.008_270)]">skills</span>
            </span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
              <span className="text-[var(--yy-george-cool)]">{COUNTS.agents}</span>{" "}
              <span className="text-[oklch(0.95_0.008_270)]">agents</span>
            </span>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="whitespace-nowrap font-mono text-[0.92em] font-medium">
              <span className="text-[oklch(0.74_0.14_290)]">{COUNTS.hooks}</span>{" "}
              <span className="text-[oklch(0.95_0.008_270)]">hooks</span>
            </span>
            <span className="mt-1 block text-[0.9em]">
              Loaded on demand, zero runtime cost.
            </span>
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[oklch(0.62_0.2_264)] px-[18px] text-sm font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.66_0.19_264)] hover:shadow-[0_0_0_4px_oklch(0.62_0.2_264/0.25)]"
            >
              Get started{" "}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <CopyInstallButton />
          </div>
        </div>
      }
      cards={[
        <div className="fr-card" key="hooks">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
            The intake scanners
          </div>
          <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
            {COUNTS.hooks}
            <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">
              hooks
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
            Every action, inspected
          </h2>
          <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
            TypeScript lifecycle hooks gate each tool call: dangerous commands blocked,
            context injected, security enforced. Non-blocking by design.
          </p>
          <div className="mt-3.5 inline-flex items-center gap-2 rounded-[9px] border border-[oklch(0.63_0.2_25/0.35)] bg-[oklch(0.63_0.2_25/0.12)] px-3 py-2 font-mono text-xs text-[oklch(0.86_0.07_20)]">
            <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>rm -rf /</span>
            <span className="opacity-60">→ diverted before execution</span>
          </div>
          <div className="mt-4">
            <Link
              href="/docs/reference/hooks"
              className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
            >
              /docs/reference/hooks
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>,
        <div className="fr-card" key="agents">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
            The assembly bay
          </div>
          <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
            {COUNTS.agents}
            <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">
              agents
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
            Specialists, in parallel
          </h2>
          <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
            Security auditors, frontend devs, DB engineers, working simultaneously in
            isolated worktrees, each with curated tools and skills.
          </p>
          <div className="mt-4">
            <Link
              href="/docs/reference/agents"
              className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
            >
              /docs/reference/agents
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>,
        <div className="fr-card" key="skills">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--yy-george-cool)]">
            The tool wall
          </div>
          <div className="mt-2.5 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[oklch(0.95_0.008_270)]">
            {COUNTS.skills}
            <span className="ml-2 text-base font-medium tracking-normal text-[oklch(0.86_0.015_264)]">
              skills
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-[oklch(0.93_0.012_270)]">
            Knowledge, on pegs
          </h2>
          <p className="mt-2.5 text-sm leading-[1.6] text-[oklch(0.86_0.015_264)]">
            Auth patterns, migrations, API design, reusable modules that load only when
            the work needs them.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {["/ork:implement", "/ork:review-pr", "/ork:brainstorm", `+${COUNTS.skills - 3}`].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-[7px] border border-[oklch(0.76_0.06_220/0.3)] bg-[oklch(1_0_0/0.08)] px-2 py-1 font-mono text-[11.5px] text-[oklch(0.84_0.03_220)]"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
          <div className="mt-4">
            <Link
              href="/docs/reference/skills"
              className="inline-flex items-center gap-1.5 font-mono text-[12.5px] font-semibold text-[oklch(0.76_0.11_270)] hover:underline"
            >
              /docs/reference/skills
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>,
      ]}
      finale={
        <div key="finale" className="mx-auto max-w-[760px] text-center">
          <span className="inline-flex items-center gap-2.5 rounded-xl border border-[oklch(0.62_0.2_264/0.4)] bg-[oklch(0.62_0.2_264/0.14)] px-[18px] py-2.5 font-mono text-sm font-semibold tracking-[0.06em] text-[oklch(0.85_0.06_270)] shadow-[0_0_50px_oklch(0.62_0.2_264/0.25)]">
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            VERIFIED · MERGED
          </span>
          <h2 className="mt-5 text-[clamp(30px,4.6vw,52px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[oklch(0.95_0.008_270)]">
            Your change ships in a sealed crate.
          </h2>
          <p className="mt-3 text-base text-[oklch(0.86_0.015_264)]">
            Tests, security scans and quality gates, passed before the dock doors open.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/docs/getting-started/first-10-minutes"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[oklch(0.62_0.2_264)] px-[18px] text-sm font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-[oklch(0.66_0.19_264)] hover:shadow-[0_0_0_4px_oklch(0.62_0.2_264/0.25)]"
            >
              Get started{" "}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <CopyInstallButton />
          </div>
        </div>
      }
    />
  );
}
