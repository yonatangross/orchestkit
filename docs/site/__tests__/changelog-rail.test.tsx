import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangelogRail } from "@/components/changelog-rail";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";

const olderVersion = CHANGELOG_ENTRIES[8].version;
const encodedOlderHash = `#${olderVersion.replaceAll(".", "%2E")}`;

function setHash(hash: string) {
  window.history.replaceState(null, "", `/changelog${hash}`);
}

function changeHash(hash: string) {
  act(() => {
    setHash(hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("ChangelogRail fragments", () => {
  it("keeps the default feed on a malformed initial fragment", () => {
    setHash("#%");
    render(<ChangelogRail />);

    const feed = within(screen.getByRole("feed", { name: "Changelog" }));
    expect(feed.getAllByRole("article")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /older releases/ })).toBeVisible();
  });

  it("renders and scrolls to a percent-encoded older release", () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    setHash(encodedOlderHash);
    render(<ChangelogRail />);

    const release = document.getElementById(olderVersion);
    expect(release).toBeVisible();
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(scroll.mock.contexts).toContain(release);
  });

  it("clears the older target on a malformed hash change and handles the next valid change", () => {
    setHash(encodedOlderHash);
    render(<ChangelogRail />);
    expect(document.getElementById(olderVersion)).toBeVisible();

    changeHash("#%E0%A4");
    expect(document.getElementById(olderVersion)).not.toBeInTheDocument();
    expect(within(screen.getByRole("feed")).getAllByRole("article")).toHaveLength(8);

    changeHash(encodedOlderHash);
    expect(document.getElementById(olderVersion)).toBeVisible();
  });
});
