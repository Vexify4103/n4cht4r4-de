import { NextResponse } from "next/server";
import { hasTwitchApiCredentials, twitchApiFetch } from "@/lib/twitch-api";

export const runtime = "nodejs";

export async function GET() {
	const broadcasterId = process.env.TWITCH_BROADCASTER_ID;

	if (!broadcasterId || !hasTwitchApiCredentials()) {
		return NextResponse.json({ segments: [], isLive: false, live: null, fallback: true });
	}

	const [scheduleRes, streamRes] = await Promise.all([
		twitchApiFetch(`/schedule?broadcaster_id=${broadcasterId}`, {
			next: { revalidate: 300 },
		}),
		twitchApiFetch(`/streams?user_id=${broadcasterId}`, { cache: "no-store" }),
	]);

	const segments = scheduleRes?.ok ? (await scheduleRes.json())?.data?.segments || [] : [];
	const stream = streamRes?.ok ? (await streamRes.json())?.data?.[0] || null : null;

	return NextResponse.json({
		segments,
		isLive: Boolean(stream),
		live: stream
			? {
					title: stream.title || "N4cht4r4 ist live",
					category: stream.game_name || "Just Chatting",
					viewerCount: Number(stream.viewer_count || 0),
					startedAt: stream.started_at || null,
				}
			: null,
	});
}
