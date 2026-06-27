"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface AnimateOnViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** translateY distance in px (default 12) */
  distance?: number;
}

// Reveal-or-bust safety window. If a client never scrolls (a JS-capable crawler
// that renders but does not scroll, or a fast reader past the fold), the content
// must NOT stay stuck at opacity:0. After this timeout we reveal regardless of
// IntersectionObserver, so below-fold content is never hidden from non-scrolling
// agents. Long enough that real scroll-into-view still drives the animation.
const REVEAL_FALLBACK_MS = 1200;

export function AnimateOnView({
  children,
  className = "",
  delay = 0,
  distance = 12,
}: AnimateOnViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = (animate: boolean) => {
      if (animate) {
        el.style.transition =
          "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";
      }
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };

    // Reduced-motion: reveal immediately, no animation, no observer.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal(false);
      return;
    }

    el.style.opacity = "0";
    el.style.transform = `translateY(${distance}px)`;

    // Already in (or near) the viewport at mount — reveal right away instead of
    // waiting for a scroll event that may never come.
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const rect = el.getBoundingClientRect();
    const nearViewport = rect.top < vh + 100 && rect.bottom > -100;
    if (nearViewport) {
      const id = setTimeout(() => reveal(true), delay);
      return () => clearTimeout(id);
    }

    let revealed = false;
    const revealOnce = (animate: boolean) => {
      if (revealed) return;
      revealed = true;
      reveal(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => revealOnce(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);

    // Fallback: if nothing ever scrolls this into view, reveal anyway so the
    // content is never left hidden for a non-scrolling crawler.
    const fallback = setTimeout(() => {
      revealOnce(true);
      observer.disconnect();
    }, REVEAL_FALLBACK_MS);

    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, [delay, distance]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
