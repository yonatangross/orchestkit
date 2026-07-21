"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * FactoryRide — the scroll-world "factory ride" homepage hero.
 *
 * A tall track (360vh, see global.css) wraps a sticky full-viewport
 * stage. A canvas scrubs 101 pre-rendered frames by scroll progress
 * (rAF-throttled, eased — see SMOOTHING), with 5 server-rendered overlay
 * stops fading in over fixed progress windows, and right-edge progress
 * dots.
 *
 * Progressive enhancement contract:
 * - Server HTML renders the poster plus ALL overlay copy stacked in
 *   DOM order (SEO-complete, no-JS fallback).
 * - The live layout (see global.css) requires BOTH `@media (scripting:
 *   enabled) and (prefers-reduced-motion: no-preference)` AND the
 *   `.fr-live` class, which this component adds only after React has
 *   actually mounted. Gating on the media query alone would leave a
 *   broken ride (560vh track, sticky stage, stops 2-5 permanently
 *   hidden because nothing ever toggles `.fr-on`) whenever the client
 *   chunk 404s or hydration throws. Tying it to mount means a failed
 *   hydration degrades to the stacked static layout instead.
 * - The class is set in a layout effect, so the flip lands before the
 *   first post-hydration paint (no visible jump from the fallback).
 * - prefers-reduced-motion, no JS, or no `scripting` MQ support keeps
 *   the static stacked layout; frames are never fetched in that mode.
 */

/**
 * Layout effect on the client, no-op on the server. `useLayoutEffect`
 * warns during SSR; the fallback keeps the server render silent while
 * the client still applies `.fr-live` before paint.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const FRAME_COUNT = 101;
/** Every Nth frame is fetched up front; the rest wait until the visitor rides. */
const COARSE_STEP = 4;
/**
 * Concurrent frame requests. The fine pass is 101 images (~7.2 MB); firing
 * them all at once saturates the connection, so the frames nearest the
 * playhead arrive late and the scrub visibly holds on a stale frame. A
 * small window keeps the pipe full while letting `pump` re-prioritise
 * toward wherever the visitor actually is.
 */
const MAX_INFLIGHT = 6;
/**
 * Per-frame easing toward the scroll position. Raw scroll offset maps to a
 * discrete frame index, so a trackpad tick jumps several frames at once and
 * reads as stutter. Easing the *rendered* progress toward the *target*
 * decouples playback smoothness from input granularity.
 */
const SMOOTHING = 0.16;
/** Below this delta the ease has converged; stop the rAF loop and idle. */
const SETTLE_EPSILON = 0.0004;

// Motion amplification. The generated flight is only a few seconds of gentle
// drift, so scrubbing it across the track alone looks static. These give the
// ride its camera feel; raising them makes the world move harder.
/**
 * Extra scale applied as the ride progresses. The source master is only
 * 1280x716, so any zoom is upscaling: this ramps from 1.0 at the landing
 * frame (where first impressions are formed, and where the canvas is
 * therefore at its sharpest) up to 1 + PUSH_IN by the end, rather than the
 * reverse. Same amount of camera movement, sharpest pixel where it counts.
 */
const PUSH_IN = 0.18;
/** How much of the zoom overscan the camera drifts across, per axis. */
const DRIFT_X = 0.6;
const DRIFT_Y = 0.35;
/**
 * Portrait framing. The render is 16:9-ish with the factory in the lower
 * middle and empty background across the top.
 *
 * Cover-fitting that into a portrait phone matches the frame height almost
 * exactly (the overflow is horizontal, not vertical), so the source's empty
 * upper third lands on screen as a dead black band and there is no vertical
 * overscan available to pan out of it. PORTRAIT_FILL scales past cover to
 * manufacture that overscan; PORTRAIT_ANCHOR_Y then biases into it, toward
 * the bottom of the source where the factory actually is.
 *
 * Both interpolate to a no-op (1.0 / 0.5) as the viewport approaches the
 * source aspect, so desktop framing is bit-for-bit unchanged.
 */
const PORTRAIT_FILL = 1.45;
const PORTRAIT_ANCHOR_Y = 0.72;
/** Peak offset (px) of the copy against the world, per stop. */
const PARALLAX_PX = 90;

/** [start, end] scroll-progress windows for the 5 overlay stops. */
const STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.14],
  [0.2, 0.4],
  [0.46, 0.63],
  [0.68, 0.84],
  [0.9, 1.01],
];

const SIDES = ["center", "left", "right", "left", "center"] as const;

type FactoryRideProps = {
  /** Stop 0 — hero copy (badge, h1, counts, CTAs). Server-rendered. */
  hero: ReactNode;
  /** Stops 1-3 — narrative stop cards (hooks, agents, skills). */
  cards: readonly [ReactNode, ReactNode, ReactNode];
  /** Stop 4 — finale (verified stamp + CTAs). */
  finale: ReactNode;
};

function frameSrc(index: number): string {
  return `/world/frames/f_${String(index + 1).padStart(3, "0")}.jpg`;
}

export default function FactoryRide({ hero, cards, finale }: FactoryRideProps) {
  const [live, setLive] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dotRefs = useRef<Array<HTMLElement | null>>([]);
  const imagesRef = useRef<Array<HTMLImageElement | null>>(
    Array.from({ length: FRAME_COUNT }, () => null),
  );
  const lastPRef = useRef(0);
  const loadFineRef = useRef<(() => void) | null>(null);

  // Single source of truth for "the ride is active": this drives BOTH
  // the `.fr-live` class that unlocks the CSS ride layout and the
  // mechanics below, so the layout can never be live while the JS that
  // animates it is absent. Reduced-motion / no-`scripting`-MQ support
  // keeps `live` false, so those visitors stay on the static stacked
  // layout and fetch zero frames — unchanged by the mount gate.
  useIsomorphicLayoutEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scripting = window.matchMedia("(scripting: enabled)");
    const apply = () => setLive(!motion.matches && scripting.matches);
    apply();
    motion.addEventListener("change", apply);
    return () => motion.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!live) return;
    const root = rootRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!root || !track || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const images = imagesRef.current;
    let disposed = false;
    let ticking = false;
    let fineStarted = false;

    const drawFrame = (p: number) => {
      lastPRef.current = p;
      const exact = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.floor(p * FRAME_COUNT)),
      );
      // Nearest loaded frame at or below the exact index, so early
      // scrolls stay smooth while frames are still arriving.
      let img: HTMLImageElement | null = null;
      for (let i = exact; i >= 0; i--) {
        const candidate = images[i];
        if (candidate?.complete && candidate.naturalWidth > 0) {
          img = candidate;
          break;
        }
      }
      if (!img) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // The source flight is a few seconds of gentle drift. Spread raw over
      // the whole track it reads as a still image, so the camera move is
      // amplified here: a slow push-in plus a drift across the diorama,
      // both driven by scroll. This is the ride's actual sense of motion —
      // the frames alone are far too subtle to carry it.
      // How much taller than the source this viewport is: 0 at the source
      // aspect or wider (all desktop), rising to 1 on a phone in portrait.
      const portraitness = Math.min(
        1,
        Math.max(0, ch / cw / (ih / iw) - 1),
      );
      const fill = 1 + portraitness * (PORTRAIT_FILL - 1);
      const anchorY = 0.5 + portraitness * (PORTRAIT_ANCHOR_Y - 0.5);

      const zoom = 1 + p * PUSH_IN; // sharpest at the landing frame, pushes in
      const s = Math.max(cw / iw, ch / ih) * zoom * fill; // cover-fit, amplified
      const dw = iw * s;
      const dh = ih * s;
      const slackX = Math.max(0, dw - cw);
      const slackY = Math.max(0, dh - ch);
      // Drift diagonally across whatever overscan the zoom created.
      // `-slackY * anchorY` is the anchored equivalent of `(ch - dh) / 2`:
      // at anchorY 0.5 the two are identical, so landscape is unchanged.
      const dx = (cw - dw) / 2 + slackX * (0.5 - p) * DRIFT_X;
      const dy = -slackY * anchorY + slackY * (0.5 - p) * DRIFT_Y;
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    const fit = () => {
      // Capped deliberately. The source master is 1280x716, so a full-DPR
      // backing store on a 2x display is ~8M pixels upscaled from a 1.1MP
      // frame: it buys no real detail and costs a large scaled blit every
      // animation frame. 1.5 keeps edges clean without paying for pixels
      // the source cannot fill.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawFrame(lastPRef.current);
    };

    // Where the scroll actually is, versus where the film is currently
    // drawn. Keeping the two separate is the whole point: `targetP` snaps to
    // input, `renderP` chases it, and everything visible is driven off
    // `renderP` so the world and the copy never disagree about the position.
    let targetP = 0;
    let renderP = 0;
    let easeId = 0;

    const readProgress = () => {
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    };

    const applyProgress = (p: number) => {
      drawFrame(p);
      let cur = -1;
      STOPS.forEach(([start, end], i) => {
        const on = p >= start && p <= end;
        const el = stopRefs.current[i];
        el?.classList.toggle("fr-on", on);
        if (on) cur = i;
        // Real parallax: the copy travels against the world instead of just
        // fading. Each stop moves through its own window at a rate the
        // background does not share, so the two layers separate visibly.
        if (el && on) {
          const localP = (p - start) / Math.max(0.0001, end - start);
          el.style.setProperty("--fr-shift", `${(0.5 - localP) * PARALLAX_PX}px`);
        }
      });
      dotRefs.current.forEach((dot, i) => {
        dot?.classList.toggle("fr-cur", i === cur);
      });
      root.classList.toggle("fr-riding", p > 0.01 && p < 0.999);
    };

    // Exponential ease toward the scroll target, self-cancelling once it
    // converges so an idle page costs zero rAF callbacks.
    const ease = () => {
      easeId = 0;
      if (disposed) return;
      const delta = targetP - renderP;
      if (Math.abs(delta) <= SETTLE_EPSILON) {
        renderP = targetP;
        applyProgress(renderP);
        return;
      }
      renderP += delta * SMOOTHING;
      applyProgress(renderP);
      easeId = requestAnimationFrame(ease);
    };

    const kick = () => {
      if (!easeId && !disposed) easeId = requestAnimationFrame(ease);
    };

    const update = () => {
      targetP = readProgress();
      // The visitor is actually riding — fill in the in-between frames.
      if (targetP > 0.01) loadFineRef.current?.();
      kick();
    };

    // A viewport change moves the track/stop boundaries as well as the
    // canvas backing store, so re-fit AND recompute progress: `fit`
    // alone would leave the active stop and dots on stale windows. Resize
    // snaps instead of easing — easing a layout change reads as a glitch.
    const onResize = () => {
      fit();
      targetP = readProgress();
      renderP = targetP;
      applyProgress(renderP);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!disposed) update();
      });
    };

    // Frames load in two phases AFTER mount so the poster stays the LCP
    // element and a visitor who never scrolls does not pay for the whole
    // flight. `drawFrame` falls back to the nearest loaded frame at or
    // below the exact index, so the coarse pass alone already scrubs.
    // Requests are bounded and playhead-prioritised. The old code fired all
    // 101 images the instant `p` crossed 0.01, which saturated the
    // connection: frames arrived in request order, not in the order the
    // visitor needed them, so the scrub sat on a stale frame while bytes for
    // the far end of the flight were still in flight. `pump` instead keeps a
    // small window open and always dispatches the queued frame nearest the
    // current position, so a fast scroll re-targets the network.
    const queue: number[] = [];
    const requested = new Set<number>();
    let inflight = 0;

    // Declared as hoisted functions: `startLoad` and `pump` are mutually
    // recursive (a completed load pumps the next one).
    function startLoad(i: number) {
      inflight++;
      const img = new window.Image();
      img.decoding = "async";
      const settle = () => {
        inflight--;
        pump();
      };
      img.onload = () => {
        if (disposed) return;
        const exact = Math.floor(renderP * FRAME_COUNT);
        // Repaint when a frame near the current position arrives
        // (covers the initial poster -> canvas handoff at p = 0).
        if (Math.abs(exact - i) <= COARSE_STEP) applyProgress(renderP);
        settle();
      };
      // A 404 or decode failure must free its slot, or the pipeline wedges
      // permanently at MAX_INFLIGHT and the ride freezes mid-flight.
      img.onerror = settle;
      img.src = frameSrc(i);
      images[i] = img;
    }

    function pump() {
      if (disposed) return;
      while (inflight < MAX_INFLIGHT && queue.length > 0) {
        const exact = Math.floor(renderP * FRAME_COUNT);
        let bestAt = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let k = 0; k < queue.length; k++) {
          const dist = Math.abs(queue[k] - exact);
          if (dist < bestDist) {
            bestDist = dist;
            bestAt = k;
          }
        }
        const [next] = queue.splice(bestAt, 1);
        startLoad(next);
      }
    }

    const enqueue = (i: number) => {
      if (disposed || requested.has(i)) return;
      requested.add(i);
      queue.push(i);
    };

    // Phase 1 (idle): every Nth frame — roughly a quarter of the bytes,
    // enough for a complete (slightly coarse) scrub of the whole flight.
    const loadCoarse = () => {
      if (disposed) return;
      for (let i = 0; i < FRAME_COUNT; i += COARSE_STEP) enqueue(i);
      enqueue(FRAME_COUNT - 1);
      pump();
    };

    // Phase 2: the in-between frames, fetched only once the visitor
    // actually starts riding. Landing and clicking through costs nothing.
    const loadFine = () => {
      if (disposed || fineStarted) return;
      fineStarted = true;
      for (let i = 0; i < FRAME_COUNT; i++) enqueue(i);
      pump();
    };
    loadFineRef.current = loadFine;

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(loadCoarse)
        : window.setTimeout(loadCoarse, 250);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    fit();
    update();

    return () => {
      disposed = true;
      if (easeId) cancelAnimationFrame(easeId);
      // Drop anything not yet dispatched; in-flight images are already
      // guarded by the `disposed` checks in their handlers.
      queue.length = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      root.classList.remove("fr-riding");
    };
  }, [live]);

  const overlays: readonly ReactNode[] = [hero, ...cards, finale];

  return (
    <div ref={rootRef} className={live ? "fr-root fr-live" : "fr-root"}>
      {/* First focusable element in the ride: without it the ride
          hijacks ~5.6 viewports of scrolling with no keyboard escape.
          Only rendered in live mode — there is nothing to skip in the
          static stacked fallback. Mirrors the "Skip to main content"
          pattern in app/layout.tsx. */}
      {live ? (
        <a
          href="#ride-end"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-md focus:bg-fd-primary focus:px-4 focus:py-2 focus:text-fd-primary-foreground focus:outline-none"
        >
          Skip the scroll ride
        </a>
      ) : null}
      <div ref={trackRef} className="fr-track">
        <div className="fr-stage">
          {/* Poster-first: eager LCP image; the canvas paints over it once
              frames arrive. Decorative backdrop — copy lives in the stops. */}
          <div className="fr-poster-wrap">
            <Image
              src="/world/poster.jpg"
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              className="fr-poster"
            />
          </div>
          <canvas ref={canvasRef} className="fr-film" aria-hidden="true" />
          <div className="fr-vignette" aria-hidden="true" />

          {overlays.map((content, i) => (
            <div
              // Static ordered list of 5 slots; index identity is stable.
              key={SIDES[i] + String(i)}
              ref={(el) => {
                stopRefs.current[i] = el;
              }}
              className={i === 0 ? "fr-stop fr-on" : "fr-stop"}
              data-side={SIDES[i]}
            >
              <div>
                {content}
                {i === 0 ? (
                  <div className="fr-cue" aria-hidden="true">
                    <ChevronDown className="mx-auto h-3.5 w-3.5" />
                    scroll to ride the factory
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          <div className="fr-dots" aria-hidden="true">
            {STOPS.map((window_, i) => (
              <i
                key={window_[0]}
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Skip-link target: a zero-height marker at the very end of the
          track, so jumping here lands the first section below the ride
          at the top of the viewport. tabIndex -1 moves focus with the
          jump, so the next Tab continues into that content. */}
      <div id="ride-end" tabIndex={-1} className="focus:outline-none" />
    </div>
  );
}
