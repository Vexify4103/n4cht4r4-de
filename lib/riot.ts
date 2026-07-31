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

export function profileIconUrl(iconId: number) {
	return `https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

export async function resolveRiotIdentity(gameName: string, tagLine: string, region = "euw"): Promise<RiotIdentity | null> {
	if (!RIOT_API_KEY) return null;

	const accountResponse = await fetch(
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

export async function getRiotProfileIcon(puuid: string, platform: string): Promise<number | null> {
	if (!RIOT_API_KEY) return null;

	const response = await fetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
		headers: { "X-Riot-Token": RIOT_API_KEY },
	}).catch(() => null);

	if (!response?.ok) return null;
	const summoner = await response.json();
	return typeof summoner.profileIconId === "number" ? summoner.profileIconId : null;
}
