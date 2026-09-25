import "./global.css";
import { HQAnalytics } from "@yonatan-hq/analytics";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { BannerOffset } from "@/components/banner-offset";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { GitHubClickTracker } from "@/components/github-click-tracker";
import CustomSearchDialog from "@/components/search-dialog";
import { ThemeRevealOrigin } from "@/components/theme-reveal-origin";
import { WebMcpProvider } from "@/components/webmcp-provider";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { BANNER_TEXT, PAGE_SUMMARY, SITE, SITE_TITLE } from "@/lib/constants";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: {
		template: `%s | ${SITE.name}`,
		// Matches the OG card tagline so <title>, og:title and twitter:title agree.
		default: SITE_TITLE,
	},
	description: PAGE_SUMMARY.site,
	icons: { icon: "/favicon.svg" },
	// Default canonical = site root. Per-page metadata overrides this with its own
	// `alternates.canonical` (docs pages and the trust/pricing pages already do).
	alternates: {
		canonical: SITE.domain,
		// rel="alternate" for the Markdown twin, the machine half of the
		// content negotiation middleware.ts already performs. An agent that can
		// read the HTML head now learns the Markdown URL without having to know
		// the "append .md" convention or to re-request with Accept: text/markdown.
		//
		// Scope matters more than coverage here. This default only reaches pages
		// that do NOT set their own `alternates`, because Next merges metadata
		// shallowly per top-level key. The 13 marketing pages under app/(home)
		// each set `alternates.canonical`, which replaces this object wholesale,
		// so none of them advertise a twin. That is deliberate: mdTarget() in
		// middleware.ts only maps "/" and "/docs/*", so a rel="alternate" on a
		// marketing page would point at a URL that answers with HTML, which is
		// worse for an agent than no link at all.
		types: { "text/markdown": `${SITE.domain}/index.md` },
	},
	// Do not set openGraph/twitter title or description here. Next merges those
	// objects shallowly, so a fixed root title would override every child page
	// that only sets `title` (about, pricing, community, ...). Homepage social
	// copy is set on app/(home)/page.tsx; other pages inherit from their own
	// title + description.
	openGraph: {
		siteName: SITE.name,
		type: "website",
		url: SITE.domain,
	},
	twitter: {
		card: "summary_large_image",
	},
	metadataBase: new URL(SITE.domain),
};

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${geist.variable} ${geistMono.variable}`}
		>
			<body className="flex min-h-screen flex-col font-[family-name:var(--font-geist)]">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-md focus:bg-fd-primary focus:px-4 focus:py-2 focus:text-fd-primary-foreground focus:outline-none"
				>
					Skip to main content
				</a>
				{/* Own row, not sticky (operator, 2026-09-25). Fumadocs pins the banner
				    sticky top-0 while the nav also sticks at top 0, so after any scroll
				    the banner text showed through the nav (48px overlap). It now scrolls
				    away; BannerOffset feeds docs layouts its visible height, and the
				    side padding keeps the close X off the text on phones. */}
				<Banner
					id={`v${SITE.version}`}
					className="relative ps-10 pe-10"
					changeLayout={false}
					// A named region, so the announcement sits in a landmark (axe
					// "region" fired on every route, QA 2026-09-25).
					role="region"
					aria-label="Release announcement"
				>
					{BANNER_TEXT}
				</Banner>
				<BannerOffset bannerId={`v${SITE.version}`} />
				<RootProvider
					theme={{ defaultTheme: "dark" }}
					search={{ SearchDialog: CustomSearchDialog }}
				>
					<div id="main-content">{children}</div>
				</RootProvider>
				<HQAnalytics projectId="orchestkit" />
				<WebVitalsReporter />
				<ClientErrorReporter />
				<GitHubClickTracker />
				<ThemeRevealOrigin />
				<WebMcpProvider />
			</body>
		</html>
	);
}
