import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { SITE } from "@/lib/constants";

export const baseOptions: BaseLayoutProps = {
  nav: {
    // George stays the mark (operator, 2026-09-25), cropped to his head
    // (public/brand/george-nav.png, 84px cut from george-badge.png) and shown
    // at 30px on a rounded square. The whole 128px badge at 22px, suit and
    // ring included, read as a blurred round avatar. One-color wordmark; the
    // split gradient "Kit" read as a second brand.
    title: (
      <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-fd-foreground">
        <Image
          data-brand-mark
          src="/brand/george-nav.png"
          alt=""
          width={30}
          height={30}
          priority
          className="shrink-0 rounded-md"
        />
        <span>OrchestKit</span>
      </span>
    ),
  },
  themeSwitch: {
    enabled: true,
    mode: "light-dark-system",
  },
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
    // Declared here instead of `githubUrl`: fumadocs renders that icon as an
    // unlabeled svg role="img" (axe svg-img-alt, serious, on every page). The
    // same icon, aria-hidden, inside a link labelled "GitHub".
    {
      type: "icon",
      url: SITE.github,
      text: "GitHub",
      label: "GitHub",
      external: true,
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      ),
    },
  ],
};
