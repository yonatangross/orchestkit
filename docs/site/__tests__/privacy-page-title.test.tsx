// #5186: the consent banner's link reads "Privacy notice" (approved mockup v1),
// so the page it opens must use the same name. The title moved, not the link.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "@/app/(home)/privacy/page";

describe("/privacy", () => {
	it("titles itself the same name the consent banner link uses (#5186)", () => {
		render(<PrivacyPage />);
		expect(screen.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeTruthy();
		expect(metadata.title).toBe("Privacy notice");
	});
});
