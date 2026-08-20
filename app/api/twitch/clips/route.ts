import { NextRequest, NextResponse } from "next/server";
import { hasTwitchApiCredentials, twitchApiFetch } from "@/lib/twitch-api";

export const runtime = "nodejs";

interface TwitchClip {
	id: string;
	title: string;
	view_count: number;
	created_at: string;
	duration: number;
	thumbnail_url: string;
	url: string;
	game_id: string;
	game_name?: string;
	creator_name?: string;
}

type ClipCache = { clips: TwitchClip[]; expiresAt: number; fetchedAt: string };

let clipCache: ClipCache | null = null;
let clipRequest: Promise<ClipCache> | null = null;

function twitchCredentials() {
	const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
	if (!broadcasterId || !hasTwitchApiCredentials()) return null;
	return { broadcasterId };
}

async function fetchAllClips(): Promise<ClipCache> {
	const credentials = twitchCredentials();
	if (!credentials) throw new Error("Twitch-Zugangsdaten fehlen.");

	const clips: TwitchClip[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < 10; page += 1) {
		const params = new URLSearchParams({ broadcaster_id: credentials.broadcasterId, first: "100" });
		if (cursor) params.set("after", cursor);
		const response = await twitchApiFetch(`/clips?${params}`, { cache: "no-store" });
		if (!response?.ok) throw new Error(`Twitch Clips antwortete mit Status ${response?.status || 503}.`);
		const data = (await response.json()) as { data?: TwitchClip[]; pagination?: { cursor?: string } };
		clips.push(...(data.data || []));
		cursor = data.pagination?.cursor;
		if (!cursor || !data.data?.length) break;
	}

	const gameIds = [...new Set(clips.map((clip) => clip.game_id).filter(Boolean))].slice(0, 100);
	if (gameIds.length) {
		const params = new URLSearchParams();
		gameIds.forEach((gameId) => params.append("id", gameId));
		const response = await twitchApiFetch(`/games?${params}`, { cache: "no-store" });
		if (response?.ok) {
			const data = (await response.json()) as { data?: { id: string; name: string }[] };
			const gameNames = new Map((data.data || []).map((game) => [game.id, game.name]));
			clips.forEach((clip) => {
				clip.game_name = gameNames.get(clip.game_id) || "N4cht4r4";
			});
		}
	}

	return { clips, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + 300_000 };
}

async function getClipCache() {
	if (clipCache && clipCache.expiresAt > Date.now()) return clipCache;
	if (!clipRequest) {
		clipRequest = fetchAllClips()
			.then((result) => (clipCache = result))
			.finally(() => {
				clipRequest = null;
			});
	}
	return clipRequest;
}

export async function GET(request: NextRequest) {
	if (!twitchCredentials()) return NextResponse.json({ clips: [], total: 0, hasMore: false, error: "Twitch ist noch nicht konfiguriert." });

	const sort = request.nextUrl.searchParams.get("sort") === "date" ? "date" : "views";
	const period = ["7d", "30d", "all"].includes(request.nextUrl.searchParams.get("period") || "") ? request.nextUrl.searchParams.get("period")! : "all";
	const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10) || 0);
	const limit = Math.min(1_000, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") || "18", 10) || 18));

	try {
		const cached = await getClipCache();
		let clips = [...cached.clips];
		if (period !== "all") {
			const days = period === "7d" ? 7 : 30;
			const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
			clips = clips.filter((clip) => new Date(clip.created_at).getTime() >= cutoff);
		}
		clips.sort((left, right) => (sort === "views" ? right.view_count - left.view_count : new Date(right.created_at).getTime() - new Date(left.created_at).getTime()));
		const total = clips.length;
		return NextResponse.json({ clips: clips.slice(offset, offset + limit), total, hasMore: offset + limit < total, fetchedAt: cached.fetchedAt });
	} catch (error) {
		return NextResponse.json({ clips: [], total: 0, hasMore: false, error: error instanceof Error ? error.message : "Clips konnten nicht geladen werden." }, { status: 502 });
	}
}
