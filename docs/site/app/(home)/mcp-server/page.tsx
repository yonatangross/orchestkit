import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/lib/constants";

// Canonical human page is /docs/mcp. Keep this path served so old links and
// SERVED_EXACT stay honest; middleware runs before redirects.
export const metadata: Metadata = {
	alternates: { canonical: `${SITE.domain}/docs/mcp` },
};

export default function McpServerRedirect() {
	redirect("/docs/mcp");
}
