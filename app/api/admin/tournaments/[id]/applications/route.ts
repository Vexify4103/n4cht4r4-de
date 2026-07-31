import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { NextResponse } from "next/server";
import { resolveTournament } from "@/lib/tournament-slugs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const applications = await db.collection("tournament_applications").find({ tournamentId: id }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray();
	return NextResponse.json({ applications });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Prüfen von Bewerbungen." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (typeof body?.applicationId !== "string" || !["pending", "accepted", "waitlisted", "rejected"].includes(body.status)) return NextResponse.json({ error: "Ungültige Bewerbungsänderung." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const result = await db.collection("tournament_applications").findOneAndUpdate({ id: body.applicationId, tournamentId: id }, { $set: { status: body.status, reviewedBy: staff.userId, reviewedAt: new Date(), reviewerNote: typeof body.note === "string" ? body.note.slice(0, 1000) : "" } }, { returnDocument: "after", projection: { _id: 0 } });
	if (!result) return NextResponse.json({ error: "Bewerbung nicht gefunden." }, { status: 404 });
	await recordTournamentAudit(db, staff, id, "application.reviewed", { applicationId: body.applicationId, status: body.status });
	return NextResponse.json({ application: result });
}
