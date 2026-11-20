import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { HostMark, HOST_PAGE_ICONS } from "@/components/host-marks";
import { getSectionGlyph } from "@/components/world/station-glyphs";
import { source } from "@/lib/source";

/** Section slug of a top-level docs folder, e.g. "getting-started". */
function sectionSlug(folder: PageTree.Folder): string | null {
  // Prefer the index page URL ("/docs/<section>"), fall back to the node id.
  const fromUrl = folder.index?.url.split("/").filter(Boolean);
  if (fromUrl?.[0] === "docs" && fromUrl[1]) return fromUrl[1];
  return folder.$id?.split("/").filter(Boolean).pop() ?? null;
}

/**
 * Attach the "Thirteen Stations" glyph to each top-level section folder
 * row, overriding any lucide icon inherited from meta.json. Nested
 * folders and separators pass through untouched.
 */
function withStationGlyphs(tree: PageTree.Root): PageTree.Root {
  return {
    ...tree,
    children: tree.children.map((node) => {
      if (node.type !== "folder") return node;
      const slug = sectionSlug(node);
      const Glyph = slug ? getSectionGlyph(slug) : null;
      return Glyph ? { ...node, icon: <Glyph /> } : node;
    }),
  };
}

function withHostPageIcons(node: PageTree.Node): PageTree.Node {
  if (node.type === "folder") {
    return {
      ...node,
      index: node.index ? withHostPageIcons(node.index) : node.index,
      children: node.children.map(withHostPageIcons),
    } as PageTree.Folder;
  }
  if (node.type === "page") {
    const host = HOST_PAGE_ICONS[node.url];
    if (host) {
      return {
        ...node,
        icon: <HostMark host={host} className="size-4 shrink-0" />,
      };
    }
  }
  return node;
}

function withHostPageTree(tree: PageTree.Root): PageTree.Root {
  return {
    ...tree,
    children: tree.children.map(withHostPageIcons),
  };
}

/**
 * A root folder (Reference) lists its own index page as the first row, right
 * under the tab switcher that already reads "Reference" and links to the same
 * page (QA N07). Move that page to the folder's `index`: the sidebar stops
 * drawing it as a row, and fumadocs still counts it as the tab's first URL.
 */
function rootIndexAsFolderIndex(node: PageTree.Node): PageTree.Node {
  if (node.type !== "folder" || !node.root || node.index) return node;
  const index = node.children.find(
    (child): child is PageTree.Item =>
      child.type === "page" && child.url.split("/").filter(Boolean).length === 2,
  );
  if (!index) return node;
  return {
    ...node,
    index,
    children: node.children.filter((child) => child !== index),
  };
}

function withoutRootIndexRows(tree: PageTree.Root): PageTree.Root {
  // Reference is not listed in the top-level meta.json, so fumadocs files it
  // under `fallback`; the tab switcher reads both.
  return {
    ...tree,
    children: tree.children.map(rootIndexAsFolderIndex),
    fallback: tree.fallback && withoutRootIndexRows(tree.fallback),
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={withoutRootIndexRows(withHostPageTree(withStationGlyphs(source.pageTree)))}
      sidebar={{
        defaultOpenLevel: 0,
        collapsible: true,
        // Reference is the only root folder, so its switcher only ever held one
        // option and repeated the "Reference" link right below it (QA N07).
        tabs: false,
        // A reader who lands on a deep docs page from search had no install
        // entry in the first viewport (UX flow walk, 2026-09-25).
        banner: (
          <Link
            href="/docs/getting-started/installation"
            className="flex items-center justify-between gap-2 rounded-lg border border-fd-primary/30 bg-[var(--color-fd-primary-10)] px-3 py-2 text-sm font-medium text-fd-primary transition-colors hover:border-fd-primary/60"
          >
            Install OrchestKit
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        ),
      }}
      {...baseOptions}
    >
      {children}
    </DocsLayout>
  );
}
