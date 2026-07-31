import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import { createId } from "@/lib/tournament-engine";
import client from "@/lib/db";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const staff = await hasTournamentPermission();
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	await client.connect();
	const db = client.db();
	const records = await db.collection("tournaments").find({}).project({ _id: 0 }).sort({ createdAt: -1 }).toArray();
	const tournaments = await Promise.all(records.map(async (record) => {
		const resolved = await resolveTournament(db, String(record.id)) || record;
		return { ...resolved, id: publicTournamentId(resolved) };
	}));
	return NextResponse.json({ tournaments, role: staff.role });
}

export async function POST(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Erstellen von Turnieren." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : "";
	const format = typeof body?.format === "string" ? body.format.trim().slice(0, 80) : "";
	const maxTeams = Number(body?.maxTeams);
	if (!title || !format || !Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 128) return NextResponse.json({ error: "Titel, Format und Teamanzahl sind erforderlich." }, { status: 400 });

	const tournament = {
		id: createId("tournament"), title, game: "League of Legends", format, maxTeams, currentTeams: 0,
		status: "announcement", date: null, rules: [], bracketType: "single_elimination", seriesBestOf: 1, championRule: "none", published: false, registrationOpen: false, createdAt: new Date(), updatedAt: new Date(),
	};
	await client.connect();
	const db = client.db();
	await db.collection("tournaments").insertOne(tournament);
	await recordTournamentAudit(db, staff, tournament.id, "tournament.created", { title, format, maxTeams });
	return NextResponse.json({ tournament }, { status: 201 });
}
