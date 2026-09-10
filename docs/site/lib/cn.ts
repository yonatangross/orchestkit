/** Tiny class joiner. Avoid pulling clsx/tailwind-merge into the docs site. */
export function cn(...inputs: Array<string | false | null | undefined>): string {
	return inputs.filter(Boolean).join(" ");
}
