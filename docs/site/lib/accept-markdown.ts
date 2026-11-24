function* mediaRanges(accept: string): Generator<string[]> {
	let parts: string[] = [];
	let start = 0;
	let quoted = false;
	for (let end = 0; end < accept.length; end++) {
		const char = accept[end];
		if (quoted && char === "\\") {
			end++;
		} else if (char === '"') {
			quoted = !quoted;
		} else if (!quoted && (char === "," || char === ";")) {
			parts.push(accept.slice(start, end).trim());
			start = end + 1;
			if (char === ",") {
				yield parts;
				parts = [];
			}
		}
	}
	// An unterminated quote makes the final range unusable.
	if (!quoted) {
		parts.push(accept.slice(start).trim());
		yield parts;
	}
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
