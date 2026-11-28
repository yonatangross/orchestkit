import { mediaRanges } from "./media-ranges";

function qValue(params: string[]): number {
	for (const param of params) {
		const separator = param.indexOf("=");
		if (separator < 0) continue;
		if (param.slice(0, separator).trim().toLowerCase() !== "q") continue;
		const raw = param.slice(separator + 1).trim();
		if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)) return 1;
		return Number.parseFloat(raw);
	}
	return 1;
}

// Positive acceptance of HTML. q=0 means the client refuses the type, so it is
// not positive acceptance even when a wildcard elsewhere in the header survives.
export function acceptsHtml(accept: string): boolean {
	for (const [type, ...params] of mediaRanges(accept)) {
		if (type.toLowerCase() === "text/html" && qValue(params) > 0) return true;
	}
	return false;
}

function matchMarkdownParams(params: string[]) {
	let specificity = 0;
	let rejected = false;
	for (const param of params) {
		if (!param) continue;
		const separator = param.indexOf("=");
		if (separator < 0) return null;
		const key = param.slice(0, separator).trim().toLowerCase();
		const value = param.slice(separator + 1).trim();
		if (key === "q") {
			rejected ||= /^0(?:\.0{0,3})?$/.test(value);
			continue;
		}
		if (key !== "charset") return null;
		const charset = (
			value.startsWith('"') && value.endsWith('"')
				? value.slice(1, -1).replace(/\\(.)/g, "$1")
				: value
		).toLowerCase();
		if (charset !== "utf-8" && charset !== "csutf8") return null;
		specificity = 1;
	}
	return { specificity, rejected };
}

// Only an explicit Markdown range opts in or vetoes bot fallback.
export function markdownAccept(
	accept: string,
): "accepted" | "rejected" | "unspecified" {
	let bestSpecificity = -1;
	let rejected = false;
	for (const [type, ...params] of mediaRanges(accept)) {
		if (type.toLowerCase() !== "text/markdown") continue;
		const match = matchMarkdownParams(params);
		if (!match) continue;
		if (
			match.specificity > bestSpecificity ||
			(match.specificity === bestSpecificity && !match.rejected)
		) {
			bestSpecificity = match.specificity;
			rejected = match.rejected;
		}
	}
	if (bestSpecificity < 0) return "unspecified";
	return rejected ? "rejected" : "accepted";
}
