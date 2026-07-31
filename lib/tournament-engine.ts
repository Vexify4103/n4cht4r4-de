import { Db } from "mongodb";

export type TournamentMatch = {
	id: string;
	tournamentId: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	groupId?: string;
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	winnerTeamId: string | null;
	status: "scheduled" | "completed";
	scheduledAt: Date | null;
	completedAt?: Date;
	nextMatchId?: string;
	nextSlot?: "teamAId" | "teamBId";
	loserNextMatchId?: string;
	loserNextSlot?: "teamAId" | "teamBId";
};

export function createId(prefix: string) {
	return `${prefix}_${crypto.randomUUID()}`;
}

export function createRoundRobinMatches(tournamentId: string, groupId: string, teamIds: string[]) {
	const matches: TournamentMatch[] = [];
	let position = 1;
	for (let first = 0; first < teamIds.length; first += 1) {
		for (let second = first + 1; second < teamIds.length; second += 1) {
			matches.push({
				id: createId("match"), tournamentId, stage: "group", groupId, round: 1, position: position++,
				teamAId: teamIds[first], teamBId: teamIds[second], scoreA: 0, scoreB: 0,
				winnerTeamId: null, status: "scheduled", scheduledAt: null,
			});
		}
	}
	return matches;
}

export function createSingleEliminationMatches(tournamentId: string, teamIds: string[]) {
	const size = 2 ** Math.ceil(Math.log2(Math.max(teamIds.length, 2)));
	const rounds = Math.log2(size);
	const matchesByRound: TournamentMatch[][] = [];

	for (let round = 1; round <= rounds; round += 1) {
		const matchCount = size / 2 ** round;
		matchesByRound.push(Array.from({ length: matchCount }, (_, index) => ({
			id: createId("match"), tournamentId, stage: "playoff", round, position: index + 1,
			teamAId: round === 1 ? teamIds[index * 2] || null : null,
			teamBId: round === 1 ? teamIds[index * 2 + 1] || null : null,
			scoreA: 0, scoreB: 0, winnerTeamId: null, status: "scheduled", scheduledAt: null,
		})));
	}

	for (let round = 0; round < matchesByRound.length - 1; round += 1) {
		for (let index = 0; index < matchesByRound[round].length; index += 1) {
			const next = matchesByRound[round + 1][Math.floor(index / 2)];
			matchesByRound[round][index].nextMatchId = next.id;
			matchesByRound[round][index].nextSlot = index % 2 === 0 ? "teamAId" : "teamBId";
		}
	}

	if (size >= 4) {
		const thirdPlaceMatch: TournamentMatch = {
			id: createId("match"), tournamentId, stage: "playoff", placement: "third_place",
			round: rounds, position: 2, teamAId: null, teamBId: null,
			scoreA: 0, scoreB: 0, winnerTeamId: null, status: "scheduled", scheduledAt: null,
		};
		const semifinalMatches = matchesByRound[rounds - 2];
		semifinalMatches.forEach((match, index) => {
			match.loserNextMatchId = thirdPlaceMatch.id;
			match.loserNextSlot = index === 0 ? "teamAId" : "teamBId";
		});
		matchesByRound[rounds - 1].push(thirdPlaceMatch);
	}

	return matchesByRound.flat();
}

export async function rebuildGroupStandings(db: Db, tournamentId: string, groupId: string) {
	const matches = await db.collection<TournamentMatch>("tournament_matches").find({ tournamentId, groupId, status: "completed" }).toArray();
	const totals = new Map<string, { wins: number; losses: number; points: number }>();

	for (const match of matches) {
		if (!match.teamAId || !match.teamBId || !match.winnerTeamId) continue;
		for (const teamId of [match.teamAId, match.teamBId]) if (!totals.has(teamId)) totals.set(teamId, { wins: 0, losses: 0, points: 0 });
		const winner = totals.get(match.winnerTeamId)!;
		winner.wins += 1;
		winner.points += 3;
		const loserId = match.winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
		totals.get(loserId)!.losses += 1;
	}

	const teamIds = [...totals.keys()];
	const teams = teamIds.length ? await db.collection("tournament_teams").find({ id: { $in: teamIds } }).toArray() : [];
	const names = new Map(teams.map((team) => [team.id as string, team.name as string]));
	const standings = [...totals.entries()].map(([teamId, total]) => ({ tournamentId, groupId, teamId, teamName: names.get(teamId) || "Unbekanntes Team", ...total }));
	standings.sort((left, right) => right.points - left.points || right.wins - left.wins || left.losses - right.losses || left.teamName.localeCompare(right.teamName));

	await db.collection("tournament_standings").deleteMany({ tournamentId, groupId });
	if (standings.length) await db.collection("tournament_standings").insertMany(standings.map((standing, index) => ({ ...standing, rank: index + 1 })));
	return standings;
}
