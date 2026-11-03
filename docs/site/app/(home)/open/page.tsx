import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";
import { fetchMergedPrs, fetchStars, formatOpenValue, openRows } from "@/lib/open-numbers";

// DRAFT, held for Yonatan's review. Not linked from the nav; noindex until he
// approves, then drop the robots line and link it from the footer.
export const metadata: Metadata = {
  title: "Open numbers",
  description: `${SITE.name} in public numbers: stars, merged pull requests, skills, agents and hooks.`,
  alternates: { canonical: `${SITE.domain}/open` },
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

export default async function OpenPage() {
  const [stars, mergedPrs] = await Promise.all([fetchStars(), fetchMergedPrs()]);
  const rows = openRows({ stars, mergedPrs });

  return (
    <ContentPage
      title="Open numbers"
      path="/open"
      lead={`Every number we can show about ${SITE.name}, with where it comes from. Live numbers refresh hourly.`}
    >
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Value</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="font-mono tabular-nums">{formatOpenValue(row.value)}</td>
              <td>{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        A <code>?</code> means the live read failed this hour. A placeholder means we have no public
        number yet; it stays a placeholder until there is one.
      </p>
    </ContentPage>
  );
}
