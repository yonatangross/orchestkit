import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
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

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={withStationGlyphs(source.pageTree)}
      sidebar={{ defaultOpenLevel: 0, collapsible: true }}
      {...baseOptions}
    >
      {children}
    </DocsLayout>
  );
}
