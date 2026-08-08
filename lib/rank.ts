const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"] as const;
const DIVISIONS = ["IV", "III", "II", "I"] as const;

export function leagueRankScore(rank: string) {
	const normalized = rank.trim().toUpperCase();
	const tierIndex = TIERS.findIndex((tier) => normalized.startsWith(tier));
	if (tierIndex < 0) return null;
	const division = DIVISIONS.findIndex((entry) => new RegExp(`\\b${entry}\\b`).test(normalized));
	const lp = Math.min(99, Math.max(0, Number(normalized.match(/(\d+)\s*LP/)?.[1] || 0)));
	return tierIndex * 400 + Math.max(0, division) * 100 + lp;
}

export function averageLeagueRank(ranks: string[]) {
	const scores = ranks.map(leagueRankScore).filter((score): score is number => score !== null);
	if (!scores.length) return { label: "Unranked", rankedPlayers: 0, score: null };
	const score = scores.reduce((sum, entry) => sum + entry, 0) / scores.length;
	const tierIndex = Math.min(TIERS.length - 1, Math.floor(score / 400));
	const tier = TIERS[tierIndex];
	const divisionIndex = Math.min(3, Math.max(0, Math.round((score - tierIndex * 400) / 100)));
	const tierLabel = `${tier.charAt(0)}${tier.slice(1).toLowerCase()}`;
	const label = tierIndex >= 7 ? tierLabel : `${tierLabel} ${DIVISIONS[divisionIndex]}`;
	return { label, rankedPlayers: scores.length, score };
}
