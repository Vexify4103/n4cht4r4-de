import type { Db } from "mongodb";

export type ChallengeType = "wins" | "kills" | "matches" | "watchtime" | "community" | "meta";
export type BadgeRarity = "common" | "rare" | "epic";

export type ChallengeBadge = {
	id: string;
	name: string;
	description: string;
	icon: string;
	rarity: BadgeRarity;
};

export interface ChallengeDef {
	id: string;
	seasonId: string;
	title: string;
	description: string;
	type: ChallengeType;
	gameMode?: string;
	queueId?: number;
	target: number;
	icon: string;
	winMultiplier?: number;
	reward?: string;
	badge?: ChallengeBadge;
	discordRoleId?: string;
	discordRoleName?: string;
	prerequisiteIds?: string[];
	requirement?: "discord" | "twitch" | "riot" | "community";
	startsAt: Date;
	endsAt: Date;
	enabled?: boolean;
	sortOrder?: number;
	systemVersion?: number;
}

const LAUNCH_START = new Date("2026-08-08T00:00:00.000Z");
const LAUNCH_END = new Date("2026-12-31T22:59:59.999Z");
const SEASON_ID = "sakura-launch-2026";

function launchChallenge(challenge: Omit<ChallengeDef, "seasonId" | "startsAt" | "endsAt" | "enabled" | "systemVersion">): ChallengeDef {
	return {
		...challenge,
		seasonId: SEASON_ID,
		startsAt: LAUNCH_START,
		endsAt: LAUNCH_END,
		enabled: true,
		systemVersion: 2,
	};
}

export const DEFAULT_CHALLENGES: ChallengeDef[] = [
	launchChallenge({
		id: "launch-2026-aram-matches-3",
		title: "ARAM-Blütenregen",
		description: "Spiele drei ARAM-Matches nach dem Start dieser Saison zu Ende.",
		type: "matches",
		gameMode: "ARAM",
		target: 3,
		icon: "🌸",
		requirement: "riot",
		sortOrder: 10,
		badge: { id: "aram-bluetenregen", name: "ARAM-Blütenregen", description: "Drei ARAM-Runden im Sakura-Garten gespielt.", icon: "🌸", rarity: "common" },
		reward: "Profil-Badge „ARAM-Blütenregen“",
	}),
	launchChallenge({
		id: "launch-2026-aram-wins-3",
		title: "Schneeball mit Krone",
		description: "Gewinne drei ARAM-Matches während der Launch-Saison.",
		type: "wins",
		gameMode: "ARAM",
		target: 3,
		icon: "👑",
		requirement: "riot",
		sortOrder: 20,
		badge: { id: "schneeball-krone", name: "Schneeball mit Krone", description: "Drei Siege im ARAM-Chaos gesammelt.", icon: "👑", rarity: "rare" },
		reward: "Profil-Badge „Schneeball mit Krone“",
	}),
	launchChallenge({
		id: "launch-2026-soloq-wins-2",
		title: "Ranked-Rosen",
		description: "Gewinne zwei SoloQ-Spiele nach dem Start dieser Saison.",
		type: "wins",
		queueId: 420,
		target: 2,
		icon: "🌹",
		requirement: "riot",
		sortOrder: 30,
		badge: { id: "ranked-rosen", name: "Ranked-Rosen", description: "Zwei SoloQ-Siege für den Community-Garten.", icon: "🌹", rarity: "rare" },
		reward: "Profil-Badge „Ranked-Rosen“",
	}),
	launchChallenge({
		id: "launch-2026-kills-100",
		title: "Blütenklinge",
		description: "Sammle in League-Matches nach Saisonstart insgesamt 100 Kills.",
		type: "kills",
		target: 100,
		icon: "⚔️",
		requirement: "riot",
		sortOrder: 40,
		badge: { id: "blueten-klinge", name: "Blütenklinge", description: "100 Kills innerhalb einer Challenge-Saison.", icon: "⚔️", rarity: "rare" },
		reward: "Profil-Badge „Blütenklinge“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-30",
		title: "Erste Teepause",
		description: "Verbringe 30 Live-Minuten mit Nachtaras Stream.",
		type: "watchtime",
		target: 30,
		icon: "🍵",
		requirement: "twitch",
		sortOrder: 50,
		badge: { id: "erste-teepause", name: "Erste Teepause", description: "Die ersten 30 Live-Minuten gemeinsam verbracht.", icon: "🍵", rarity: "common" },
		reward: "Profil-Badge „Erste Teepause“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-300",
		title: "Stammplatz im Chat",
		description: "Sammle fünf Stunden Live-Watchtime während der Saison.",
		type: "watchtime",
		target: 300,
		icon: "💮",
		requirement: "twitch",
		sortOrder: 60,
		badge: { id: "stammplatz-chat", name: "Stammplatz im Chat", description: "Fünf Stunden live im Sakura-Garten dabei.", icon: "💮", rarity: "rare" },
		reward: "Profil-Badge „Stammplatz im Chat“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-1200",
		title: "Sakura-Stammgast",
		description: "Sammle 20 Stunden Live-Watchtime während der Launch-Saison.",
		type: "watchtime",
		target: 1_200,
		icon: "🌙",
		requirement: "twitch",
		sortOrder: 70,
		badge: { id: "sakura-stammgast", name: "Sakura-Stammgast", description: "20 Stunden echte Live-Watchtime gesammelt.", icon: "🌙", rarity: "epic" },
		reward: "Episches Profil-Badge „Sakura-Stammgast“",
	}),
	launchChallenge({
		id: "launch-2026-riot-meta-3",
		title: "Saisonblüte",
		description: "Schließe drei der vier League-Challenges dieser Saison ab.",
		type: "meta",
		target: 3,
		icon: "🏵️",
		requirement: "discord",
		prerequisiteIds: ["launch-2026-aram-matches-3", "launch-2026-aram-wins-3", "launch-2026-soloq-wins-2", "launch-2026-kills-100"],
		discordRoleId: process.env.DISCORD_CHALLENGE_ROLE_ID?.trim() || undefined,
		discordRoleName: "Saisonblüte 2026",
		sortOrder: 80,
		badge: { id: "saisonbluete-2026", name: "Saisonblüte 2026", description: "Drei League-Ziele der Launch-Saison gemeistert.", icon: "🏵️", rarity: "epic" },
		reward: "Episches Profil-Badge und optionale Discord-Rolle",
	}),
	launchChallenge({
		id: "launch-2026-community-watchtime-100",
		title: "Hundert Stunden Hanami",
		description: "Alle verknüpften Community-Mitglieder sammeln gemeinsam 100 Stunden Live-Watchtime.",
		type: "community",
		target: 6_000,
		icon: "✨",
		requirement: "community",
		sortOrder: 100,
		reward: "Die Community entscheidet über Nachtaras nächste Stream-Challenge",
	}),
];

const LEGACY_IDS = ["aram-matches-10", "aram-wins-5", "soloq-wins-5", "flexq-wins-5", "kills-300", "watchtime-30", "watchtime-300", "community-watchtime-1000"];
let migrationPromise: Promise<void> | null = null;

export function isChallengeActive(challenge: Pick<ChallengeDef, "enabled" | "startsAt" | "endsAt">, now = new Date()) {
	return challenge.enabled !== false && new Date(challenge.startsAt).getTime() <= now.getTime() && new Date(challenge.endsAt).getTime() >= now.getTime();
}

export async function ensureChallengeDefinitions(db: Db) {
	if (!migrationPromise) {
		migrationPromise = (async () => {
			const collection = db.collection<ChallengeDef>("challenge_definitions");
			await collection.createIndex({ id: 1 }, { unique: true });
			for (const challenge of DEFAULT_CHALLENGES) {
				await collection.updateOne({ id: challenge.id }, { $setOnInsert: challenge }, { upsert: true });
				if (challenge.discordRoleId) {
					await collection.updateOne(
						{ id: challenge.id, $or: [{ discordRoleId: { $exists: false } }, { discordRoleId: null as unknown as string }, { discordRoleId: "" }] },
						{ $set: { discordRoleId: challenge.discordRoleId, discordRoleName: challenge.discordRoleName } }
					);
				}
			}
			await collection.updateMany({ id: { $in: LEGACY_IDS }, systemVersion: { $ne: 2 } }, { $set: { enabled: false, archivedAt: new Date(), systemVersion: 2 } });
		})().catch((error) => {
			migrationPromise = null;
			throw error;
		});
	}
	await migrationPromise;
}

export async function getChallengeDefinitions(db: Db, options: { activeOnly?: boolean } = { activeOnly: true }): Promise<ChallengeDef[]> {
	await ensureChallengeDefinitions(db);
	const definitions = await db
		.collection<ChallengeDef>("challenge_definitions")
		.find(options.activeOnly === false ? {} : { enabled: { $ne: false } })
		.sort({ sortOrder: 1, title: 1 })
		.toArray();
	return options.activeOnly === false ? definitions : definitions.filter((challenge) => isChallengeActive(challenge));
}

export function matchMatchesChallenge(challenge: ChallengeDef, match: { gameMode: string; queueId: number; gameStartTimestamp?: number }): boolean {
	if (match.gameStartTimestamp && match.gameStartTimestamp < new Date(challenge.startsAt).getTime()) return false;
	if (match.gameStartTimestamp && match.gameStartTimestamp > new Date(challenge.endsAt).getTime()) return false;
	if (challenge.gameMode) return match.gameMode === challenge.gameMode;
	if (challenge.queueId) return match.queueId === challenge.queueId;
	return true;
}
