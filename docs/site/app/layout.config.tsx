import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { SITE } from "@/lib/constants";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
        <Image
          src="/brand/george-badge.png"
          alt=""
          width={22}
          height={22}
          className="rounded-full ring-1 ring-[var(--yy-george-warm)]/50"
        />
        <span>
          Orchest
          <span className="bg-[image:var(--gradient-trace)] bg-clip-text text-transparent">
            Kit
          </span>
        </span>
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
      text: "Reference",
      url: "/docs/reference",
      active: "nested-url",
    },
  ],
};
