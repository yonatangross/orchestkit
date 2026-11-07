// Consent with browser storage blocked (policy, some private modes): the banner
// must still close on Decline or Allow, and the choice must still apply on this
// page (Codex P2, #5098). Its own file, because the consent store keeps an
// in-memory fallback at module level and that state must not leak into other
// test files.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { AnalyticsConsentBanner, AnalyticsConsentReset } from "@/components/analytics-consent-banner";
import { getAnalyticsConsent } from "@/lib/analytics-consent";

const blocked = () => {
	throw new DOMException("The operation is insecure.", "SecurityError");
};
const spies = [
	vi.spyOn(window.localStorage, "getItem").mockImplementation(blocked),
	vi.spyOn(window.localStorage, "setItem").mockImplementation(blocked),
	vi.spyOn(window.localStorage, "removeItem").mockImplementation(blocked),
];
afterAll(() => {
	for (const s of spies) s.mockRestore();
});

const region = () => screen.queryByRole("region", { name: "Analytics consent" });

describe("consent with localStorage blocked", () => {
	it("Decline closes the banner, the reset brings it back, Allow closes it again", () => {
		render(
			<>
				<AnalyticsConsentBanner />
				<AnalyticsConsentReset />
			</>,
		);
		expect(region()).not.toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Decline" }));
		expect(region()).toBeNull();
		expect(getAnalyticsConsent()).toBe("declined");

		fireEvent.click(screen.getByRole("button", { name: "Change analytics choice" }));
		expect(region()).not.toBeNull();
		expect(getAnalyticsConsent()).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
		expect(region()).toBeNull();
		expect(getAnalyticsConsent()).toBe("accepted");
	});
});
