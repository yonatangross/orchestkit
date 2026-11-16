import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsTable } from "@/components/hook-event-table";

function cell(tag: "td" | "th", children: React.ReactNode, key: string) {
  return tag === "th" ? <th key={key}>{children}</th> : <td key={key}>{children}</td>;
}

describe("hook event table anchors", () => {
  it("keeps the generator's anchor id on the card the library links to", () => {
    const html = renderToStaticMarkup(
      <DocsTable>
        <thead>
          <tr>
            {["Hook", "Matcher", "Behavior", "Description"].map((h) => cell("th", h, h))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span id="hook-bash-pretool-bash-sync-bash-dispatcher"></span>
              <code>sync-bash-dispatcher</code>
            </td>
            <td>
              <code>Bash</code>
            </td>
            <td>Blocks</td>
            <td>Checks every Bash call.</td>
          </tr>
        </tbody>
      </DocsTable>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const card = doc.getElementById("hook-bash-pretool-bash-sync-bash-dispatcher");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("sync-bash-dispatcher");
  });
});
