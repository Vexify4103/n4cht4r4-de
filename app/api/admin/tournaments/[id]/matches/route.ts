import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { rebuildGroupStandings, TournamentMatch } from "@/lib/tournament-engine";
import { resolveTournament } from "@/lib/tournament-slugs";
import { grantTournamentWinnerRewards, resolveTournamentChampionTeamId } from "@/lib/tournament-rewards";
import type { Db } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function loserOf(match: TournamentMatch) {
	if (!match.winnerTeamId || !match.teamAId || !match.teamBId) return null;
	return match.winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
}

async function resetDownstreamMatches(db: Db, tournamentId: string, sourceIds: string[]) {
	const matches = await db.collection<TournamentMatch>("tournament_matches").find({ tournamentId, stage: "playoff" }).toArray();
	const byId = new Map(matches.map((match) => [match.id, match]));
	const downstream = new Set<string>();
	const queue = [...sourceIds];
	while (queue.length) {
		const source = byId.get(queue.shift()!);
		if (!source) continue;
		for (const targetId of [source.nextMatchId, source.loserNextMatchId]) {
			if (targetId && !downstream.has(targetId)) {
				downstream.add(targetId);
				queue.push(targetId);
			}
		}
	}

	if (downstream.size) {
		for (const matchId of downstream) {
			const match = byId.get(matchId);
			await db.collection<TournamentMatch>("tournament_matches").updateOne(
				{ id: matchId, tournamentId },
				{
					$set: {
						teamAId: null,
						teamBId: null,
						scoreA: 0,
						scoreB: 0,
						winnerTeamId: null,
						status: match?.matchType === "bracket_reset" ? "conditional" : "scheduled",
					},
					$unset: { completedAt: "" },
				}
			);
		}
	}

	const completedMatches = await db
		.collection<TournamentMatch>("tournament_matches")
		.find({ tournamentId, stage: "playoff", status: "completed", id: { $nin: [...downstream] } })
		.toArray();
	for (const completed of completedMatches) {
		if (completed.matchType !== "grand_final" && completed.nextMatchId && completed.nextSlot && completed.winnerTeamId) {
			await db
				.collection<TournamentMatch>("tournament_matches")
				.updateOne({ id: completed.nextMatchId, tournamentId }, { $set: { [completed.nextSlot]: completed.winnerTeamId } });
		}
		const loserTeamId = loserOf(completed);
		if (completed.loserNextMatchId && completed.loserNextSlot && loserTeamId) {
			await db
				.collection<TournamentMatch>("tournament_matches")
				.updateOne({ id: completed.loserNextMatchId, tournamentId }, { $set: { [completed.loserNextSlot]: loserTeamId } });
		}
	}
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const matches = await db
		.collection<TournamentMatch>("tournament_matches")
		.find({ tournamentId: id })
		.project({ _id: 0 })
		.sort({ stage: 1, groupId: 1, round: 1, position: 1 })
		.toArray();
	return NextResponse.json({ matches });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Entscheiden von Matches." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (body?.action === "pairings") {
		const pairings = Array.isArray(body.pairings) ? body.pairings : [];
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		id = String(tournament.id);
		const firstRoundMatches = await db
			.collection<TournamentMatch>("tournament_matches")
			.find({ tournamentId: id, stage: "playoff", round: 1, placement: { $ne: "third_place" }, bracket: { $nin: ["lower", "finals"] } })
			.sort({ position: 1 })
			.toArray();
		if (!firstRoundMatches.length || pairings.length !== firstRoundMatches.length) {
			return NextResponse.json({ error: "Bitte besetze alle Paarungen der ersten Playoff-Runde." }, { status: 400 });
		}
		const matchIds = new Set(firstRoundMatches.map((match) => match.id));
		const normalized = pairings.map((pairing: Record<string, unknown>) => ({
			matchId: typeof pairing?.matchId === "string" ? pairing.matchId : "",
			teamAId: typeof pairing?.teamAId === "string" ? pairing.teamAId : "",
			teamBId: typeof pairing?.teamBId === "string" ? pairing.teamBId : "",
		}));
		const selectedTeamIds = normalized.flatMap((pairing: { teamAId: string; teamBId: string }) => [pairing.teamAId, pairing.teamBId]);
		if (
			normalized.some(
				(pairing: { matchId: string; teamAId: string; teamBId: string }) =>
					!matchIds.has(pairing.matchId) || !pairing.teamAId || !pairing.teamBId || pairing.teamAId === pairing.teamBId
			) ||
			new Set(normalized.map((pairing: { matchId: string }) => pairing.matchId)).size !== firstRoundMatches.length ||
			new Set(selectedTeamIds).size !== selectedTeamIds.length
		) {
			return NextResponse.json({ error: "Jedes Team darf in der ersten Runde genau einmal vorkommen." }, { status: 400 });
		}
		const teamCount = await db.collection("tournament_teams").countDocuments({ tournamentId: id, id: { $in: selectedTeamIds } });
		if (teamCount !== selectedTeamIds.length) return NextResponse.json({ error: "Mindestens ein ausgewähltes Team gehört nicht zu diesem Turnier." }, { status: 400 });
		await db.collection<TournamentMatch>("tournament_matches").bulkWrite(
			normalized.map((pairing: { matchId: string; teamAId: string; teamBId: string }) => ({
				updateOne: {
					filter: { id: pairing.matchId, tournamentId: id },
					update: {
						$set: { teamAId: pairing.teamAId, teamBId: pairing.teamBId, scoreA: 0, scoreB: 0, winnerTeamId: null, status: "scheduled" },
						$unset: { completedAt: "" },
					},
				},
			}))
		);
		await resetDownstreamMatches(
			db,
			id,
			firstRoundMatches.map((match) => match.id)
		);
		await db.collection("tournaments").updateOne({ id }, { $set: { status: "live", updatedAt: new Date() } });
		await recordTournamentAudit(db, staff, id, "match.pairings_updated", { pairings: normalized });
		return NextResponse.json({ updated: true });
	}
	if (body?.action === "schedule") {
		if (typeof body.matchId !== "string" || typeof body.scheduledAt !== "string" || Number.isNaN(Date.parse(body.scheduledAt)))
			return NextResponse.json({ error: "Bitte wähle einen gültigen Termin." }, { status: 400 });
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		id = String(tournament.id);
		const result = await db
			.collection<TournamentMatch>("tournament_matches")
			.findOneAndUpdate({ id: body.matchId, tournamentId: id }, { $set: { scheduledAt: new Date(body.scheduledAt) } }, { returnDocument: "after", projection: { _id: 0 } });
		if (!result) return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 });
		await recordTournamentAudit(db, staff, id, "match.scheduled", { matchId: body.matchId, scheduledAt: body.scheduledAt });
		return NextResponse.json({ match: result });
	}
	if (typeof body?.matchId !== "string" || !Number.isInteger(body.scoreA) || !Number.isInteger(body.scoreB) || body.scoreA === body.scoreB || body.scoreA < 0 || body.scoreB < 0)
		return NextResponse.json({ error: "Bitte gib ein gültiges Ergebnis ohne Unentschieden an." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const resolvedTournament = await resolveTournament(db, id);
	if (!resolvedTournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(resolvedTournament.id);
	const match = await db.collection<TournamentMatch>("tournament_matches").findOne({ id: body.matchId, tournamentId: id });
	const seriesBestOf = [1, 3, 5].includes(Number(resolvedTournament.seriesBestOf)) ? Number(resolvedTournament.seriesBestOf) : 1;
	const winsNeeded = Math.ceil(seriesBestOf / 2);
	if (Math.max(body.scoreA, body.scoreB) !== winsNeeded || Math.min(body.scoreA, body.scoreB) >= winsNeeded)
		return NextResponse.json({ error: `Dieses Match ist Best of ${seriesBestOf}. Das Siegerteam braucht genau ${winsNeeded} Maps.` }, { status: 400 });
	if (!match?.teamAId || !match.teamBId) return NextResponse.json({ error: "Dieses Match ist noch nicht vollständig besetzt." }, { status: 400 });
	const winnerTeamId = body.scoreA > body.scoreB ? match.teamAId : match.teamBId;
	const update = { scoreA: body.scoreA, scoreB: body.scoreB, winnerTeamId, status: "completed" as const, completedAt: new Date() };
	await db.collection<TournamentMatch>("tournament_matches").updateOne({ id: match.id }, { $set: update });
	if (match.winnerTeamId && match.winnerTeamId !== winnerTeamId) await resetDownstreamMatches(db, id, [match.id]);
	if (match.matchType !== "grand_final" && match.nextMatchId && match.nextSlot)
		await db.collection<TournamentMatch>("tournament_matches").updateOne({ id: match.nextMatchId }, { $set: { [match.nextSlot]: winnerTeamId } });
	const loserTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
	if (match.loserNextMatchId && match.loserNextSlot)
		await db.collection<TournamentMatch>("tournament_matches").updateOne({ id: match.loserNextMatchId }, { $set: { [match.loserNextSlot]: loserTeamId } });
	if (match.matchType === "grand_final" && match.nextMatchId) {
		await db.collection<TournamentMatch>("tournament_matches").updateOne(
			{ id: match.nextMatchId, tournamentId: id },
			{
				$set: {
					teamAId: match.teamAId,
					teamBId: match.teamBId,
					scoreA: 0,
					scoreB: 0,
					winnerTeamId: null,
					status: winnerTeamId === match.teamAId ? "skipped" : "scheduled",
				},
				$unset: { completedAt: "" },
			}
		);
	}
	if (match.stage === "group" && match.groupId) await rebuildGroupStandings(db, id, match.groupId);
	if (match.stage === "playoff") {
		const openPlayoffMatches = await db
			.collection<TournamentMatch>("tournament_matches")
			.countDocuments({ tournamentId: id, stage: "playoff", status: { $nin: ["completed", "skipped", "conditional"] } });
		if (openPlayoffMatches === 0) {
			await db.collection("tournaments").updateOne({ id }, { $set: { status: "completed", registrationOpen: false, updatedAt: new Date() } });
			const championTeamId = await resolveTournamentChampionTeamId(db, id);
			if (championTeamId) await grantTournamentWinnerRewards(db, id, championTeamId);
		}
	}
	await recordTournamentAudit(db, staff, id, "match.completed", { matchId: match.id, scoreA: body.scoreA, scoreB: body.scoreB, winnerTeamId });
	return NextResponse.json({ match: { ...match, ...update } });
}
