import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { createId } from "@/lib/tournament-engine";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TeamMemberDocument = {
	applicationId: string;
	userId: string;
	name: string;
	role?: string;
	discordId: string;
	opgg?: string;
	champs?: string[];
};

type TeamDocument = {
	id: string;
	tournamentId: string;
	name: string;
	members: TeamMemberDocument[];
	seed: number | null;
	published?: boolean;
	discordManaged?: boolean;
	discord?: Record<string, unknown>;
	createdAt?: Date;
	updatedAt?: Date;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission();
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const teams = await db.collection("tournament_teams").find({ tournamentId: id }).project({ _id: 0 }).sort({ seed: 1, name: 1 }).toArray();
	return NextResponse.json({ teams });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Verwalten von Teams." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	const name = typeof body?.name === "string" ? body.name.trim().slice(0, 64) : "";
	if (!name) return NextResponse.json({ error: "Teamname ist erforderlich." }, { status: 400 });
	if (body && typeof body === "object" && "members" in body) {
		return NextResponse.json({ error: "Spieler werden ausschließlich aus Turnieranmeldungen zugewiesen." }, { status: 400 });
	}
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if (typeof tournament.maxTeams === "number" && Number(tournament.currentTeams || 0) >= tournament.maxTeams)
		return NextResponse.json({ error: `Dieses Turnier ist mit ${tournament.maxTeams} Teams bereits voll.` }, { status: 409 });
	const team = {
		id: createId("team"),
		tournamentId: id,
		name,
		members: [],
		seed: null,
		published: false,
		discordManaged: false,
		createdAt: new Date(),
	};
	await db.collection("tournament_teams").insertOne(team);
	await db.collection("tournaments").updateOne({ id }, { $inc: { currentTeams: 1 }, $set: { rosterDirty: true } });
	await recordTournamentAudit(db, staff, id, "team.created", { teamId: team.id, name, draft: true });
	return NextResponse.json({ team }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten von Teams." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (!body?.teamId && body?.action !== "reorder") return NextResponse.json({ error: "Team fehlt." }, { status: 400 });
	if (body.action === "reorder") {
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		id = String(tournament.id);
		const orderedTeamIds: string[] = Array.isArray(body.orderedTeamIds) ? body.orderedTeamIds.filter((teamId: unknown): teamId is string => typeof teamId === "string") : [];
		const teams = await db.collection<TeamDocument>("tournament_teams").find({ tournamentId: id }).project({ id: 1 }).toArray();
		if (orderedTeamIds.length !== teams.length || new Set(orderedTeamIds).size !== teams.length || teams.some((team) => !orderedTeamIds.includes(team.id))) {
			return NextResponse.json({ error: "Die Setzliste muss jedes Team genau einmal enthalten." }, { status: 400 });
		}
		if (orderedTeamIds.length) {
			await db.collection<TeamDocument>("tournament_teams").bulkWrite(
				orderedTeamIds.map((teamId, index) => ({
					updateOne: { filter: { id: teamId, tournamentId: id }, update: { $set: { seed: index + 1, updatedAt: new Date() } } },
				}))
			);
		}
		await db.collection("tournaments").updateOne({ id }, { $set: { rosterDirty: true } });
		await recordTournamentAudit(db, staff, id, "team.seeding_updated", { orderedTeamIds });
		return NextResponse.json({ orderedTeamIds });
	}
	if (body.action === "assign-application" || body.action === "remove-application") {
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		id = String(tournament.id);
		const teamsCollection = db.collection<TeamDocument>("tournament_teams");
		const team = await teamsCollection.findOne({ id: body.teamId, tournamentId: id });
		const application = typeof body.applicationId === "string" ? await db.collection("tournament_applications").findOne({ id: body.applicationId, tournamentId: id }) : null;
		if (!team || !application) return NextResponse.json({ error: "Team oder Anmeldung wurde nicht gefunden." }, { status: 404 });
		if (body.action === "remove-application") {
			await Promise.all([
				teamsCollection.updateOne({ id: team.id }, { $set: { members: team.members.filter((member) => member.applicationId !== application.id), updatedAt: new Date() } }),
				db.collection("tournament_applications").updateOne({ id: application.id }, { $set: { teamId: null, status: "pending", updatedAt: new Date() } }),
				db.collection("tournaments").updateOne({ id }, { $set: { rosterDirty: true } }),
			]);
			return NextResponse.json({ removed: true });
		}
		const activeBan = await db.collection("tournament_bans").findOne({
			active: true,
			$or: [{ userId: application.userId }, { discordId: application.discordId || "__none__" }, { riotPuuid: application.riotPuuid || "__none__" }],
		});
		if (application.status === "banned" || activeBan) return NextResponse.json({ error: "Diese Person ist für Turniere gesperrt." }, { status: 409 });
		if (application.status === "rejected") return NextResponse.json({ error: "Diese Anmeldung ist nicht für die Teamzuweisung freigegeben." }, { status: 409 });
		const slot = typeof body.slot === "string" ? body.slot.trim().slice(0, 24) : "Spieler";
		if (
			typeof application.id !== "string" ||
			typeof application.userId !== "string" ||
			!application.userId.trim() ||
			typeof application.riotId !== "string" ||
			!application.riotId.trim() ||
			typeof application.discordId !== "string" ||
			!application.discordId.trim()
		) {
			return NextResponse.json({ error: "Diese Anmeldung hat keine vollständige Discord- und Riot-Verknüpfung und kann nicht zugewiesen werden." }, { status: 409 });
		}
		const teamSize = typeof tournament.teamSize === "number" ? tournament.teamSize : 5;
		const currentMembers = team.members;
		if (currentMembers.length >= teamSize && !currentMembers.some((member) => member.applicationId === application.id))
			return NextResponse.json({ error: "Dieses Team ist bereits voll." }, { status: 409 });
		const assignedTeams = await teamsCollection.find({ tournamentId: id, "members.applicationId": application.id }).toArray();
		await Promise.all(
			assignedTeams.map((assignedTeam) =>
				teamsCollection.updateOne(
					{ id: assignedTeam.id, tournamentId: id },
					{ $set: { members: assignedTeam.members.filter((entry) => entry.applicationId !== application.id), updatedAt: new Date() } }
				)
			)
		);
		const member = {
			applicationId: application.id,
			userId: application.userId,
			name: application.riotId,
			role: slot,
			discordId: application.discordId || "",
			opgg: "",
			champs: [],
		};
		await Promise.all([
			teamsCollection.updateOne(
				{ id: team.id, tournamentId: id },
				{ $set: { members: [...team.members.filter((entry) => entry.applicationId !== application.id), member], updatedAt: new Date() } }
			),
			db.collection("tournament_applications").updateOne({ id: application.id }, { $set: { teamId: team.id, status: "accepted", updatedAt: new Date() } }),
			db.collection("tournaments").updateOne({ id }, { $set: { rosterDirty: true } }),
		]);
		await recordTournamentAudit(db, staff, id, "team.application_assigned", { teamId: team.id, applicationId: application.id, slot });
		return NextResponse.json({ member });
	}
	const update: Record<string, unknown> = {};
	if ("name" in body) {
		const name = typeof body.name === "string" ? body.name.trim().slice(0, 64) : "";
		if (!name) return NextResponse.json({ error: "Teamname ist erforderlich." }, { status: 400 });
		update.name = name;
	}
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const current = await db.collection("tournament_teams").findOne({ id: body.teamId, tournamentId: id });
	if (!current) return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
	const result = await db
		.collection("tournament_teams")
		.findOneAndUpdate({ id: body.teamId, tournamentId: id }, { $set: update }, { returnDocument: "after", projection: { _id: 0 } });
	await db.collection("tournaments").updateOne({ id }, { $set: { rosterDirty: true } });
	await recordTournamentAudit(db, staff, id, "team.updated", { teamId: body.teamId, fields: Object.keys(update), draft: true });
	return NextResponse.json({ team: result });
}
