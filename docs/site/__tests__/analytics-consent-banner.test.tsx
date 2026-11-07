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
		expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe("/privacy");
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
