import type { Db } from "mongodb";
import { getChallengeDefinitions, matchMatchesChallenge } from "@/lib/challenges";

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REQUEST_DELAY_MS = 60;
let lastRequestAt = 0;

type RiotParticipant = {
	puuid: string;
	kills: number;
	win: boolean;
};

type RiotMatch = {
	metadata?: { matchId?: string };
	info?: {
		gameMode?: string;
		queueId?: number;
		gameStartTimestamp?: number;
		participants?: RiotParticipant[];
	};
};

type ChallengeSyncState = {
	userId: string;
	lastCheckedMatchTime?: number;
	seenMatchIds?: string[];
	createdAt?: Date;
	updatedAt?: Date;
};

async function riotFetch(url: string) {
	const wait = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
	if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
	lastRequestAt = Date.now();
	return fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY || "" } });
}

export async function syncRiotChallengesForUser(
	db: Db,
	userId: string,
	puuid: string,
	maxMatches = 30,
) {
	if (!RIOT_API_KEY) throw new Error("Riot API key not configured");

	const syncCollection = db.collection<ChallengeSyncState>("challenge_sync");
	const progressCollection = db.collection("challenge_progress");
	const syncState = await syncCollection.findOne({ userId });
	const seenIds = new Set<string>(syncState?.seenMatchIds || []);
	const params = new URLSearchParams({ count: String(maxMatches) });

	if (syncState?.lastCheckedMatchTime) {
		params.set("startTime", String(Math.floor(syncState.lastCheckedMatchTime / 1000)));
	}

	const idsResponse = await riotFetch(`https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`);
	if (!idsResponse.ok) throw new Error(`Riot match list failed (${idsResponse.status})`);

	const fetchedIds = await idsResponse.json() as string[];
	const matchIds = fetchedIds.filter((id) => !seenIds.has(id));
	if (matchIds.length === 0) return { matchesChecked: 0, progressUpdates: 0 };

	const definitions = (await getChallengeDefinitions(db)).filter((challenge) =>
		challenge.type === "wins" || challenge.type === "kills" || challenge.type === "matches"
	);
	const increments = new Map<string, number>();
	let latestTimestamp = syncState?.lastCheckedMatchTime || 0;
	const processedIds: string[] = [];

	for (const matchId of matchIds) {
		const matchResponse = await riotFetch(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
		if (!matchResponse.ok) continue;
		const match = await matchResponse.json() as RiotMatch;
		const info = match.info;
		if (!info?.participants) continue;

		const participant = info.participants.find((entry) => entry.puuid === puuid);
		if (!participant) continue;
		processedIds.push(matchId);
		latestTimestamp = Math.max(latestTimestamp, info.gameStartTimestamp || 0);

		for (const challenge of definitions) {
			if (!matchMatchesChallenge(challenge, {
				gameMode: info.gameMode || "",
				queueId: info.queueId || 0,
			})) continue;

			const amount = challenge.type === "wins"
				? participant.win ? challenge.winMultiplier || 1 : 0
				: challenge.type === "matches"
					? 1
					: participant.kills || 0;
			if (amount > 0) increments.set(challenge.id, (increments.get(challenge.id) || 0) + amount);
		}
	}

	if (increments.size > 0) {
		await progressCollection.bulkWrite([...increments].map(([challengeId, amount]) => ({
			updateOne: {
				filter: { userId, challengeId },
				update: {
					$inc: { progress: amount },
					$set: { updatedAt: new Date() },
					$setOnInsert: { userId, challengeId, createdAt: new Date() },
				},
				upsert: true,
			},
		})));
	}

	if (processedIds.length > 0) {
		await syncCollection.updateOne(
			{ userId },
			{
				$set: { lastCheckedMatchTime: latestTimestamp, updatedAt: new Date() },
				$push: { seenMatchIds: { $each: processedIds, $slice: -100 } },
				$setOnInsert: { userId, createdAt: new Date() },
			},
			{ upsert: true },
		);
	}

	return { matchesChecked: processedIds.length, progressUpdates: increments.size };
}
