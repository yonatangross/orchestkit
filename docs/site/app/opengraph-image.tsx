import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE, COUNTS } from "@/lib/constants";

// The art, frosted panel, wordmark and host marks are baked into card-bg.png
// by design/og-card/card.py --site. Only the counts row is drawn here, so the
// numbers always match TOTALS at build time. card-layout.json says where.
import layout from "@/assets/og/card-layout.json";

export const size = { width: 1200, height: 630 };
export const alt = `${SITE.name}: ${COUNTS.skills} skills, ${COUNTS.agents} subagents and ${COUNTS.hooks} hooks for any coding agent`;
export const contentType = "image/png";

const asset = (name: string) => readFile(join(process.cwd(), "assets", "og", name));

export default async function OGImage() {
	const [bg, bold, medium] = await Promise.all([
		asset("card-bg.png"),
		asset("Geist-Bold.ttf"),
		asset("Geist-Medium.ttf"),
	]);
	const { statRow, numberSize, wordSize, wordGap, baseline, colors } = layout;
	const stats = [
		[COUNTS.skills, "skills"],
		[COUNTS.agents, "subagents"],
		[COUNTS.hooks, "hooks"],
	] as const;

	return new ImageResponse(
		(
			<div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
				{/* biome-ignore lint/performance/noImgElement: satori renders plain img only */}
				<img
					src={`data:image/png;base64,${bg.toString("base64")}`}
					width={size.width}
					height={size.height}
					alt=""
					style={{ position: "absolute", left: 0, top: 0 }}
				/>
				<div
					style={{
						position: "absolute",
						left: statRow.x,
						top: statRow.y,
						width: statRow.width,
						height: statRow.height,
						display: "flex",
						justifyContent: "space-between",
					}}
				>
					{stats.flatMap(([n, word], i) => {
						const group = (
							<div
								key={word}
								style={{
									display: "flex",
									alignItems: "baseline",
									height: statRow.height,
									paddingTop: baseline - numberSize,
								}}
							>
								<span
									style={{
										fontFamily: "Geist",
										fontWeight: 700,
										fontSize: numberSize,
										lineHeight: 1,
										color: i === 0 ? colors.first : colors.number,
									}}
								>
									{n}
								</span>
								<span
									style={{
										fontFamily: "Geist",
										fontWeight: 500,
										fontSize: wordSize,
										lineHeight: 1,
										marginLeft: wordGap,
										color: colors.word,
									}}
								>
									{word}
								</span>
							</div>
						);
						if (i === stats.length - 1) return [group];
						const divider = (
							<div
								key={`${word}-divider`}
								style={{
									width: 1,
									marginTop: 6,
									height: statRow.height - 10,
									backgroundColor: colors.divider,
								}}
							/>
						);
						return [group, divider];
					})}
				</div>
			</div>
		),
		{
			...size,
			fonts: [
				{ name: "Geist", data: bold, weight: 700, style: "normal" },
				{ name: "Geist", data: medium, weight: 500, style: "normal" },
			],
		},
	);
}
