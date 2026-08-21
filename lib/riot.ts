import { riotApiFetch } from "@/lib/riot-rate-limit";

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const DATA_DRAGON_VERSION = process.env.RIOT_DDRAGON_VERSION || "14.10.1";

const platforms: Record<string, string> = {
	euw: "euw1",
	eune: "eun1",
	na: "na1",
	tr: "tr1",
	br: "br1",
	lan: "la1",
	las: "la2",
	kr: "kr",
	jp: "jp1",
	oce: "oc1",
};

export const verificationIconIds = [1, 2, 3, 4, 5, 6, 7, 8];

export type RiotIdentity = {
	puuid: string;
	gameName: string;
	tagLine: string;
	platform: string;
};

export type RiotRank = {
	queueType: string;
	tier: string;
	rank: string;
	leaguePoints: number;
	label: string;
};

export function profileIconUrl(iconId: number) {
	return `https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

export async function resolveRiotIdentity(gameName: string, tagLine: string, region = "euw"): Promise<RiotIdentity | null> {
	if (!RIOT_API_KEY) return null;

	const accountResponse = await riotApiFetch(
		`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
		{ headers: { "X-Riot-Token": RIOT_API_KEY } }
	).catch(() => null);

	if (!accountResponse?.ok) return null;
	const account = await accountResponse.json();

	return {
		puuid: account.puuid,
		gameName: account.gameName,
		tagLine: account.tagLine,
		platform: platforms[region.toLowerCase()] || platforms.euw,
	};
}

export async function getRiotIdentityByPuuid(puuid: string, platform = "euw1"): Promise<RiotIdentity | null> {
	if (!RIOT_API_KEY) return null;

	const response = await riotApiFetch(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`, {
		headers: { "X-Riot-Token": RIOT_API_KEY },
	}).catch(() => null);
	if (!response?.ok) return null;
	const account = (await response.json()) as { puuid?: string; gameName?: string; tagLine?: string };
	if (!account.puuid || !account.gameName || !account.tagLine) return null;
	return { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine, platform };
}

export async function getRiotProfileIcon(puuid: string, platform: string): Promise<number | null> {
	if (!RIOT_API_KEY) return null;

	const response = await riotApiFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
		headers: { "X-Riot-Token": RIOT_API_KEY },
	}).catch(() => null);

	if (!response?.ok) return null;
	const summoner = await response.json();
	return typeof summoner.profileIconId === "number" ? summoner.profileIconId : null;
}

export async function getRiotRank(puuid: string, platform: string): Promise<RiotRank | null> {
	if (!RIOT_API_KEY) return null;
	const headers = { "X-Riot-Token": RIOT_API_KEY };
	const entriesResponse = await riotApiFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`, { headers }).catch(() => null);
	if (!entriesResponse?.ok) return null;
	const entries = (await entriesResponse.json()) as Array<{ queueType?: string; tier?: string; rank?: string; leaguePoints?: number }>;
	const entry = entries.find((candidate) => candidate.queueType === "RANKED_SOLO_5x5");
	if (!entry?.tier) return null;
	const tier = entry.tier.toUpperCase();
	const rank = entry.rank || "I";
	const leaguePoints = Math.max(0, Number(entry.leaguePoints || 0));
	const tierLabel = `${tier.charAt(0)}${tier.slice(1).toLowerCase()}`;
	return { queueType: entry.queueType || "", tier, rank, leaguePoints, label: `${tierLabel} ${rank} · ${leaguePoints} LP` };
}
