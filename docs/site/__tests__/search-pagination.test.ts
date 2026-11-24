import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/search/route";

const MATCH_COUNT = 64;
const SECTION_COUNT = 10;
const SECTION_PAGE = "/docs/pagination-guide";

vi.mock("@/lib/search-indexes", () => ({
  buildSearchIndexes: () => [
    ...Array.from({ length: MATCH_COUNT }, (_, index) => ({
      id: `/docs/install-${index}`,
      title: `Install guide ${index}`,
      url: `/docs/install-${index}`,
      structuredData: { headings: [], contents: [] },
    })),
    {
      id: SECTION_PAGE,
      title: "Reference guide",
      url: SECTION_PAGE,
      structuredData: {
        headings: Array.from({ length: SECTION_COUNT }, (_, index) => ({
          id: `section-${index}`,
          content: `Pagination section ${index}`,
        })),
        contents: [],
      },
    },
  ],
}));

const searchUrl = "https://example.com/api/search?query=install";

describe("search route pagination", () => {
  it("paginates the ranked results without truncating the total", async () => {
    const first = await GET(new Request(`${searchUrl}&limit=2`));
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Total-Count")).toBe(String(MATCH_COUNT));
    const page1 = await first.json();
    expect(page1).toHaveLength(2);
    const cursor = first.headers.get("X-Next-Cursor");
    expect(cursor).toBeTruthy();

    const second = await GET(new Request(`${searchUrl}&limit=2&cursor=${cursor}`));
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Total-Count")).toBe(String(MATCH_COUNT));
    const page2 = await second.json();
    expect(page2).toHaveLength(2);

    const unpaged = await GET(new Request(searchUrl));
    expect([...page1, ...page2]).toEqual((await unpaged.json()).slice(0, 4));
  });

  it("returns all matches when the limit is omitted", async () => {
    const response = await GET(new Request(searchUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Total-Count")).toBe(String(MATCH_COUNT));
    expect(response.headers.get("X-Next-Cursor")).toBeNull();
    expect(await response.json()).toHaveLength(MATCH_COUNT);
  });

  it("can page through more than eight matches from one document", async () => {
    const url = "https://example.com/api/search?query=pagination&limit=8";
    const first = await GET(new Request(url));
    expect(first.headers.get("X-Total-Count")).toBe(String(1 + SECTION_COUNT));
    const page1 = await first.json();
    expect(page1).toHaveLength(8);
    const cursor = first.headers.get("X-Next-Cursor");
    expect(cursor).toBeTruthy();

    const second = await GET(new Request(`${url}&cursor=${cursor}`));
    expect(second.headers.get("X-Next-Cursor")).toBeNull();
    const page2 = await second.json();
    expect(page2).toHaveLength(3);
    expect([...page1, ...page2].map((row) => row.url).sort()).toEqual([
      SECTION_PAGE,
      ...Array.from({ length: SECTION_COUNT }, (_, index) => `${SECTION_PAGE}#section-${index}`),
    ]);
  });

  it.each(["", "0", "-3", "2.5", "abc", "2abc", "101"])(
    "rejects invalid limit %j",
    async (limit) => {
      const response = await GET(new Request(`${searchUrl}&limit=${limit}`));
      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toContain("application/json");
      expect(await response.json()).toMatchObject({ title: "Invalid limit", status: 400 });
    },
  );
});
