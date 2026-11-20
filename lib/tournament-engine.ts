import { Db } from "mongodb";

export type TournamentMatch = {
	id: string;
	tournamentId: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	bracket?: "upper" | "lower" | "finals";
	matchType?: "standard" | "grand_final" | "bracket_reset";
	groupId?: string;
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	winnerTeamId: string | null;
	status: "scheduled" | "completed" | "conditional" | "skipped";
	scheduledAt: Date | null;
	completedAt?: Date;
	nextMatchId?: string;
	nextSlot?: "teamAId" | "teamBId";
	loserNextMatchId?: string;
	loserNextSlot?: "teamAId" | "teamBId";
	/** Set when the match was skipped because a slot can never be filled (free win). */
	bye?: boolean;
};

export function createId(prefix: string) {
	return `${prefix}_${crypto.randomUUID()}`;
}

/** Standard bracket seed order, e.g. 8 -> [1, 8, 4, 5, 2, 7, 3, 6], so top seeds meet late and receive byes first. */
export function bracketSeedOrder(size: number): number[] {
	let order = [1];
	while (order.length < size) {
		const next = order.length * 2;
		order = order.flatMap((seed) => [seed, next + 1 - seed]);
	}
	return order;
}

/** Places seeded team IDs into first-round slots; empty entries become byes. */
function seededSlots(teamIds: string[], size: number) {
	return bracketSeedOrder(size).map((seed) => teamIds[seed - 1] || null);
}

/**
 * Resolves byes in place: a scheduled match whose open slot can never be filled
 * (no feeder left that could still deliver a team) is skipped, and its single team
 * advances. Returns the IDs of every match that changed.
 */
export function applyByes(matches: TournamentMatch[]) {
	const byId = new Map(matches.map((match) => [match.id, match]));
	const feeders = new Map<string, TournamentMatch[]>();
	const addFeeder = (targetId: string | undefined, slot: string | undefined, source: TournamentMatch) => {
		if (!targetId || !slot) return;
		const key = `${targetId}:${slot}`;
		feeders.set(key, [...(feeders.get(key) || []), source]);
	};
	for (const match of matches) {
		if (match.matchType !== "grand_final") addFeeder(match.nextMatchId, match.nextSlot, match);
		addFeeder(match.loserNextMatchId, match.loserNextSlot, match);
	}
	const finished = (match: TournamentMatch) => match.status === "completed" || match.status === "skipped";
	const slotIsDead = (match: TournamentMatch, slot: "teamAId" | "teamBId") => !match[slot] && (feeders.get(`${match.id}:${slot}`) || []).every(finished);

	const changed = new Set<string>();
	let progress = true;
	while (progress) {
		progress = false;
		for (const match of matches) {
			if (match.status !== "scheduled" || match.matchType === "bracket_reset") continue;
			const deadA = slotIsDead(match, "teamAId");
			const deadB = slotIsDead(match, "teamBId");
			if (!(deadA || deadB) || (!deadA && !match.teamAId) || (!deadB && !match.teamBId)) continue;
			const winnerTeamId = match.teamAId || match.teamBId || null;
			Object.assign(match, { status: "skipped", bye: true, winnerTeamId, scoreA: 0, scoreB: 0 });
			changed.add(match.id);
			if (winnerTeamId && match.nextMatchId && match.nextSlot && match.matchType !== "grand_final") {
				const next = byId.get(match.nextMatchId);
				if (next) {
					next[match.nextSlot] = winnerTeamId;
					changed.add(next.id);
				}
			}
			progress = true;
		}
	}
	return [...changed];
}

export function createRoundRobinMatches(tournamentId: string, groupId: string, teamIds: string[]) {
	const matches: TournamentMatch[] = [];
	let position = 1;
	for (let first = 0; first < teamIds.length; first += 1) {
		for (let second = first + 1; second < teamIds.length; second += 1) {
			matches.push({
				id: createId("match"),
				tournamentId,
				stage: "group",
				groupId,
				round: 1,
				position: position++,
				teamAId: teamIds[first],
				teamBId: teamIds[second],
				scoreA: 0,
				scoreB: 0,
				winnerTeamId: null,
				status: "scheduled",
				scheduledAt: null,
			});
		}
	}
	return matches;
}

export function createSingleEliminationMatches(tournamentId: string, teamIds: string[]) {
	const size = 2 ** Math.ceil(Math.log2(Math.max(teamIds.length, 2)));
	const rounds = Math.log2(size);
	const slots = seededSlots(teamIds, size);
	const matchesByRound: TournamentMatch[][] = [];

	for (let round = 1; round <= rounds; round += 1) {
		const matchCount = size / 2 ** round;
		matchesByRound.push(
			Array.from({ length: matchCount }, (_, index) => ({
				id: createId("match"),
				tournamentId,
				stage: "playoff",
				round,
				position: index + 1,
				teamAId: round === 1 ? slots[index * 2] : null,
				teamBId: round === 1 ? slots[index * 2 + 1] : null,
				scoreA: 0,
				scoreB: 0,
				winnerTeamId: null,
				status: "scheduled",
				scheduledAt: null,
			}))
		);
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
			id: createId("match"),
			tournamentId,
			stage: "playoff",
			placement: "third_place",
			round: rounds,
			position: 2,
			teamAId: null,
			teamBId: null,
			scoreA: 0,
			scoreB: 0,
			winnerTeamId: null,
			status: "scheduled",
			scheduledAt: null,
		};
		const semifinalMatches = matchesByRound[rounds - 2];
		semifinalMatches.forEach((match, index) => {
			match.loserNextMatchId = thirdPlaceMatch.id;
			match.loserNextSlot = index === 0 ? "teamAId" : "teamBId";
		});
		matchesByRound[rounds - 1].push(thirdPlaceMatch);
	}

	const matches = matchesByRound.flat();
	applyByes(matches);
	return matches;
}

export function createDoubleEliminationMatches(tournamentId: string, teamIds: string[]) {
	if (teamIds.length < 3 || teamIds.length > 32) {
		throw new Error("Double Elimination benötigt 3 bis 32 Teams. Fehlende Plätze bis zur nächsten Zweierpotenz werden zu Freilosen.");
	}
	const size = Math.max(4, 2 ** Math.ceil(Math.log2(teamIds.length)));
	const slots = seededSlots(teamIds, size);

	const upperRoundCount = Math.log2(size);
	const upper: TournamentMatch[][] = [];
	for (let round = 1; round <= upperRoundCount; round += 1) {
		const matchCount = size / 2 ** round;
		upper.push(
			Array.from({ length: matchCount }, (_, index) => ({
				id: createId("match"),
				tournamentId,
				stage: "playoff" as const,
				bracket: "upper" as const,
				matchType: "standard" as const,
				round,
				position: index + 1,
				teamAId: round === 1 ? slots[index * 2] : null,
				teamBId: round === 1 ? slots[index * 2 + 1] : null,
				scoreA: 0,
				scoreB: 0,
				winnerTeamId: null,
				status: "scheduled" as const,
				scheduledAt: null,
			}))
		);
	}

	for (let roundIndex = 0; roundIndex < upper.length - 1; roundIndex += 1) {
		upper[roundIndex].forEach((match, index) => {
			const next = upper[roundIndex + 1][Math.floor(index / 2)];
			match.nextMatchId = next.id;
			match.nextSlot = index % 2 === 0 ? "teamAId" : "teamBId";
		});
	}

	const lowerRoundCount = 2 * (upperRoundCount - 1);
	const lower: TournamentMatch[][] = [];
	for (let round = 1; round <= lowerRoundCount; round += 1) {
		const matchCount = size / 2 ** (Math.floor((round + 1) / 2) + 1);
		lower.push(
			Array.from({ length: matchCount }, (_, index) => ({
				id: createId("match"),
				tournamentId,
				stage: "playoff" as const,
				bracket: "lower" as const,
				matchType: "standard" as const,
				round,
				position: index + 1,
				teamAId: null,
				teamBId: null,
				scoreA: 0,
				scoreB: 0,
				winnerTeamId: null,
				status: "scheduled" as const,
				scheduledAt: null,
			}))
		);
	}

	upper[0].forEach((match, index) => {
		const target = lower[0][Math.floor(index / 2)];
		match.loserNextMatchId = target.id;
		match.loserNextSlot = index % 2 === 0 ? "teamAId" : "teamBId";
	});

	for (let upperRound = 2; upperRound <= upperRoundCount; upperRound += 1) {
		const lowerRound = 2 * (upperRound - 1);
		upper[upperRound - 1].forEach((match, index) => {
			const target = lower[lowerRound - 1][index];
			match.loserNextMatchId = target.id;
			match.loserNextSlot = "teamBId";
		});
	}

	for (let roundIndex = 0; roundIndex < lower.length - 1; roundIndex += 1) {
		lower[roundIndex].forEach((match, index) => {
			const nextRound = lower[roundIndex + 1];
			if ((roundIndex + 1) % 2 === 1) {
				match.nextMatchId = nextRound[index].id;
				match.nextSlot = "teamAId";
			} else {
				match.nextMatchId = nextRound[Math.floor(index / 2)].id;
				match.nextSlot = index % 2 === 0 ? "teamAId" : "teamBId";
			}
		});
	}

	const grandFinal: TournamentMatch = {
		id: createId("match"),
		tournamentId,
		stage: "playoff",
		bracket: "finals",
		matchType: "grand_final",
		round: 1,
		position: 1,
		teamAId: null,
		teamBId: null,
		scoreA: 0,
		scoreB: 0,
		winnerTeamId: null,
		status: "scheduled",
		scheduledAt: null,
	};
	const bracketReset: TournamentMatch = {
		id: createId("match"),
		tournamentId,
		stage: "playoff",
		bracket: "finals",
		matchType: "bracket_reset",
		round: 2,
		position: 1,
		teamAId: null,
		teamBId: null,
		scoreA: 0,
		scoreB: 0,
		winnerTeamId: null,
		status: "conditional",
		scheduledAt: null,
	};
	upper.at(-1)![0].nextMatchId = grandFinal.id;
	upper.at(-1)![0].nextSlot = "teamAId";
	lower.at(-1)![0].nextMatchId = grandFinal.id;
	lower.at(-1)![0].nextSlot = "teamBId";
	grandFinal.nextMatchId = bracketReset.id;

	const matches = [...upper.flat(), ...lower.flat(), grandFinal, bracketReset];
	applyByes(matches);
	return matches;
}

/** Loads the playoff matches, resolves any byes that became decidable, and saves the changed matches. */
export async function resolveByesInDb(db: Db, tournamentId: string) {
	const collection = db.collection<TournamentMatch>("tournament_matches");
	const matches = (await collection.find({ tournamentId, stage: "playoff" }).project<TournamentMatch>({ _id: 0 }).toArray()) as TournamentMatch[];
	const changedIds = applyByes(matches);
	if (!changedIds.length) return 0;
	const byId = new Map(matches.map((match) => [match.id, match]));
	await collection.bulkWrite(
		changedIds.map((matchId) => {
			const match = byId.get(matchId)!;
			return {
				updateOne: {
					filter: { id: matchId, tournamentId },
					update: {
						$set: {
							teamAId: match.teamAId,
							teamBId: match.teamBId,
							status: match.status,
							winnerTeamId: match.winnerTeamId,
							scoreA: match.scoreA,
							scoreB: match.scoreB,
							...(match.bye ? { bye: true } : {}),
						},
					},
				},
			};
		})
	);
	return changedIds.length;
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
	const teams = teamIds.length
		? await db
				.collection("tournament_teams")
				.find({ id: { $in: teamIds } })
				.toArray()
		: [];
	const names = new Map(teams.map((team) => [team.id as string, team.name as string]));
	const standings = [...totals.entries()].map(([teamId, total]) => ({ tournamentId, groupId, teamId, teamName: names.get(teamId) || "Unbekanntes Team", ...total }));
	standings.sort((left, right) => right.points - left.points || right.wins - left.wins || left.losses - right.losses || left.teamName.localeCompare(right.teamName));

	await db.collection("tournament_standings").deleteMany({ tournamentId, groupId });
	if (standings.length) await db.collection("tournament_standings").insertMany(standings.map((standing, index) => ({ ...standing, rank: index + 1 })));
	return standings;
}
