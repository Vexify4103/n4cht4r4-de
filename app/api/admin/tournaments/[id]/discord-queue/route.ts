import { hasTournamentPermission } from "@/lib/tournament-admin";
import client from "@/lib/db";
import { NextResponse } from "next/server";
import { resolveTournament } from "@/lib/tournament-slugs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const jobs = await db.collection("discord_queue").find({ tournamentId: id, status: { $in: ["queued", "processing", "failed"] } }).project({ _id: 0 }).sort({ runAfter: 1, createdAt: 1 }).toArray();
	return NextResponse.json({ jobs });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Aendern der Discord-Queue." }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (body?.action !== "cancel") return NextResponse.json({ error: "Ungueltige Queue-Aktion." }, { status: 400 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const result = await db.collection("discord_queue").updateMany(
		{ tournamentId: id, status: { $in: ["queued", "failed"] } },
		{ $set: { status: "cancelled", cancelledAt: new Date(), lastError: "Von der Turnierleitung gestoppt." } },
	);
	return NextResponse.json({ cancelled: result.modifiedCount });
}
