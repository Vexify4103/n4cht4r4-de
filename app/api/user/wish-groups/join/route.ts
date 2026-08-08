import { auth } from "@/auth";
import client from "@/lib/db";
import { ACTIVE_APPLICATION_STATUSES, ensureTournamentCommunityIndexes, TournamentWishGroup, wishGroupLimit } from "@/lib/tournament-community";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const body = await request.json().catch(() => null);
	const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
	if (!inviteCode) return NextResponse.json({ error: "Bitte gib einen Wunschgruppen-Code ein." }, { status: 400 });
	await client.connect();
	const db = client.db();
	await ensureTournamentCommunityIndexes(db);
	const group = await db.collection<TournamentWishGroup>("tournament_wish_groups").findOne({ inviteCode });
	if (!group) return NextResponse.json({ error: "Dieser Wunschgruppen-Code wurde nicht gefunden." }, { status: 404 });
	const [tournament, application, existing] = await Promise.all([
		db.collection("tournaments").findOne({ id: group.tournamentId }),
		db.collection("tournament_applications").findOne({ tournamentId: group.tournamentId, userId: session.user.id, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } }),
		db.collection<TournamentWishGroup>("tournament_wish_groups").findOne({ tournamentId: group.tournamentId, memberUserIds: session.user.id }),
	]);
	if (!tournament || !application) return NextResponse.json({ error: "Bewirb dich zuerst einzeln für dieses Turnier." }, { status: 409 });
	if (!tournament.registrationOpen) return NextResponse.json({ error: "Wunschgruppen sind nach Anmeldeschluss gesperrt." }, { status: 409 });
	if (existing)
		return NextResponse.json(
			{ error: existing.id === group.id ? "Du bist bereits in dieser Wunschgruppe." : "Du bist bereits in einer anderen Wunschgruppe dieses Turniers." },
			{ status: 409 }
		);
	const limit = wishGroupLimit(tournament);
	if (!limit || group.memberUserIds.length >= limit) return NextResponse.json({ error: "Diese Wunschgruppe ist bereits voll." }, { status: 409 });
	try {
		const result = await db
			.collection<TournamentWishGroup>("tournament_wish_groups")
			.updateOne(
				{ id: group.id, memberUserIds: { $ne: session.user.id }, $expr: { $lt: [{ $size: "$memberUserIds" }, limit] } },
				{ $addToSet: { memberUserIds: session.user.id }, $set: { updatedAt: new Date() } }
			);
		if (!result.modifiedCount) return NextResponse.json({ error: "Die Wunschgruppe ist inzwischen voll." }, { status: 409 });
		return NextResponse.json({ joined: true, groupId: group.id });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error && error.message.includes("duplicate key")
						? "Du bist bereits in einer Wunschgruppe dieses Turniers."
						: "Der Beitritt ist fehlgeschlagen.",
			},
			{ status: 409 }
		);
	}
}
