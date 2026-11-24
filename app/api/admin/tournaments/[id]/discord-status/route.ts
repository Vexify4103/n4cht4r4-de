import { hasTournamentPermission } from "@/lib/tournament-admin";
import client from "@/lib/db";
import { isMembershipCheckConfigured, refreshGuildMembership, tournamentDeliveryStatus } from "@/lib/discord-membership";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function load(id: string) {
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	return tournament ? { db, tournamentId: String(tournament.id) } : null;
}

/** Cached Discord membership plus last DM / role result per active applicant. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	const found = await load((await params).id);
	if (!found) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	return NextResponse.json({ configured: isMembershipCheckConfigured(), players: await tournamentDeliveryStatus(found.db, found.tournamentId) });
}

/** Re-checks every active applicant against the Discord server, then returns the fresh status. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	const found = await load((await params).id);
	if (!found) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	const before = await tournamentDeliveryStatus(found.db, found.tournamentId);
	await refreshGuildMembership(
		found.db,
		before.map((player) => player.discordId || "").filter(Boolean)
	);
	return NextResponse.json({ configured: isMembershipCheckConfigured(), players: await tournamentDeliveryStatus(found.db, found.tournamentId) });
}
