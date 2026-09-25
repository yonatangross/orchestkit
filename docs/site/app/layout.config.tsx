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
