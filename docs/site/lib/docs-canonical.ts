import { SITE } from "@/lib/constants";

/** HTML URL a docs slug should advertise as canonical. */
export function docsHtmlCanonical(slugs: string[]): string {
  const path = slugs.join("/");
  if (path === "changelog") return `${SITE.domain}/changelog`;
  // scripts/_build-docs-generate.py copies the hook spotlights into the hook
  // reference. The source page is canonical for both URLs.
  return `${SITE.domain}/docs/${path.replace(/^reference\/hooks\/spotlights\//, "hooks/spotlights/")}`;
}
