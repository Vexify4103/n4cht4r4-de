import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { parseRegistrationWindow, registrationWindowState } from "@/lib/tournament-registration";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten." }, { status: 403 });

	const { id: requestedId } = await params;
	const body = await request.json().catch(() => null);
	if (!body) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, requestedId);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });

	const parsed = parseRegistrationWindow(body.registrationOpensAt, body.registrationClosesAt, tournament.startsAt);
	if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

	const registrationNote = typeof body.registrationNote === "string" ? body.registrationNote.trim().slice(0, 800) : "";
	const update = {
		registrationOpensAt: parsed.opensAt,
		registrationClosesAt: parsed.closesAt,
		registrationOpen: parsed.opensAt
			? registrationWindowState({ ...tournament, registrationOpensAt: parsed.opensAt, registrationClosesAt: parsed.closesAt }) === "open"
			: body.manualOpen === true,
		registrationNote,
		updatedAt: new Date(),
	};
	const id = String(tournament.id);
	const result = await db.collection("tournaments").findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after", projection: { _id: 0 } });
	if (!result) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });

	await recordTournamentAudit(db, staff, id, "tournament.registration-window.updated", {
		registrationOpensAt: parsed.opensAt,
		registrationClosesAt: parsed.closesAt,
		manualOpen: parsed.opensAt ? false : body.manualOpen === true,
	});
	return NextResponse.json({ tournament: result, registrationState: registrationWindowState(result) });
}
