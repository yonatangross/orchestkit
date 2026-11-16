import { HOME_FAQS } from "@/components/structured-data";

// The home FAQ in the server HTML (SEO gaps row 3, 15.11.2026). The FAQPage
// JSON-LD and this section read the same HOME_FAQS, so the visible text and
// the structured data cannot drift. Every answer is open in the markup: no
// accordion, tab or hidden attribute, because a crawler that does not run
// JavaScript reads a closed panel as an empty one.
export function HomeFaq() {
	return (
		<section aria-labelledby="faq-heading" className="border-b border-fd-border" id="faq">
			<div className="mx-auto max-w-[820px] px-7 py-14">
				<h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
					Questions
				</h2>
				<dl className="mt-6 space-y-6">
					{HOME_FAQS.map((f) => (
						<div key={f.question}>
							<dt>
								<h3 className="text-base font-semibold text-fd-foreground">{f.question}</h3>
							</dt>
							<dd className="mt-2 leading-7 text-fd-muted-foreground">{f.answer}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
