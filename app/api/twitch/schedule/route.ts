import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
	const clientId = process.env.TWITCH_CLIENT_ID;
	const accessToken = process.env.TWITCH_ACCESS_TOKEN;

	if (!broadcasterId || !clientId || !accessToken) {
		return NextResponse.json({ segments: [], isLive: false, live: null, fallback: true });
	}

	const headers = {
		"Client-ID": clientId,
		Authorization: `Bearer ${accessToken}`,
	};

	const [scheduleRes, streamRes] = await Promise.all([
		fetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${broadcasterId}`, {
			headers,
			next: { revalidate: 300 },
		}).catch(() => null),
		fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, {
			headers,
			next: { revalidate: 60 },
		}).catch(() => null),
	]);

	const segments = scheduleRes?.ok ? (await scheduleRes.json())?.data?.segments || [] : [];
	const stream = streamRes?.ok ? (await streamRes.json())?.data?.[0] || null : null;

	return NextResponse.json({
		segments,
		isLive: Boolean(stream),
		live: stream ? {
			title: stream.title || "N4cht4r4 ist live",
			category: stream.game_name || "Just Chatting",
			viewerCount: Number(stream.viewer_count || 0),
			startedAt: stream.started_at || null,
		} : null,
	});
}
