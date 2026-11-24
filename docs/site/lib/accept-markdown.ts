// Only an explicit Markdown range opts in or vetoes bot fallback.
export function markdownAccept(
	accept: string,
): "accepted" | "rejected" | "unspecified" {
	let rejected = false;
	// Delimiters inside quoted media parameters are not list separators.
	const ranges = accept.replace(/"(?:[^"\\]|\\.)*"/g, '""').split(",");
	for (const range of ranges) {
		const [type, ...params] = range.split(";");
		if (type.trim().toLowerCase() !== "text/markdown") continue;
		const zeroQuality = params.some((param) =>
			/^q\s*=\s*0(?:\.0{0,3})?$/i.test(param.trim()),
		);
		if (!zeroQuality) {
			return "accepted";
		}
		rejected = true;
	}
	return rejected ? "rejected" : "unspecified";
}
