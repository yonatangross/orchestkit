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
 * A tall track (~560vh) wraps a sticky full-viewport stage. A canvas
 * scrubs 101 pre-rendered frames by scroll progress (rAF-throttled),
 * with 5 server-rendered overlay stops fading in over fixed progress
 * windows, and right-edge progress dots.
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
      const s = Math.max(cw / iw, ch / ih); // cover-fit
      const dw = iw * s;
      const dh = ih * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawFrame(lastPRef.current);
    };

    const update = () => {
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      // The visitor is actually riding — fill in the in-between frames.
      if (p > 0.01) loadFineRef.current?.();
      drawFrame(p);
      let cur = -1;
      STOPS.forEach(([start, end], i) => {
        const on = p >= start && p <= end;
        stopRefs.current[i]?.classList.toggle("fr-on", on);
        if (on) cur = i;
      });
      dotRefs.current.forEach((dot, i) => {
        dot?.classList.toggle("fr-cur", i === cur);
      });
      root.classList.toggle("fr-riding", p > 0.01 && p < 0.999);
    };

    // A viewport change moves the track/stop boundaries as well as the
    // canvas backing store, so re-fit AND recompute progress: `fit`
    // alone would leave the active stop and dots on stale windows.
    const onResize = () => {
      fit();
      update();
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
    const loadFrame = (i: number) => {
      if (disposed || images[i]) return;
      const img = new window.Image();
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        const exact = Math.floor(lastPRef.current * FRAME_COUNT);
        // Repaint when a frame near the current position arrives
        // (covers the initial poster -> canvas handoff at p = 0).
        if (Math.abs(exact - i) <= COARSE_STEP) drawFrame(lastPRef.current);
      };
      img.src = frameSrc(i);
      images[i] = img;
    };

    // Phase 1 (idle): every Nth frame — roughly a quarter of the bytes,
    // enough for a complete (slightly coarse) scrub of the whole flight.
    const loadCoarse = () => {
      if (disposed) return;
      for (let i = 0; i < FRAME_COUNT; i += COARSE_STEP) loadFrame(i);
      loadFrame(FRAME_COUNT - 1);
    };

    // Phase 2: the in-between frames, fetched only once the visitor
    // actually starts riding. Landing and clicking through costs nothing.
    const loadFine = () => {
      if (disposed || fineStarted) return;
      fineStarted = true;
      for (let i = 0; i < FRAME_COUNT; i++) loadFrame(i);
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
          <Image
            src="/world/poster.jpg"
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="fr-poster"
          />
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
