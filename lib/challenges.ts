import type { Db } from "mongodb";

export type ChallengeType = "wins" | "kills" | "matches" | "watchtime" | "community" | "meta";
export type BadgeRarity = "common" | "rare" | "epic";

export type ChallengeBadge = {
	id: string;
	name: string;
	nameEn?: string;
	description: string;
	descriptionEn?: string;
	icon: string;
	rarity: BadgeRarity;
};

export interface ChallengeDef {
	id: string;
	seasonId: string;
	title: string;
	titleEn?: string;
	description: string;
	descriptionEn?: string;
	type: ChallengeType;
	gameMode?: string;
	queueId?: number;
	target: number;
	icon: string;
	winMultiplier?: number;
	reward?: string;
	rewardEn?: string;
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
const PERMANENT_START = new Date("2026-01-01T00:00:00.000Z");
const PERMANENT_END = new Date("2099-12-31T23:59:59.999Z");

function launchChallenge(challenge: Omit<ChallengeDef, "seasonId" | "startsAt" | "endsAt" | "enabled" | "systemVersion">): ChallengeDef {
	return {
		...challenge,
		seasonId: SEASON_ID,
		startsAt: LAUNCH_START,
		endsAt: LAUNCH_END,
		enabled: true,
		systemVersion: 4,
	};
}

// IDs remain stable across balance passes so existing seasonal progress stays attached.
export const DEFAULT_CHALLENGES: ChallengeDef[] = [
	{
		id: "permanent-tournament-application",
		seasonId: "community-permanent",
		title: "Erster Schritt ins Turnier",
		description: "Bewirb dich für ein beliebiges Turnier in Nachtaras Community Garden.",
		type: "meta",
		target: 1,
		icon: "🎟️",
		requirement: "discord",
		sortOrder: 1,
		badge: {
			id: "turnierbluete",
			name: "Turnierblüte",
			description: "Hat sich für mindestens ein Community-Turnier beworben.",
			icon: "🎟️",
			rarity: "common",
		},
		reward: "Permanentes Profil-Badge „Turnierblüte“",
		startsAt: PERMANENT_START,
		endsAt: PERMANENT_END,
		enabled: true,
		systemVersion: 4,
	},
	{
		id: "permanent-tournament-winner",
		seasonId: "community-permanent",
		title: "Die Krone gehört euch",
		description: "Gewinne mit deinem Team ein beliebiges Turnier in Nachtaras Community Garden.",
		type: "meta",
		target: 1,
		icon: "👑",
		requirement: "discord",
		discordRoleId: process.env.DISCORD_TOURNAMENT_WINNER_ROLE_ID?.trim() || "managed:turnierkrone",
		discordRoleName: "Turnierkrone",
		sortOrder: 2,
		badge: {
			id: "siegesbluete",
			name: "Siegesblüte",
			description: "Hat ein Community-Turnier als Teil des Siegerteams gewonnen.",
			icon: "👑",
			rarity: "epic",
		},
		reward: "Episches Profil-Badge „Siegesblüte“ und Discord-Rolle „Turnierkrone“",
		startsAt: PERMANENT_START,
		endsAt: PERMANENT_END,
		enabled: true,
		systemVersion: 4,
	},
	launchChallenge({
		id: "launch-2026-aram-matches-3",
		title: "ARAM-Blütenregen",
		description: "Spiele zehn ARAM-Matches während der Launch-Saison zu Ende.",
		type: "matches",
		gameMode: "ARAM",
		target: 10,
		icon: "🌸",
		requirement: "riot",
		sortOrder: 10,
		badge: { id: "aram-bluetenregen", name: "ARAM-Blütenregen", description: "Zehn ARAM-Runden im Sakura-Garten gespielt.", icon: "🌸", rarity: "common" },
		reward: "Profil-Badge „ARAM-Blütenregen“",
	}),
	launchChallenge({
		id: "launch-2026-aram-wins-3",
		title: "Schneeball mit Krone",
		description: "Gewinne 15 ARAM-Matches während der Launch-Saison.",
		type: "wins",
		gameMode: "ARAM",
		target: 15,
		icon: "👑",
		requirement: "riot",
		sortOrder: 20,
		badge: { id: "schneeball-krone", name: "Schneeball mit Krone", description: "15 Siege im ARAM-Chaos gesammelt.", icon: "👑", rarity: "rare" },
		reward: "Seltenes Profil-Badge „Schneeball mit Krone“",
	}),
	launchChallenge({
		id: "launch-2026-soloq-wins-2",
		title: "Ranked-Rosen",
		description: "Gewinne 25 SoloQ-Spiele während der Launch-Saison.",
		type: "wins",
		queueId: 420,
		target: 25,
		icon: "🌹",
		requirement: "riot",
		sortOrder: 30,
		badge: { id: "ranked-rosen", name: "Ranked-Rosen", description: "25 SoloQ-Siege für den Community-Garten.", icon: "🌹", rarity: "epic" },
		reward: "Episches Profil-Badge „Ranked-Rosen“",
	}),
	launchChallenge({
		id: "launch-2026-kills-100",
		title: "Blütenklinge",
		description: "Sammle in League-Matches während der Saison insgesamt 1.000 Kills.",
		type: "kills",
		target: 1_000,
		icon: "⚔️",
		requirement: "riot",
		sortOrder: 40,
		badge: { id: "blueten-klinge", name: "Blütenklinge", description: "1.000 Kills innerhalb einer Challenge-Saison.", icon: "⚔️", rarity: "epic" },
		reward: "Episches Profil-Badge „Blütenklinge“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-30",
		title: "Erste Teepause",
		description: "Verbringe eine volle Live-Stunde mit Nachtaras Stream.",
		type: "watchtime",
		target: 60,
		icon: "🍵",
		requirement: "twitch",
		sortOrder: 50,
		badge: { id: "erste-teepause", name: "Erste Teepause", description: "Die erste volle Live-Stunde gemeinsam verbracht.", icon: "🍵", rarity: "common" },
		reward: "Profil-Badge „Erste Teepause“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-300",
		title: "Stammplatz im Chat",
		description: "Sammle 25 Stunden Live-Watchtime während der Saison.",
		type: "watchtime",
		target: 1_500,
		icon: "💮",
		requirement: "twitch",
		sortOrder: 60,
		badge: { id: "stammplatz-chat", name: "Stammplatz im Chat", description: "25 Stunden live im Sakura-Garten dabei.", icon: "💮", rarity: "rare" },
		reward: "Seltenes Profil-Badge „Stammplatz im Chat“",
	}),
	launchChallenge({
		id: "launch-2026-watchtime-1200",
		title: "Sakura-Stammgast",
		description: "Sammle 100 Stunden Live-Watchtime während der Launch-Saison.",
		type: "watchtime",
		target: 6_000,
		icon: "🌙",
		requirement: "twitch",
		sortOrder: 70,
		badge: { id: "sakura-stammgast", name: "Sakura-Stammgast", description: "100 Stunden echte Live-Watchtime gesammelt.", icon: "🌙", rarity: "epic" },
		reward: "Episches Profil-Badge „Sakura-Stammgast“",
	}),
	launchChallenge({
		id: "launch-2026-riot-meta-3",
		title: "Saisonblüte",
		description: "Schließe alle vier League-Challenges dieser Saison ab.",
		type: "meta",
		target: 4,
		icon: "🏵️",
		requirement: "discord",
		prerequisiteIds: ["launch-2026-aram-matches-3", "launch-2026-aram-wins-3", "launch-2026-soloq-wins-2", "launch-2026-kills-100"],
		discordRoleId: process.env.DISCORD_CHALLENGE_ROLE_ID?.trim() || undefined,
		discordRoleName: "Saisonblüte 2026",
		sortOrder: 80,
		badge: { id: "saisonbluete-2026", name: "Saisonblüte 2026", description: "Alle League-Ziele der Launch-Saison gemeistert.", icon: "🏵️", rarity: "epic" },
		reward: "Episches Profil-Badge und optionale Discord-Rolle",
	}),
	launchChallenge({
		id: "launch-2026-community-watchtime-100",
		title: "Fünftausend Stunden Hanami",
		description: "Alle verknüpften Community-Mitglieder sammeln gemeinsam 5.000 Stunden Live-Watchtime.",
		type: "community",
		target: 300_000,
		icon: "✨",
		requirement: "community",
		sortOrder: 100,
		reward: "Großes Community-Event und gemeinsame Abstimmung über Nachtaras nächste Stream-Challenge",
	}),
];

const DEFAULT_CHALLENGE_ENGLISH: Record<string, Pick<ChallengeDef, "titleEn" | "descriptionEn" | "rewardEn">> = {
	"permanent-tournament-application": {
		titleEn: "First step into a tournament",
		descriptionEn: "Apply to any tournament in Nachtara's Community Garden.",
		rewardEn: 'Permanent "Tournament Blossom" profile badge',
	},
	"permanent-tournament-winner": {
		titleEn: "The crown is yours",
		descriptionEn: "Win any tournament in Nachtara's Community Garden with your team.",
		rewardEn: 'Epic "Victory Blossom" profile badge and "Tournament Crown" Discord role',
	},
	"launch-2026-aram-matches-3": {
		titleEn: "ARAM Blossom Rain",
		descriptionEn: "Finish ten ARAM matches during the launch season.",
		rewardEn: '"ARAM Blossom Rain" profile badge',
	},
	"launch-2026-aram-wins-3": {
		titleEn: "Snowball with a Crown",
		descriptionEn: "Win 15 ARAM matches during the launch season.",
		rewardEn: 'Rare "Snowball with a Crown" profile badge',
	},
	"launch-2026-soloq-wins-2": {
		titleEn: "Ranked Roses",
		descriptionEn: "Win 25 Solo Queue games during the launch season.",
		rewardEn: 'Epic "Ranked Roses" profile badge',
	},
	"launch-2026-kills-100": {
		titleEn: "Blossom Blade",
		descriptionEn: "Collect a total of 1,000 kills in League matches during the season.",
		rewardEn: 'Epic "Blossom Blade" profile badge',
	},
	"launch-2026-watchtime-30": {
		titleEn: "First Tea Break",
		descriptionEn: "Spend one full live hour with Nachtara's stream.",
		rewardEn: '"First Tea Break" profile badge',
	},
	"launch-2026-watchtime-300": {
		titleEn: "Regular Spot in Chat",
		descriptionEn: "Collect 25 hours of live watch time during the season.",
		rewardEn: 'Rare "Regular Spot in Chat" profile badge',
	},
	"launch-2026-watchtime-1200": {
		titleEn: "Sakura Regular",
		descriptionEn: "Collect 100 hours of live watch time during the launch season.",
		rewardEn: 'Epic "Sakura Regular" profile badge',
	},
	"launch-2026-riot-meta-3": {
		titleEn: "Season Blossom",
		descriptionEn: "Complete all four League challenges this season.",
		rewardEn: "Epic profile badge and optional Discord role",
	},
	"launch-2026-community-watchtime-100": {
		titleEn: "Five Thousand Hours of Hanami",
		descriptionEn: "All connected community members collect 5,000 hours of live watch time together.",
		rewardEn: "A large community event and a shared vote on Nachtara's next stream challenge",
	},
};

const DEFAULT_BADGE_ENGLISH: Record<string, { nameEn: string; descriptionEn: string }> = {
	"permanent-tournament-application": { nameEn: "Tournament Blossom", descriptionEn: "Applied to at least one community tournament." },
	"permanent-tournament-winner": { nameEn: "Victory Blossom", descriptionEn: "Won a community tournament as part of the winning team." },
	"launch-2026-aram-matches-3": { nameEn: "ARAM Blossom Rain", descriptionEn: "Completed ten ARAM matches in the Sakura Garden." },
	"launch-2026-aram-wins-3": { nameEn: "Snowball with a Crown", descriptionEn: "Collected 15 wins in ARAM mayhem." },
	"launch-2026-soloq-wins-2": { nameEn: "Ranked Roses", descriptionEn: "Won 25 Solo Queue games for the Community Garden." },
	"launch-2026-kills-100": { nameEn: "Blossom Blade", descriptionEn: "Collected 1,000 kills during a challenge season." },
	"launch-2026-watchtime-30": { nameEn: "First Tea Break", descriptionEn: "Spent the first full live hour together." },
	"launch-2026-watchtime-300": { nameEn: "Regular Spot in Chat", descriptionEn: "Joined the Sakura Garden live for 25 hours." },
	"launch-2026-watchtime-1200": { nameEn: "Sakura Regular", descriptionEn: "Collected 100 hours of genuine live watch time." },
	"launch-2026-riot-meta-3": { nameEn: "Season Blossom 2026", descriptionEn: "Completed every League goal in the launch season." },
};

for (const challenge of DEFAULT_CHALLENGES) {
	Object.assign(challenge, DEFAULT_CHALLENGE_ENGLISH[challenge.id], { systemVersion: 6 });
	if (challenge.badge) Object.assign(challenge.badge, DEFAULT_BADGE_ENGLISH[challenge.id]);
}

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
				await collection.updateOne({ id: challenge.id, systemVersion: { $ne: 6 } }, { $set: challenge });
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
