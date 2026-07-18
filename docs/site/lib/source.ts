import { docs } from "@/.source/server";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

// ── Sidebar decluttering (opt-in) ───────────────────────────
// The skills reference ships 114 leaf pages; listing every one in the
// sidebar drowns the rest of the docs. `getDeclutteredPageTree()` returns
// a display-only copy of `source.pageTree` where the skills folder is
// collapsed into a single "Skills" link pointing at the index page (which
// renders the full Skill Atlas). Page routes and URLs are untouched —
// this transform only affects what the sidebar shows, so /docs/reference/
// skills/<name> keeps working. `app/docs/layout.tsx` can adopt it by
// passing `tree={getDeclutteredPageTree()}` instead of `source.pageTree`.

const SKILLS_INDEX_URL = "/docs/reference/skills";

function collapseSkillsFolder(folder: Folder, index: Item): Item {
  // Reuse the folder's index item so the URL (and its $ref/$id metadata)
  // stays exactly what fumadocs generated; only the display name/icon come
  // from the folder node.
  return {
    ...index,
    name: folder.name,
    icon: folder.icon ?? index.icon,
  };
}

function transformNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== "folder") return node;
    if (node.index?.url === SKILLS_INDEX_URL) {
      return collapseSkillsFolder(node, node.index);
    }
    return { ...node, children: transformNodes(node.children) };
  });
}

const declutteredCache = new WeakMap<Root, Root>();

export function getDeclutteredPageTree(
  options: { collapseSkillLeaves?: boolean } = {},
): Root {
  const { collapseSkillLeaves = true } = options;
  const tree = source.pageTree;
  if (!collapseSkillLeaves) return tree;

  const cached = declutteredCache.get(tree);
  if (cached) return cached;

  const collapsed: Root = { ...tree, children: transformNodes(tree.children) };
  declutteredCache.set(tree, collapsed);
  return collapsed;
}
