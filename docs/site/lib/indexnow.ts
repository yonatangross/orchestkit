import { SITE } from "@/lib/constants";

// IndexNow key is public by design: the protocol hosts it at /{key}.txt.
export const INDEXNOW_KEY = "c8f0e2a1b94d4e6f8a7c1d2e3f4a5b6c";

export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

export const INDEXNOW_URLS = [
	`${SITE.domain}/developers`,
	`${SITE.domain}/openapi`,
	`${SITE.domain}/docs/mcp`,
	`${SITE.domain}/docs/sdk`,
] as const;

export function indexNowPayload(): {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
} {
	return {
		host: new URL(SITE.domain).host,
		key: INDEXNOW_KEY,
		keyLocation: `${SITE.domain}${INDEXNOW_KEY_PATH}`,
		urlList: [...INDEXNOW_URLS],
	};
}
