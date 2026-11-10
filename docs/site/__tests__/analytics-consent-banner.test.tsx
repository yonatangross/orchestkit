// Analytics consent banner: shown until answered, both answers stored with the
// shared key, the privacy page reset asks again. The approved design is
// approved-design/posthog-consent-mockup.txt.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AnalyticsConsentBanner, AnalyticsConsentReset } from "@/components/analytics-consent-banner";

const KEY = "cookie-consent";
const region = () => screen.queryByRole("region", { name: "Analytics consent" });

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("AnalyticsConsentBanner", () => {
	it("shows when no choice is stored, with Decline and Allow", () => {
		render(<AnalyticsConsentBanner />);
		expect(region()).not.toBeNull();
		expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Allow analytics" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Privacy notice" }).getAttribute("href")).toBe("/privacy");
	});

	// Visibility without a dark pattern (consent-banner-visibility-mockup.txt).
	it("uses real buttons of type button with a visible focus ring", () => {
		render(<AnalyticsConsentBanner />);
		for (const name of ["Decline", "Allow analytics"]) {
			const button = screen.getByRole("button", { name });
			expect(button.tagName).toBe("BUTTON");
			expect(button.getAttribute("type")).toBe("button");
			expect(button.className).toContain("focus-visible:outline-2");
			expect(button.className).toContain("focus-visible:outline-fd-primary");
		}
	});

	it("is non-modal: no dialog role, no aria-modal, no overlay", () => {
		const { container } = render(<AnalyticsConsentBanner />);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(container.querySelector("[aria-modal]")).toBeNull();
		// The fixed region is the banner itself, never a full-viewport layer.
		const banner = region() as HTMLElement;
		expect(banner.className).not.toContain("inset-0");
		expect(banner.className).toContain("bottom-0");
	});

	it("names the link exactly Privacy notice, underlined", () => {
		render(<AnalyticsConsentBanner />);
		const link = screen.getByRole("link", { name: "Privacy notice" });
		expect(link.textContent).toBe("Privacy notice");
		expect(link.className).toContain("underline");
	});

	it("renders exactly one banner", () => {
		render(<AnalyticsConsentBanner />);
		expect(screen.getAllByRole("region", { name: "Analytics consent" })).toHaveLength(1);
	});

	it("stands out from the page: solid card, primary border, foreground text", () => {
		render(<AnalyticsConsentBanner />);
		const card = screen.getByTestId("analytics-consent-card");
		expect(card.className).toContain("bg-fd-card");
		expect(card.className).toContain("border-fd-primary");
		// Not translucent: the old bg-fd-background/95 let page text show through.
		expect(card.className).not.toMatch(/bg-fd-[a-z-]+\/\d+/);
		const text = card.querySelector("p") as HTMLElement;
		expect(text.className).toContain("text-fd-card-foreground");
	});

	it("puts the buttons below the sentence, right-aligned, at every width (approved mockup v1)", () => {
		render(<AnalyticsConsentBanner />);
		const card = screen.getByTestId("analytics-consent-card");
		expect(card.className).toContain("flex-col");
		// No breakpoint may turn the card into one row (the 1440 px build did).
		expect(card.className).not.toMatch(/\b\w+:flex-row\b/);
		const buttons = screen.getByRole("button", { name: "Decline" }).parentElement as HTMLElement;
		expect(buttons.className).toContain("self-end");
	});

	it("puts the Privacy notice link on its own line under the sentence (approved mockup v1)", () => {
		render(<AnalyticsConsentBanner />);
		const link = screen.getByRole("link", { name: "Privacy notice" });
		// A block element starts its own line; inline it ran on after the sentence.
		expect(link.className).toMatch(/(^|\s)block(\s|$)/);
	});

	it("gives Decline and Allow the same styling (equal weight)", () => {
		render(<AnalyticsConsentBanner />);
		const decline = screen.getByRole("button", { name: "Decline" });
		const allow = screen.getByRole("button", { name: "Allow analytics" });
		expect(decline.className).toBe(allow.className);
	});

	it("stays hidden for a visitor who already answered", () => {
		localStorage.setItem(KEY, "declined");
		render(<AnalyticsConsentBanner />);
		expect(region()).toBeNull();
	});

	it("Allow stores accepted and hides the banner", () => {
		render(<AnalyticsConsentBanner />);
		fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
		expect(localStorage.getItem(KEY)).toBe("accepted");
		expect(region()).toBeNull();
	});

	it("Decline stores declined and hides the banner", () => {
		render(<AnalyticsConsentBanner />);
		fireEvent.click(screen.getByRole("button", { name: "Decline" }));
		expect(localStorage.getItem(KEY)).toBe("declined");
		expect(region()).toBeNull();
	});

	it("the privacy page reset clears the choice and the banner returns", () => {
		localStorage.setItem(KEY, "accepted");
		render(
			<>
				<AnalyticsConsentBanner />
				<AnalyticsConsentReset />
			</>,
		);
		expect(region()).toBeNull();
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "Change analytics choice" }));
		});
		expect(localStorage.getItem(KEY)).toBeNull();
		expect(region()).not.toBeNull();
	});
});
