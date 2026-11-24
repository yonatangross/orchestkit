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

// Only an explicit Markdown range opts in or vetoes bot fallback.
export function markdownAccept(
	accept: string,
): "accepted" | "rejected" | "unspecified" {
	let rejected = false;
	for (const [type, ...params] of mediaRanges(accept)) {
		if (type.toLowerCase() !== "text/markdown") continue;
		const zeroQuality = params.some((param) => /^q\s*=\s*0(?:\.0{0,3})?$/i.test(param));
		if (!zeroQuality) {
			return "accepted";
		}
		rejected = true;
	}
	return rejected ? "rejected" : "unspecified";
}
