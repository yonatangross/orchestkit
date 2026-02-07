import { source } from "@/lib/source";
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

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      footer={{
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
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
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
