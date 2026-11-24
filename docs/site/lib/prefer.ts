const PREFERENCE_NAME = /^[\t ]*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[\t ]*(?:[=;]|$)/;

export function parsePrefer(value: string | null): Set<string> {
	const names = new Set<string>();
	if (!value) return names;

	let start = 0;
	let quoted = false;
	for (let i = 0; i <= value.length; i++) {
		const char = value[i];
		if (quoted && char === "\\") {
			i++;
		} else if (char === '"') {
			quoted = !quoted;
		} else if (!quoted && (char === "," || i === value.length)) {
			const match = PREFERENCE_NAME.exec(value.slice(start, i));
			if (match) names.add(match[1].toLowerCase());
			start = i + 1;
		}
	}
	return names;
}
