import { docs } from "@/.source/server";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

// Sidebar decluttering note: the 114 skill / 37 agent / hook leaf pages are
// kept OUT of the sidebar by trimming `pages` in each catalog's meta.json
// (see content/docs/reference/*/meta.json, emitted by
// scripts/_build-docs-generate.py). Their routes still build from the .mdx
// files and stay in the sitemap; browsing lives in the Skill Atlas instead.
//
// A previous revision also exported a `getDeclutteredPageTree()` transform
// that tried to collapse those folders at runtime. It was a no-op — the
// Reference section is a `root: true` subtree that fumadocs resolves
// separately, so the transform never matched the folders it targeted — and
// has been removed rather than left as a second mechanism for one job.
