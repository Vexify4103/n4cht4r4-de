import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { createDoubleEliminationMatches, createId, createRoundRobinMatches, createSingleEliminationMatches } from "@/lib/tournament-engine";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Generieren von Spielplänen." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (!body || !["groups", "playoffs"].includes(body.stage)) return NextResponse.json({ error: "Ungültiger Spielplan-Typ." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if ((tournament.bracketType === "single_elimination" || tournament.bracketType === "double_elimination") && body.stage !== "playoffs")
		return NextResponse.json({ error: "Dieses Turnier hat keine Gruppenphase. Bitte erstelle den Playoff-Baum." }, { status: 400 });
	const teams = await db.collection("tournament_teams").find({ tournamentId: id }).project({ _id: 0, id: 1, seed: 1 }).sort({ seed: 1, name: 1 }).toArray();
	if (tournament.maxTeams === 4 && teams.length !== 4)
		return NextResponse.json({ error: "Fuer dieses Turnier werden genau vier Teams fuer die Halbfinals benoetigt." }, { status: 400 });
	if (teams.length < 2) return NextResponse.json({ error: "Für einen Spielplan werden mindestens zwei Teams benötigt." }, { status: 400 });
	const existingMatches = await db.collection("tournament_matches").countDocuments({ tournamentId: id });
	if (existingMatches > 0) return NextResponse.json({ error: "Es existieren bereits Matches. Lösche oder archiviere sie zuerst, bevor du neu generierst." }, { status: 409 });

	if (body.stage === "playoffs") {
		let matches;
		try {
			matches =
				tournament.bracketType === "double_elimination"
					? createDoubleEliminationMatches(
							id,
							teams.map((team) => team.id)
						)
					: createSingleEliminationMatches(
							id,
							teams.map((team) => team.id)
						);
		} catch (error) {
			return NextResponse.json({ error: error instanceof Error ? error.message : "Der Turnierbaum konnte nicht erstellt werden." }, { status: 400 });
		}
		await db.collection("tournament_matches").insertMany(matches);
		await recordTournamentAudit(db, staff, id, "bracket.playoffs_generated", { teamCount: teams.length, matchCount: matches.length });
		return NextResponse.json({ matches });
	}

	const groupCount = Math.min(Math.max(Number(body.groupCount) || 2, 2), teams.length);
	const groups = Array.from({ length: groupCount }, (_, index) => ({
		id: createId("group"),
		tournamentId: id,
		name: `Gruppe ${String.fromCharCode(65 + index)}`,
		teamIds: [] as string[],
		createdAt: new Date(),
	}));
	teams.forEach((team, index) => groups[index % groups.length].teamIds.push(team.id));
	const matches = groups.flatMap((group) => createRoundRobinMatches(id, group.id, group.teamIds));
	await db.collection("tournament_groups").insertMany(groups);
	if (matches.length) await db.collection("tournament_matches").insertMany(matches);
	await recordTournamentAudit(db, staff, id, "bracket.groups_generated", { groupCount, matchCount: matches.length });
	return NextResponse.json({ groups, matches });
}
