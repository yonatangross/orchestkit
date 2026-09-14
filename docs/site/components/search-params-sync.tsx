"use client";

import { Suspense, useEffect, useEffectEvent } from "react";
import { useSearchParams } from "next/navigation";

function Reader({ onChange }: { onChange: (params: URLSearchParams) => void }) {
	const query = useSearchParams().toString();
	const report = useEffectEvent((q: string) => onChange(new URLSearchParams(q)));
	useEffect(() => {
		report(query);
	}, [query]);
	return null;
}

/**
 * Reports the current query string to a client component without making the
 * route dynamic.
 *
 * Why this shape: the homepage used to read the `searchParams` page prop, which
 * opts `/` into per-request rendering (`cache-control: private, no-store`, cold
 * TTFB around 3s). Calling `useSearchParams` directly inside the picker would
 * instead bail the WHOLE picker out to client rendering up to the nearest
 * Suspense boundary, so the prerendered HTML would lose the install commands.
 * Isolating the hook in a component that renders nothing keeps the bailout
 * scoped to this null subtree: the parent prerenders with its defaults and
 * adopts the URL value (deep links like `/?host=cursor`) after hydration.
 */
export function SearchParamsSync({
	onChange,
}: {
	onChange: (params: URLSearchParams) => void;
}) {
	return (
		<Suspense fallback={null}>
			<Reader onChange={onChange} />
		</Suspense>
	);
}
