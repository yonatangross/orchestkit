"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface AnimateOnViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** translateY distance in px (default 12) */
  distance?: number;
}

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

    // Check reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      return;
    }

    el.style.opacity = "0";
    el.style.transform = `translateY(${distance}px)`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.transition = "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }, delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, distance]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
