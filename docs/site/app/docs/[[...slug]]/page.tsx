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

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
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
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            ContextualSkillSidebar: LazyContextualSkillSidebar,
            SkillDependencyGraph: LazySkillDependencyGraph,
            SkillRecommender: LazySkillRecommender,
          }}
        />
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
