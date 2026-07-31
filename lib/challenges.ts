import type { Db } from "mongodb";

export interface ChallengeDef {
	id: string;
	title: string;
	description: string;
	type: "wins" | "kills" | "matches" | "watchtime" | "community";
	gameMode?: string;
	queueId?: number;
	target: number;
	icon: string;
	winMultiplier?: number;
	reward?: string;
	requirement?: "discord" | "twitch" | "riot";
	enabled?: boolean;
	sortOrder?: number;
}

export const DEFAULT_CHALLENGES: ChallengeDef[] = [
	{
		id: "aram-matches-10",
		title: "ARAM-Blütenregen",
		description: "Spiele zehn ARAM-Matches zu Ende.",
		type: "matches",
		gameMode: "ARAM",
		target: 10,
		icon: "🌸",
		requirement: "riot",
		sortOrder: 10,
	},
	{
		id: "aram-wins-5",
		title: "Schneeball mit Krone",
		description: "Sammle fünf ARAM-Siege. Jeder Sieg zählt doppelt.",
		type: "wins",
		gameMode: "ARAM",
		target: 10,
		icon: "👑",
		winMultiplier: 2,
		requirement: "riot",
		sortOrder: 20,
	},
	{
		id: "soloq-wins-5",
		title: "Ranked-Rosen",
		description: "Gewinne fünf SoloQ-Spiele.",
		type: "wins",
		queueId: 420,
		target: 5,
		icon: "🌹",
		requirement: "riot",
		sortOrder: 30,
	},
	{
		id: "flexq-wins-5",
		title: "Gemeinsam stärker",
		description: "Gewinne fünf FlexQ-Spiele mit deinem Team.",
		type: "wins",
		queueId: 440,
		target: 5,
		icon: "🤝",
		requirement: "riot",
		sortOrder: 40,
	},
	{
		id: "kills-300",
		title: "Blütenklinge",
		description: "Erreiche in League-Matches insgesamt 300 Kills.",
		type: "kills",
		target: 300,
		icon: "⚔️",
		requirement: "riot",
		sortOrder: 50,
	},
	{
		id: "watchtime-30",
		title: "Erste Teepause",
		description: "Verbringe 30 Live-Minuten mit Nachtaras Stream.",
		type: "watchtime",
		target: 30,
		icon: "🍵",
		requirement: "twitch",
		sortOrder: 60,
	},
	{
		id: "watchtime-300",
		title: "Stammplatz im Chat",
		description: "Sammle fünf Stunden Live-Watchtime.",
		type: "watchtime",
		target: 300,
		icon: "💮",
		requirement: "twitch",
		sortOrder: 70,
	},
	{
		id: "community-watchtime-1000",
		title: "Tausend Stunden Hanami",
		description: "Die Community sammelt zusammen 1.000 Stunden Live-Watchtime.",
		type: "community",
		target: 60_000,
		icon: "🌙",
		reward: "Eine Überraschung für die gesamte Community",
		requirement: "twitch",
		sortOrder: 100,
	},
];

export const CHALLENGES = DEFAULT_CHALLENGES;

export async function getChallengeDefinitions(db: Db): Promise<ChallengeDef[]> {
	const collection = db.collection<ChallengeDef>("challenge_definitions");
	const configured = await collection.find({ enabled: { $ne: false } }).sort({ sortOrder: 1, title: 1 }).toArray();
	if (configured.length > 0) return configured;

	await collection.insertMany(DEFAULT_CHALLENGES.map((challenge) => ({ ...challenge, enabled: true })));
	return DEFAULT_CHALLENGES;
}

export function matchMatchesChallenge(
	challenge: ChallengeDef,
	match: { gameMode: string; queueId: number },
): boolean {
	if (challenge.gameMode) return match.gameMode === challenge.gameMode;
	if (challenge.queueId) return match.queueId === challenge.queueId;
	return true;
}
