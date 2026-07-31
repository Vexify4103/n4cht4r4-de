import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission();
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	const { id } = await params;
	await client.connect();
	const tournament = await resolveTournament(client.db(), id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	return NextResponse.json({ tournament: { ...tournament, id: tournament.slug || tournament.id } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	const allowed = ["title", "format", "status", "date", "rules", "published", "registrationOpen", "maxTeams", "bracketType", "seriesBestOf", "championRule"];
	const update: Record<string, unknown> = {};
	for (const key of allowed) if (body && key in body) update[key] = body[key];
	if (Array.isArray(update.rules)) update.rules = update.rules.filter((rule) => typeof rule === "string").map((rule) => rule.trim()).filter(Boolean).slice(0, 50);
	if (update.seriesBestOf !== undefined && ![1, 3, 5].includes(Number(update.seriesBestOf))) return NextResponse.json({ error: "Fuer eine Serie sind nur Best of 1, 3 oder 5 erlaubt." }, { status: 400 });
	if (update.championRule !== undefined && !["none", "light_fearless"].includes(String(update.championRule))) return NextResponse.json({ error: "Ungueltige Champion-Regel." }, { status: 400 });
	if (!Object.keys(update).length) return NextResponse.json({ error: "Keine Änderungen übergeben." }, { status: 400 });
	update.updatedAt = new Date();
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const result = await db.collection("tournaments").findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after", projection: { _id: 0 } });
	if (!result) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	await recordTournamentAudit(db, staff, id, "tournament.updated", { fields: Object.keys(update) });
	return NextResponse.json({ tournament: result });
}
