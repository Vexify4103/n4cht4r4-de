import client from "@/lib/db";
import type { ObjectId } from "mongodb";
import { getChallengeDefinitions } from "@/lib/challenges";
import { syncChallengeCompletions } from "@/lib/challenge-rewards";
import { hasTwitchApiCredentials, twitchApiFetch } from "@/lib/twitch-api";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const BROADCASTER_LOGIN = process.env.TWITCH_BROADCASTER_LOGIN || "n4cht4r4";
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID;
const CHATTERS_ACCESS_TOKEN = process.env.TWITCH_CHATTERS_ACCESS_TOKEN;
const CHATTERS_REFRESH_TOKEN = process.env.TWITCH_CHATTERS_REFRESH_TOKEN;
const CHATTERS_MODERATOR_ID = process.env.TWITCH_CHATTERS_MODERATOR_ID;
const CHATTERS_CLIENT_ID = process.env.TWITCH_CHATTERS_CLIENT_ID || process.env.AUTH_TWITCH_ID || TWITCH_CLIENT_ID;
const CHATTERS_CLIENT_SECRET = process.env.TWITCH_CHATTERS_CLIENT_SECRET || process.env.AUTH_TWITCH_SECRET;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const CREDENTIAL_ID = "twitch-chatters";

let lastPollTime = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let trackerStarted = false;

type IntegrationPollState = {
	_id: string;
	lastBucket?: number;
	lastPolledAt?: Date;
	createdAt?: Date;
};

async function claimWatchtimeBucket(now: number) {
	await client.connect();
	const bucket = Math.floor(now / POLL_INTERVAL_MS);
	try {
		const result = await client
			.db()
			.collection<IntegrationPollState>("integration_poll_state")
			.findOneAndUpdate(
				{ _id: "watchtime", lastBucket: { $ne: bucket } },
				{ $set: { lastBucket: bucket, lastPolledAt: new Date(now) }, $setOnInsert: { createdAt: new Date(now) } },
				{ upsert: true, returnDocument: "after" }
			);
		return Boolean(result);
	} catch (error) {
		if (error instanceof Error && error.message.includes("duplicate key")) return false;
		throw error;
	}
}

interface TwitchChattersResponse {
	data: Array<{ user_id: string; user_login: string }>;
	pagination?: { cursor?: string };
}

type TwitchChatter = { userId: string; login: string };
type LinkedTwitchAccounts = { userIds: Set<string>; rawUserIds: ObjectId[] };

interface TwitchTokenValidation {
	user_id: string;
	expires_in: number;
	scopes: string[];
}

interface TwitchTokenRefreshResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope?: string[];
}

interface ChatterCredentials {
	_id: string;
	accessToken: string;
	refreshToken?: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

export type WatchTimeResult = {
	status: "updated" | "skipped";
	reason?: "too_soon" | "twitch_credentials_missing" | "stream_offline" | "chatters_credentials_missing" | "chatters_unavailable";
	matchedUsers: number;
	incrementMinutes: number;
};

export type WatchTimeDiagnostic = {
	streamLive: boolean;
	chattersApi: "authorized" | "credentials_missing" | "rejected" | "unavailable";
	chatterCount?: number;
	linkedSiteUsersPresent?: number;
};

async function isStreamLive(): Promise<boolean> {
	const res = await twitchApiFetch(`/streams?user_login=${encodeURIComponent(BROADCASTER_LOGIN)}`, {
		cache: "no-store",
	});

	if (!res?.ok) return false;
	const data = await res.json();
	return (data.data?.length || 0) > 0;
}

async function validateChatterToken(accessToken: string): Promise<Date | null> {
	const res = await fetch("https://id.twitch.tv/oauth2/validate", {
		headers: { Authorization: `OAuth ${accessToken}` },
		cache: "no-store",
	}).catch(() => null);

	if (!res?.ok) return null;

	const token: TwitchTokenValidation = await res.json();
	if (!token.scopes.includes("moderator:read:chatters")) {
		console.warn("[WatchTime] Twitch chatter token is missing moderator:read:chatters.");
		return null;
	}
	if (CHATTERS_MODERATOR_ID && token.user_id !== CHATTERS_MODERATOR_ID) {
		console.warn("[WatchTime] Twitch chatter token does not belong to TWITCH_CHATTERS_MODERATOR_ID.");
		return null;
	}

	return new Date(Date.now() + token.expires_in * 1000);
}

async function saveChatterCredentials(accessToken: string, expiresAt: Date, refreshToken?: string) {
	await client.connect();
	const credentialsCol = client.db().collection<ChatterCredentials>("integration_credentials");
	const values: Partial<ChatterCredentials> = { accessToken, expiresAt, updatedAt: new Date() };
	if (refreshToken) values.refreshToken = refreshToken;

	await credentialsCol.updateOne({ _id: CREDENTIAL_ID }, { $set: values, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
}

async function refreshChatterToken(refreshToken: string): Promise<string | null> {
	if (!CHATTERS_CLIENT_ID || !CHATTERS_CLIENT_SECRET) return null;

	const body = new URLSearchParams({
		client_id: CHATTERS_CLIENT_ID,
		client_secret: CHATTERS_CLIENT_SECRET,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});
	const res = await fetch("https://id.twitch.tv/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
		cache: "no-store",
	}).catch(() => null);

	if (!res?.ok) {
		console.warn(`[WatchTime] Twitch chatter token refresh failed (${res?.status ?? "network error"}).`);
		return null;
	}

	const refreshed: TwitchTokenRefreshResponse = await res.json();
	const expiresAt = await validateChatterToken(refreshed.access_token);
	if (!expiresAt) return null;

	await saveChatterCredentials(refreshed.access_token, expiresAt, refreshed.refresh_token || refreshToken);
	return refreshed.access_token;
}

async function getChatterAccessToken(): Promise<string | null> {
	if (!CHATTERS_CLIENT_ID || !BROADCASTER_ID || !CHATTERS_MODERATOR_ID) return null;

	await client.connect();
	const credentialsCol = client.db().collection<ChatterCredentials>("integration_credentials");
	const stored = await credentialsCol.findOne({ _id: CREDENTIAL_ID });
	if (stored && stored.expiresAt.getTime() > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
		return stored.accessToken;
	}

	const refreshToken = stored?.refreshToken || CHATTERS_REFRESH_TOKEN;
	const refreshed = refreshToken ? await refreshChatterToken(refreshToken) : null;
	if (refreshed) return refreshed;

	if (!CHATTERS_ACCESS_TOKEN) return null;
	const expiresAt = await validateChatterToken(CHATTERS_ACCESS_TOKEN);
	if (!expiresAt) return null;

	await saveChatterCredentials(CHATTERS_ACCESS_TOKEN, expiresAt, CHATTERS_REFRESH_TOKEN);
	return CHATTERS_ACCESS_TOKEN;
}

async function getChatters(): Promise<TwitchChatter[] | null> {
	const accessToken = await getChatterAccessToken();
	if (!accessToken || !CHATTERS_CLIENT_ID || !BROADCASTER_ID || !CHATTERS_MODERATOR_ID) return null;

	const chatters = new Map<string, TwitchChatter>();
	let cursor: string | undefined;

	do {
		const params = new URLSearchParams({
			broadcaster_id: BROADCASTER_ID,
			moderator_id: CHATTERS_MODERATOR_ID,
			first: "1000",
		});
		if (cursor) params.set("after", cursor);

		const res = await fetch(`https://api.twitch.tv/helix/chat/chatters?${params}`, {
			headers: {
				"Client-ID": CHATTERS_CLIENT_ID,
				Authorization: `Bearer ${accessToken}`,
			},
			cache: "no-store",
		}).catch(() => null);

		if (!res?.ok) {
			console.warn(`[WatchTime] Twitch chatters request failed (${res?.status ?? "network error"})`);
			return [];
		}

		const data: TwitchChattersResponse = await res.json();
		for (const chatter of data.data) {
			chatters.set(chatter.user_id, { userId: chatter.user_id, login: chatter.user_login.toLowerCase() });
		}
		cursor = data.pagination?.cursor;
	} while (cursor);

	return [...chatters.values()];
}

async function getLinkedTwitchAccounts(chatters: TwitchChatter[]): Promise<LinkedTwitchAccounts> {
	if (chatters.length === 0) return { userIds: new Set(), rawUserIds: [] };

	await client.connect();
	const accounts = await client
		.db()
		.collection("accounts")
		.find({ provider: "twitch", providerAccountId: { $in: chatters.map((chatter) => chatter.userId) } })
		.project({ userId: 1 })
		.toArray();

	return {
		userIds: new Set(accounts.map((account) => String(account.userId))),
		rawUserIds: accounts.map((account) => account.userId),
	};
}

function userMatchesChatter(user: Record<string, unknown>, chatters: TwitchChatter[], accountUserIds: Set<string>) {
	return (
		accountUserIds.has(String(user._id)) ||
		chatters.some(
			(chatter) =>
				(typeof user.twitchUserId === "string" && chatter.userId === user.twitchUserId) ||
				(typeof user.twitchLogin === "string" && chatter.login === user.twitchLogin.toLowerCase())
		)
	);
}

export async function diagnoseWatchTime(): Promise<WatchTimeDiagnostic> {
	const streamLive = await isStreamLive();
	const accessToken = await getChatterAccessToken();
	if (!accessToken || !CHATTERS_CLIENT_ID || !BROADCASTER_ID || !CHATTERS_MODERATOR_ID) {
		return { streamLive, chattersApi: "credentials_missing" };
	}

	const params = new URLSearchParams({
		broadcaster_id: BROADCASTER_ID,
		moderator_id: CHATTERS_MODERATOR_ID,
		first: "1000",
	});
	const res = await fetch(`https://api.twitch.tv/helix/chat/chatters?${params}`, {
		headers: {
			"Client-ID": CHATTERS_CLIENT_ID,
			Authorization: `Bearer ${accessToken}`,
		},
		cache: "no-store",
	}).catch(() => null);

	if (!res) return { streamLive, chattersApi: "unavailable" };
	if (!res.ok) return { streamLive, chattersApi: "rejected" };

	const data: TwitchChattersResponse = await res.json();
	const chatters = data.data.map((chatter) => ({ userId: chatter.user_id, login: chatter.user_login.toLowerCase() }));
	const linkedAccounts = await getLinkedTwitchAccounts(chatters);
	const linkedSiteUsersPresent = linkedAccounts.userIds.size;

	return {
		streamLive,
		chattersApi: "authorized",
		chatterCount: chatters.length,
		linkedSiteUsersPresent,
	};
}

export async function trackWatchTime(): Promise<WatchTimeResult> {
	const now = Date.now();
	if (now - lastPollTime < POLL_INTERVAL_MS) {
		return { status: "skipped", reason: "too_soon", matchedUsers: 0, incrementMinutes: 0 };
	}
	lastPollTime = now;
	if (!(await claimWatchtimeBucket(now))) {
		return { status: "skipped", reason: "too_soon", matchedUsers: 0, incrementMinutes: 0 };
	}

	if (!hasTwitchApiCredentials()) {
		return { status: "skipped", reason: "twitch_credentials_missing", matchedUsers: 0, incrementMinutes: 0 };
	}

	const live = await isStreamLive();
	if (!live) {
		return { status: "skipped", reason: "stream_offline", matchedUsers: 0, incrementMinutes: 0 };
	}

	const chatters = await getChatters();
	if (chatters === null) {
		return { status: "skipped", reason: "chatters_credentials_missing", matchedUsers: 0, incrementMinutes: 0 };
	}
	if (chatters.length === 0) {
		return { status: "skipped", reason: "chatters_unavailable", matchedUsers: 0, incrementMinutes: 0 };
	}

	await client.connect();
	const db = client.db();
	const progressCol = db.collection("challenge_progress");

	const usersCol = db.collection("users");
	const linkedAccounts = await getLinkedTwitchAccounts(chatters);
	const usersWithTwitch = await usersCol
		.find({
			$or: [{ twitchLogin: { $exists: true, $ne: null } }, { twitchUserId: { $exists: true, $ne: null } }, { _id: { $in: linkedAccounts.rawUserIds } }],
		})
		.toArray();

	const matchedUsers = usersWithTwitch.filter((u) => userMatchesChatter(u, chatters, linkedAccounts.userIds));

	const INCREMENT_MINUTES = 5;
	const watchtimeChallenges = (await getChallengeDefinitions(db)).filter((challenge) => challenge.type === "watchtime" || challenge.type === "community");
	const personalChallenges = watchtimeChallenges.filter((challenge) => challenge.type === "watchtime");

	for (const user of matchedUsers) {
		const userId = user._id.toString();
		if (watchtimeChallenges.length) {
			await progressCol.bulkWrite(
				watchtimeChallenges.map((challenge) => ({
					updateOne: {
						filter: { userId, challengeId: challenge.id },
						update: {
							$inc: { progress: INCREMENT_MINUTES },
							$set: { updatedAt: new Date() },
							$setOnInsert: { userId, challengeId: challenge.id, createdAt: new Date() },
						},
						upsert: true,
					},
				}))
			);
			await syncChallengeCompletions(db, userId, personalChallenges);
		}
	}

	console.log(`[WatchTime] Tracked ${matchedUsers.length} users`);
	return { status: "updated", matchedUsers: matchedUsers.length, incrementMinutes: INCREMENT_MINUTES };
}

export function startWatchTimeTracker() {
	if (trackerStarted) return;
	trackerStarted = true;

	async function poll() {
		try {
			await trackWatchTime();
		} catch (err) {
			console.error("[WatchTime] Error:", err);
		}
		if (trackerStarted) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
	}

	poll();
	console.log("[WatchTime] Tracker started (polls every 5 min when live)");
}

export function stopWatchTimeTracker() {
	trackerStarted = false;
	if (pollTimer) clearTimeout(pollTimer);
	pollTimer = null;
}
