import "./global.css";
import { HQAnalytics } from "@yonatan-hq/analytics";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AgentationWrapper } from "@/components/agentation-wrapper";
import CustomSearchDialog from "@/components/search-dialog";
import { WebMcpProvider } from "@/components/webmcp-provider";
import { BANNER_TEXT, COUNTS, SITE } from "@/lib/constants";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: {
		template: `%s | ${SITE.name}`,
		default: `${SITE.name} — AI Development Toolkit`,
	},
	description: `${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks for Claude Code. Stop explaining your stack. Start shipping.`,
	icons: { icon: "/favicon.svg" },
	// Default canonical = site root. Per-page metadata overrides this with its own
	// `alternates.canonical` (docs pages and the trust/pricing pages already do).
	alternates: { canonical: SITE.domain },
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
				<RootProvider search={{ SearchDialog: CustomSearchDialog }}>
					<div id="main-content">{children}</div>
				</RootProvider>
				<HQAnalytics projectId="orchestkit" />
				<AgentationWrapper />
				<WebMcpProvider />
			</body>
		</html>
	);
}
