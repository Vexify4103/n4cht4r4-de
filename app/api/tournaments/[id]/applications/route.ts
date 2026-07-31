import { auth } from "@/auth";
import client from "@/lib/db";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { resolveTournament } from "@/lib/tournament-slugs";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user?.id || !ObjectId.isValid(session.user.id)) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	const riotId = typeof body?.riotId === "string" ? body.riotId.trim().slice(0, 64) : "";
	const role = typeof body?.role === "string" ? body.role.trim().slice(0, 24) : "";
	const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1_500) : "";
	if (!riotId || !role || note.length < 20 || body?.accepted !== true) return NextResponse.json({ error: "Bitte fülle alle Pflichtfelder aus und akzeptiere die Bedingungen." }, { status: 400 });

	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if (!tournament?.registrationOpen) return NextResponse.json({ error: "Die Anmeldung für dieses Turnier ist nicht geöffnet." }, { status: 403 });
	const userId = new ObjectId(session.user.id);
	const user = await db.collection("users").findOne({ _id: userId });
	const discord = await db.collection("accounts").findOne({ userId, provider: "discord" });
	if (!user?.riotVerified || !discord) return NextResponse.json({ error: "Für die Anmeldung brauchst du Discord und eine Riot-Verifizierung." }, { status: 403 });
	const existing = await db.collection("tournament_applications").findOne({ tournamentId: id, userId: session.user.id, status: { $in: ["pending", "accepted", "waitlisted"] } });
	if (existing) return NextResponse.json({ error: "Du hast bereits eine aktive Bewerbung für dieses Turnier." }, { status: 409 });

	const application = { id: crypto.randomUUID(), tournamentId: id, userId: session.user.id, discordId: discord.providerAccountId, riotId, role, note, status: "pending", consent: { version: "2026-06", acceptedAt: new Date() }, createdAt: new Date() };
	await db.collection("tournament_applications").insertOne(application);
	return NextResponse.json({ application }, { status: 201 });
}
