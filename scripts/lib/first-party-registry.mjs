// scripts/lib/first-party-registry.mjs: topics a FIRST-PARTY skill now covers.
//
// Same contract as TRACK_ONLY in check-labs-versions.mjs: a small, evidence-backed
// registry that a human grows deliberately. Every entry names the vendor surface that
// supersedes our restatement and the max lines OUR file on that topic may keep
// (the ork delta: floors + scars + house decisions, never the tutorial).
//
// Add an entry only with evidence the first-party surface exists and is installable
// (marketplace plugin, bundled CC skill, or a context7-resolvable doc set).
// Do NOT add speculative entries: a wrong entry here sends a swarm agent to delete
// content that has no replacement.

export const FIRST_PARTY = [
  {
    topic: 'nextjs-upgrade',
    pathPattern: /nextjs-\d+-upgrade|next[-_]upgrade/i,
    firstParty: 'skill: next-upgrade / vercel:next-upgrade (marketplace)',
    oursMax: 150,
    note: 'Vendor ships and maintains the upgrade guide + codemods.',
  },
  {
    topic: 'nextjs-cache-components',
    pathPattern: /cache-components/i,
    firstParty: 'skill: next-cache-components / vercel:next-cache-components',
    oursMax: 150,
    note: 'PPR / use cache / cacheLife / cacheTag are first-party documented.',
  },
  {
    topic: 'react-core-api',
    pathPattern: /react-19-patterns/i,
    firstParty: 'context7: /vercel/next.js + react.dev (query-docs)',
    oursMax: 150,
    note: 'React 19 API restatement; context7 serves the current version.',
  },
  {
    topic: 'core-web-vitals',
    pathPattern: /core-web-vitals|cwv-examples|rum-setup/i,
    firstParty: 'skill: web-perf / cloudflare:web-perf (marketplace)',
    oursMax: 150,
    note: 'CWV measurement + audit flow is first-party via Chrome DevTools MCP.',
  },
  {
    topic: 'tavily-api',
    pathPattern: /tavily/i,
    firstParty: 'skills: tavily-search / tavily-extract / tavily-crawl / tavily-best-practices',
    oursMax: 150,
    note: 'Tavily ships 5+ first-party skills; ours keeps routing + house limits only.',
  },
  {
    topic: 'shadcn-catalog',
    pathPattern: /shadcn-components|shadcn-catalog/i,
    firstParty: 'skill: vercel:shadcn (marketplace)',
    oursMax: 150,
    note: 'Component install/composition is first-party; ours keeps catalog constraints.',
  },
];
