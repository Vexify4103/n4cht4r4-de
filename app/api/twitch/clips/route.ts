import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface TwitchClip {
	id: string;
	title: string;
	view_count: number;
	created_at: string;
	duration: number;
	thumbnail_url: string;
	url: string;
	game_name: string;
}

export async function GET(req: NextRequest) {
	const sort = req.nextUrl.searchParams.get("sort") || "views";
	const period = req.nextUrl.searchParams.get("period") || "7d";

	const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
	const clientId = process.env.TWITCH_CLIENT_ID;
	const accessToken = process.env.TWITCH_ACCESS_TOKEN;

	if (!broadcasterId || !clientId || !accessToken) {
		return NextResponse.json({ clips: [] });
	}

	const headers = {
		"Client-ID": clientId,
		Authorization: `Bearer ${accessToken}`,
	};

	let allClips: TwitchClip[] = [];
	let cursor: string | undefined;

	// Fetch up to 200 clips (4 pages) to cover "all time"
	for (let page = 0; page < 4; page++) {
		const params = new URLSearchParams({
			broadcaster_id: broadcasterId,
			first: "50",
		});

		if (cursor) {
			params.set("after", cursor);
		}

		const res = await fetch(`https://api.twitch.tv/helix/clips?${params}`, {
			headers,
		}).catch(() => null);

		if (!res?.ok) break;

		const data = await res.json();
		const clips: TwitchClip[] = data.data || [];
		allClips = allClips.concat(clips);

		cursor = data.pagination?.cursor;
		if (!cursor || clips.length === 0) break;
	}

	// Filter by period
	if (period !== "all") {
		const cutoff = new Date();
		switch (period) {
			case "24h": cutoff.setDate(cutoff.getDate() - 1); break;
			case "7d": cutoff.setDate(cutoff.getDate() - 7); break;
			case "30d": cutoff.setDate(cutoff.getDate() - 30); break;
		}
		allClips = allClips.filter((c) => new Date(c.created_at) >= cutoff);
	}

	// Sort
	if (sort === "views") {
		allClips.sort((a, b) => b.view_count - a.view_count);
	} else {
		allClips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
	}

	return NextResponse.json({ clips: allClips.slice(0, 20) });
}
