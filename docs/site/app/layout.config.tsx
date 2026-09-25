import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SITE } from "@/lib/constants";

export const baseOptions: BaseLayoutProps = {
  nav: {
    // Vector monogram, not the 128px George raster: shrunk to 22px the
    // detailed husky read as a blurred round avatar (operator, 2026-09-25),
    // and components/world/george.tsx keeps the detailed dog out of chrome.
    // One-color wordmark; the split gradient "Kit" read as a second brand.
    title: (
      <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-fd-foreground">
        <svg
          data-brand-mark
          viewBox="0 0 32 32"
          width={22}
          height={22}
          aria-hidden="true"
          className="shrink-0"
        >
          <rect width="32" height="32" rx="8" fill="var(--color-fd-primary)" />
          <circle cx="16" cy="16" r="7.5" fill="none" stroke="#fff" strokeWidth="3.5" />
        </svg>
        <span>OrchestKit</span>
      </span>
    ),
  },
  themeSwitch: {
    enabled: true,
    mode: "light-dark-system",
  },
  githubUrl: SITE.github,
  links: [
    {
      text: "Docs",
      url: "/docs/foundations/overview",
      active: "nested-url",
    },
    {
      text: "Cookbook",
      url: "/docs/cookbook/implement-feature",
      active: "nested-url",
    },
    {
      text: "Changelog",
      url: "/changelog",
      active: "url",
    },
    {
      text: "Reference",
      url: "/docs/reference",
      active: "nested-url",
    },
    {
      text: "Community",
      url: "/community",
    },
  ],
};
