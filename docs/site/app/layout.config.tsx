import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SITE } from "@/lib/constants";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: SITE.name,
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
