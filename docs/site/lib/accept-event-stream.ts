import { mediaRanges } from "./media-ranges";

const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

// RFC 9110 weight of a media range; a malformed q is read as the default 1.
function weight(params: string[]): number {
	for (const param of params) {
		const separator = param.indexOf("=");
		if (separator < 0 || param.slice(0, separator).trim().toLowerCase() !== "q") continue;
		const value = param.slice(separator + 1).trim();
		return QVALUE.test(value) ? Number(value) : 1;
	}
	return 1;
}

// /ask streams for Accept only when the client names text/event-stream with a
// non-zero weight that is not below the weight it gives JSON. Wildcards never
// opt in to SSE; they only weigh the JSON alternative, most specific first.
export function acceptPrefersEventStream(accept: string): boolean {
	let eventStream = 0;
	let json = 0;
	let jsonSpecificity = -1;
	for (const [range, ...params] of mediaRanges(accept)) {
		const type = range.toLowerCase();
		const q = weight(params);
		if (type === "text/event-stream") {
			eventStream = Math.max(eventStream, q);
			continue;
		}
		const specificity =
			type === "application/json" ? 2 : type === "application/*" ? 1 : type === "*/*" ? 0 : -1;
		if (specificity > jsonSpecificity) {
			jsonSpecificity = specificity;
			json = q;
		} else if (specificity === jsonSpecificity && specificity >= 0) {
			json = Math.max(json, q);
		}
	}
	return eventStream > 0 && eventStream >= json;
}
