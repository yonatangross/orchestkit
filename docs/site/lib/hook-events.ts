import hooksMeta from "@/content/docs/reference/hooks/meta.json";

export type HookEventPage = {
  slug: string;
  label: string;
  href: string;
};

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const HOOK_EVENT_PAGES: HookEventPage[] = hooksMeta.pages
  .filter((slug): slug is string => slug !== "index" && slug !== "spotlights")
  .map((slug) => ({
    slug,
    label: labelFromSlug(slug),
    href: `/docs/reference/hooks/${slug}`,
  }));
