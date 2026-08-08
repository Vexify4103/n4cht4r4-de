import { auth } from "@/auth";
import client from "@/lib/db";
import { TournamentWishGroup } from "@/lib/tournament-community";
import { NextResponse } from "next/server";
import { registrationIsOpen } from "@/lib/tournament-registration";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const userId = session.user.id;
	const { id } = await params;
	await client.connect();
	const db = client.db();
	const group = await db.collection<TournamentWishGroup>("tournament_wish_groups").findOne({ id, memberUserIds: userId });
	if (!group) return NextResponse.json({ error: "Wunschgruppe nicht gefunden." }, { status: 404 });
	const tournament = await db.collection("tournaments").findOne({ id: group.tournamentId });
	if (!tournament || !registrationIsOpen(tournament)) return NextResponse.json({ error: "Wunschgruppen sind nach Anmeldeschluss gesperrt." }, { status: 409 });
	const remaining = group.memberUserIds.filter((memberUserId) => memberUserId !== userId);
	if (!remaining.length) await db.collection<TournamentWishGroup>("tournament_wish_groups").deleteOne({ id: group.id });
	else
		await db
			.collection<TournamentWishGroup>("tournament_wish_groups")
			.updateOne(
				{ id: group.id },
				{ $set: { memberUserIds: remaining, ownerUserId: group.ownerUserId === userId ? remaining[0] : group.ownerUserId, updatedAt: new Date() } }
			);
	return NextResponse.json({ left: true });
}
