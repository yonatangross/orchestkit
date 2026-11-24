// Splits an Accept header into media ranges, each as [type, ...params], with
// commas and semicolons inside quoted strings kept in place.
export function* mediaRanges(accept: string): Generator<string[]> {
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
