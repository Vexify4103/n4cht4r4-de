import { auth } from "@/auth";
import client from "@/lib/db";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { resolveTournament } from "@/lib/tournament-slugs";
import { getRiotRank } from "@/lib/riot";
import { registrationIsOpen } from "@/lib/tournament-registration";
import { grantTournamentApplicationReward } from "@/lib/tournament-rewards";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();
	if (!session?.user?.id || !ObjectId.isValid(session.user.id)) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	const role = typeof body?.role === "string" ? body.role.trim().slice(0, 24) : "";
	const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1_500) : "";
	if (body?.accepted !== true) return NextResponse.json({ error: "Bitte akzeptiere die Teilnahmebedingungen und Datenschutzhinweise." }, { status: 400 });

	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if (!registrationIsOpen(tournament)) return NextResponse.json({ error: "Die Anmeldung für dieses Turnier ist derzeit nicht geöffnet." }, { status: 403 });
	const userId = new ObjectId(session.user.id);
	const user = await db.collection("users").findOne({ _id: userId });
	const accountUserIds: unknown[] = [userId, session.user.id];
	const accounts = await db
		.collection("accounts")
		.find({ userId: { $in: accountUserIds } })
		.toArray();
	const discord = accounts.find((account) => account.provider === "discord");
	if (!discord) return NextResponse.json({ error: "Für die Anmeldung musst du Discord verbinden." }, { status: 403 });
	if (!user?.riotVerified || !user.riotPuuid || !user.riotSummonerName || !user.riotTagLine)
		return NextResponse.json({ error: "Für die Anmeldung musst du deine Riot-ID verifizieren." }, { status: 403 });
	if (tournament.collectRoles !== false && !role) return NextResponse.json({ error: "Bitte wähle deine bevorzugte Rolle." }, { status: 400 });
	const existing = await db.collection("tournament_applications").findOne({ tournamentId: id, userId: session.user.id, status: { $in: ["pending", "accepted", "waitlisted"] } });
	if (existing) return NextResponse.json({ error: "Du hast bereits eine aktive Bewerbung für dieses Turnier." }, { status: 409 });

	const riotId = user?.riotSummonerName && user?.riotTagLine ? `${user.riotSummonerName}#${user.riotTagLine}` : "";
	const rank = await getRiotRank(String(user.riotPuuid), String(user.riotPlatform || "euw1"));
	const currentRank = rank?.label || String(user.riotRank || "Unranked");
	if (rank) {
		await db.collection("users").updateOne({ _id: userId }, { $set: { riotRank: rank.label, riotRankUpdatedAt: new Date() } });
	}
	const application = {
		id: crypto.randomUUID(),
		tournamentId: id,
		userId: session.user.id,
		discordId: discord?.providerAccountId || null,
		riotId,
		currentRank,
		role,
		participationMode: "solo",
		discordDmOptIn: body?.discordDmOptIn === true,
		teamId: null,
		note,
		status: "pending",
		consent: { version: "2026-08", acceptedAt: new Date() },
		createdAt: new Date(),
	};
	await db.collection("tournament_applications").insertOne(application);
	await grantTournamentApplicationReward(db, session.user.id).catch((error) => {
		console.error("Tournament application badge could not be granted:", error);
	});
	return NextResponse.json({ application }, { status: 201 });
}
