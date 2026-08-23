import "./global.css";
import { HQAnalytics } from "@yonatan-hq/analytics";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import CustomSearchDialog from "@/components/search-dialog";
import { WebMcpProvider } from "@/components/webmcp-provider";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { BANNER_TEXT, PAGE_SUMMARY, SITE } from "@/lib/constants";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: {
		template: `%s | ${SITE.name}`,
		// "by Yonyon" ties the studio brand to the product for name-based search
		// queries — the word appeared nowhere as text on the site before this.
		default: `${SITE.name} by Yonyon — AI Development Toolkit for Claude Code`,
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
				<Banner id={`v${SITE.version}`}>{BANNER_TEXT}</Banner>
				<RootProvider
					theme={{ defaultTheme: "dark" }}
					search={{ SearchDialog: CustomSearchDialog }}
				>
					<div id="main-content">{children}</div>
				</RootProvider>
				<HQAnalytics projectId="orchestkit" />
				<WebVitalsReporter />
				<ClientErrorReporter />
				<WebMcpProvider />
			</body>
		</html>
	);
}
