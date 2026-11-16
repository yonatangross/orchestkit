import { describe, expect, it } from "vitest";
import { GET } from "@/app/robots.txt/route";

// robots.txt groups per RFC 9309: a group starts at a run of User-agent lines
// and owns every rule line until the next User-agent line that follows a rule.
// Blank lines and comments do not end a group, so a rule placed after the last
// group (with no User-agent line of its own) belongs to that last group.
interface Group {
  agents: string[];
  rules: string[];
}

function parseGroups(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;
  for (const raw of body.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // Sitemap and schemamap are records outside any group.
    if (key === "sitemap" || key === "schemamap") continue;
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      lastWasAgent = true;
    } else {
      current?.rules.push(`${key}: ${value}`);
      lastWasAgent = false;
    }
  }
  return groups;
}

const YES = "content-signal: ai-train=yes, search=yes, ai-input=yes";
const NO = "content-signal: ai-train=no, search=no, ai-input=no";

describe("robots.txt Content-Signal placement", () => {
  async function groups(): Promise<Group[]> {
    return parseGroups(await GET().text());
  }

  it("the * group carries the site-wide Content-Signal exactly once", async () => {
    const star = (await groups()).find((g) => g.agents.includes("*"));
    expect(star, "no User-agent: * group").toBeDefined();
    const signals = star?.rules.filter((r) => r.startsWith("content-signal:"));
    expect(signals).toEqual([YES]);
  });

  it("no other group carries the site-wide yes signal", async () => {
    for (const g of await groups()) {
      if (g.agents.includes("*")) continue;
      expect(g.rules, `group ${g.agents.join(", ")}`).not.toContain(YES);
    }
  });

  it("each blocked crawler keeps its own no signal and nothing else", async () => {
    for (const bot of ["CCBot", "Bytespider"]) {
      const g = (await groups()).find((x) => x.agents.includes(bot));
      expect(g?.rules).toEqual(["disallow: /", NO]);
    }
  });
});
