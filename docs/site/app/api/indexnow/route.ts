import { NextRequest, NextResponse } from "next/server";
import { INDEXNOW_KEY, indexNowPayload } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
	if (req.headers.get("x-vercel-cron") === "1") return true;
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const auth = req.headers.get("authorization");
	return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
	if (!authorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	const payload = indexNowPayload();
	const res = await fetch("https://api.indexnow.org/indexnow", {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(payload),
	});
	return NextResponse.json(
		{
			ok: res.ok,
			indexNowStatus: res.status,
			key: INDEXNOW_KEY,
			submitted: payload.urlList,
		},
		{ status: res.ok ? 200 : 502 },
	);
}
