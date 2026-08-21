import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import { ensureTournamentCommunityIndexes, TournamentWishGroup } from "@/lib/tournament-community";
import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { Db, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ApplicationDocument = {
	id: string;
	tournamentId: string;
	userId: string;
	discordId?: string | null;
	riotPuuid?: string | null;
	riotPlatform?: string | null;
	riotId?: string;
	currentRank?: string | null;
	teamId?: string | null;
	status?: string;
	[key: string]: unknown;
};

type TeamDocument = {
	id: string;
	members?: Array<{ applicationId?: string; [key: string]: unknown }>;
};

async function detachApplication(db: Db, tournamentId: string, application: ApplicationDocument) {
	const [teams, wishGroup] = await Promise.all([
		db.collection<TeamDocument>("tournament_teams").find({ tournamentId, "members.applicationId": application.id }).toArray(),
		db.collection<TournamentWishGroup>("tournament_wish_groups").findOne({ tournamentId, memberUserIds: application.userId }),
	]);

	const operations: Promise<unknown>[] = teams.map((team) =>
		db
			.collection<TeamDocument>("tournament_teams")
			.updateOne(
				{ id: team.id, tournamentId },
				{ $set: { members: (team.members || []).filter((member) => member.applicationId !== application.id), updatedAt: new Date() } }
			)
	);
	if (wishGroup) {
		const remaining = wishGroup.memberUserIds.filter((userId) => userId !== application.userId);
		if (!remaining.length) operations.push(db.collection<TournamentWishGroup>("tournament_wish_groups").deleteOne({ id: wishGroup.id }));
		else
			operations.push(
				db.collection<TournamentWishGroup>("tournament_wish_groups").updateOne(
					{ id: wishGroup.id },
					{
						$set: {
							memberUserIds: remaining,
							ownerUserId: wishGroup.ownerUserId === application.userId ? remaining[0] : wishGroup.ownerUserId,
							updatedAt: new Date(),
						},
					}
				)
			);
	}
	if (teams.length) operations.push(db.collection("tournaments").updateOne({ id: tournamentId }, { $set: { rosterDirty: true } }));
	await Promise.all(operations);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const [applications, wishGroups] = await Promise.all([
		db.collection<ApplicationDocument>("tournament_applications").find({ tournamentId: id }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray(),
		db.collection<TournamentWishGroup>("tournament_wish_groups").find({ tournamentId: id }).project({ _id: 0 }).sort({ createdAt: 1 }).toArray(),
	]);

	const objectIds = applications
		.map((application) => application.userId)
		.filter(ObjectId.isValid)
		.map((userId) => new ObjectId(userId));
	const users = objectIds.length
		? await db
				.collection("users")
				.find({ _id: { $in: objectIds } })
				.toArray()
		: [];
	const usersById = new Map(users.map((user) => [user._id.toString(), user]));

	await Promise.all(
		applications.map(async (application) => {
			const user = usersById.get(application.userId);
			const riotPuuid = String(application.riotPuuid || user?.riotPuuid || "");
			const riotPlatform = String(application.riotPlatform || user?.riotPlatform || "euw1");
			if (!riotPuuid) return;
			const currentRank = String(user?.riotRank || application.currentRank || "Unranked");
			const riotId = user?.riotSummonerName && user?.riotTagLine ? `${user.riotSummonerName}#${user.riotTagLine}` : String(application.riotId || "");
			const changed =
				application.riotPuuid !== riotPuuid || application.riotPlatform !== riotPlatform || application.currentRank !== currentRank || application.riotId !== riotId;
			application.riotPuuid = riotPuuid;
			application.riotPlatform = riotPlatform;
			application.currentRank = currentRank;
			if (riotId) application.riotId = riotId;

			if (changed)
				await db
					.collection("tournament_applications")
					.updateOne({ id: application.id, tournamentId: id }, { $set: { riotPuuid, riotPlatform, currentRank, ...(riotId ? { riotId } : {}) } });
		})
	);

	return NextResponse.json({ applications, wishGroups });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Prüfen von Bewerbungen." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (typeof body?.applicationId !== "string" || !["ban", "unban"].includes(body.action)) return NextResponse.json({ error: "Ungültige Bewerbungsänderung." }, { status: 400 });
	await client.connect();
	const db = client.db();
	await ensureTournamentCommunityIndexes(db);
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const application = await db.collection<ApplicationDocument>("tournament_applications").findOne({ id: body.applicationId, tournamentId: id });
	if (!application) return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });

	if (body.action === "ban") {
		await detachApplication(db, id, application);
		const now = new Date();
		await Promise.all([
			db.collection("tournament_bans").updateOne(
				{ userId: application.userId },
				{
					$set: {
						active: true,
						discordId: application.discordId || null,
						riotPuuid: application.riotPuuid || null,
						bannedBy: staff.userId,
						bannedAt: now,
						updatedAt: now,
					},
					$setOnInsert: { id: `tournament_ban_${crypto.randomUUID()}`, userId: application.userId, createdAt: now },
				},
				{ upsert: true }
			),
			db
				.collection("tournament_applications")
				.updateOne({ id: application.id, tournamentId: id }, { $set: { status: "banned", teamId: null, reviewedBy: staff.userId, reviewedAt: now, updatedAt: now } }),
		]);
		await recordTournamentAudit(db, staff, id, "application.banned", { applicationId: application.id, userId: application.userId });
		return NextResponse.json({ banned: true });
	}

	await Promise.all([
		db
			.collection("tournament_bans")
			.updateMany(
				{ $or: [{ userId: application.userId }, { discordId: application.discordId || "__none__" }, { riotPuuid: application.riotPuuid || "__none__" }] },
				{ $set: { active: false, unbannedBy: staff.userId, unbannedAt: new Date(), updatedAt: new Date() } }
			),
		db
			.collection("tournament_applications")
			.updateOne({ id: application.id, tournamentId: id }, { $set: { status: "pending", reviewedBy: staff.userId, reviewedAt: new Date(), updatedAt: new Date() } }),
	]);
	await recordTournamentAudit(db, staff, id, "application.unbanned", { applicationId: application.id, userId: application.userId });
	return NextResponse.json({ unbanned: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Entfernen von Bewerbungen." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (typeof body?.applicationId !== "string") return NextResponse.json({ error: "Anmeldung fehlt." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const application = await db.collection<ApplicationDocument>("tournament_applications").findOne({ id: body.applicationId, tournamentId: id });
	if (!application) return NextResponse.json({ error: "Anmeldung nicht gefunden." }, { status: 404 });
	await detachApplication(db, id, application);
	await db.collection("tournament_applications").deleteOne({ id: application.id, tournamentId: id });
	await recordTournamentAudit(db, staff, id, "application.removed", { applicationId: application.id, userId: application.userId });
	return NextResponse.json({ removed: true });
}
