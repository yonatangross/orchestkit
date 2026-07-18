import { source } from "@/lib/source";
import { findNeighbour } from "fumadocs-core/page-tree";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
  EditOnGitHub,
  PageLastUpdate,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { SITE } from "@/lib/constants";
import { breadcrumbNode } from "@/components/structured-data";
import { LazyContextualSkillSidebar } from "@/components/lazy/contextual-skill-sidebar";
import { LazySkillDependencyGraph } from "@/components/lazy/skill-dep-graph";
import { LazySkillRecommender } from "@/components/lazy/skill-recommender";
import { GeorgeDivider } from "@/components/world/george";
import { SkillDossier } from "@/components/world/skill-dossier";
import { getSectionGlyph } from "@/components/world/station-glyphs";
import { SKILLS } from "@/lib/generated/skills-data";

/**
 * A skill reference page is /docs/reference/skills/<name> where <name>
 * exists in the generated skills dataset.
 */
function skillSlugOf(slugs: string[]): string | null {
  if (
    slugs.length === 3 &&
    slugs[0] === "reference" &&
    slugs[1] === "skills" &&
    slugs[2] in SKILLS
  ) {
    return slugs[2];
  }
  return null;
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const skillSlug = skillSlugOf(page.slugs);
  // Section identity row above the title: glyph chip + section label.
  const SectionGlyph = getSectionGlyph(page.slugs[0] ?? "");
  const sectionLabel = (page.slugs[0] ?? "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const lastModified =
    page.data.lastModified instanceof Date
      ? page.data.lastModified
      : undefined;
  // Restore Fumadocs' built-in prev/next footer nav: the flux DocsPage `footer`
  // does NOT auto-derive neighbours — they must be passed explicitly. The old
  // `footer={{ children }}` override silently dropped prev/next site-wide.
  const neighbours = findNeighbour(source.pageTree, page.url);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.data.title,
    description: page.data.description,
    url: `${SITE.domain}/docs/${page.slugs.join("/")}`,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.domain,
    },
    ...(lastModified ? { dateModified: lastModified.toISOString() } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    ...breadcrumbNode([
      { name: SITE.name, url: SITE.domain },
      { name: "Docs", url: `${SITE.domain}/docs` },
      {
        name: page.data.title,
        url: `${SITE.domain}/docs/${page.slugs.join("/")}`,
      },
    ]),
  };

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      breadcrumb={{ enabled: true }}
      footer={{
        items: neighbours,
        children: (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <EditOnGitHub
              href={`${SITE.github}/edit/main/docs/site/content/docs/${page.slugs.join("/")}.mdx`}
            />
            {lastModified ? <PageLastUpdate date={lastModified} /> : null}
          </div>
        ),
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="relative">
        {SectionGlyph ? (
          <div aria-hidden="true" className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-fd-primary/25 bg-fd-primary/10 text-fd-primary [&_svg]:h-4 [&_svg]:w-4">
              <SectionGlyph />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-fd-muted-foreground">
              {sectionLabel}
            </span>
          </div>
        ) : null}
        <DocsTitle>{page.data.title}</DocsTitle>
        {/* Skill pages: the dossier below is the description's single home. */}
        {skillSlug ? null : (
          <DocsDescription>{page.data.description}</DocsDescription>
        )}
      </div>
      {skillSlug ? <SkillDossier slug={skillSlug} /> : null}
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            ContextualSkillSidebar: LazyContextualSkillSidebar,
            SkillDependencyGraph: LazySkillDependencyGraph,
            SkillRecommender: LazySkillRecommender,
          }}
        />
        <GeorgeDivider />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const url = `${SITE.domain}/docs/${params.slug?.join("/") ?? ""}`;

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url,
      siteName: SITE.name,
      type: "article",
      images: [`/api/og/${params.slug?.join("/") ?? ""}`],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
    },
    alternates: { canonical: url },
  };
}
