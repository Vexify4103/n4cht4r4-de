import { auth } from "@/auth";
import client from "@/lib/db";
import { ACTIVE_APPLICATION_STATUSES, createWishGroupCode, ensureTournamentCommunityIndexes, TournamentWishGroup, wishGroupLimit } from "@/lib/tournament-community";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const body = await request.json().catch(() => null);
	const tournamentId = typeof body?.tournamentId === "string" ? body.tournamentId : "";
	const name = typeof body?.name === "string" ? body.name.trim().slice(0, 64) : "";
	if (!tournamentId || !name) return NextResponse.json({ error: "Turnier und Gruppenname sind erforderlich." }, { status: 400 });
	await client.connect();
	const db = client.db();
	await ensureTournamentCommunityIndexes(db);
	const [tournament, application, existing] = await Promise.all([
		db.collection("tournaments").findOne({ id: tournamentId }),
		db.collection("tournament_applications").findOne({ tournamentId, userId: session.user.id, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } }),
		db.collection<TournamentWishGroup>("tournament_wish_groups").findOne({ tournamentId, memberUserIds: session.user.id }),
	]);
	if (!tournament || !application) return NextResponse.json({ error: "Bewirb dich zuerst einzeln für dieses Turnier." }, { status: 409 });
	if (!tournament.registrationOpen) return NextResponse.json({ error: "Wunschgruppen können nur während der Anmeldung geändert werden." }, { status: 409 });
	if (!wishGroupLimit(tournament)) return NextResponse.json({ error: "Für dieses Turnier sind Wunschgruppen deaktiviert." }, { status: 409 });
	if (existing) return NextResponse.json({ error: "Du bist für dieses Turnier bereits in einer Wunschgruppe." }, { status: 409 });
	const now = new Date();
	const group: TournamentWishGroup = {
		id: `wish_${crypto.randomUUID()}`,
		tournamentId,
		name,
		inviteCode: createWishGroupCode(),
		ownerUserId: session.user.id,
		memberUserIds: [session.user.id],
		createdAt: now,
		updatedAt: now,
	};
	try {
		await db.collection<TournamentWishGroup>("tournament_wish_groups").insertOne(group);
		return NextResponse.json({ group }, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error && error.message.includes("duplicate key") ? "Du bist bereits in einer Wunschgruppe." : "Die Wunschgruppe konnte nicht erstellt werden.",
			},
			{ status: 409 }
		);
	}
}
