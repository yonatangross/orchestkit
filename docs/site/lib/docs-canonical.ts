import { SITE } from "@/lib/constants";

/** HTML URL a docs slug should advertise as canonical. */
export function docsHtmlCanonical(slugs: string[]): string {
  const path = slugs.join("/");
  if (path === "changelog") return `${SITE.domain}/changelog`;
  return `${SITE.domain}/docs/${path}`;
}
