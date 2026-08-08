import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { createId, createSingleEliminationMatches } from "@/lib/tournament-engine";
import { queueTeamProvisioning, queueTeamRename } from "@/lib/discord-queue";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TeamMemberDocument = {
	applicationId?: string;
	userId?: string;
	name: string;
	role?: string;
	discordId?: string;
	opgg?: string;
	champs?: string[];
};

type TeamDocument = {
	id: string;
	tournamentId: string;
	name: string;
	members: TeamMemberDocument[];
	seed: number;
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
	const rawMembers: unknown[] = Array.isArray(body?.members) ? body.members.slice(0, 10) : [];
	const members = rawMembers
		.map((rawMember) => {
			const member = rawMember && typeof rawMember === "object" ? (rawMember as Record<string, unknown>) : {};
			return {
				name: typeof member.name === "string" ? member.name.trim().slice(0, 48) : "",
				role: typeof member.role === "string" ? member.role.trim().slice(0, 24) : "",
				opgg: typeof member.opgg === "string" ? member.opgg.trim().slice(0, 300) : "",
				discordId: typeof member.discordId === "string" ? member.discordId.trim().slice(0, 32) : "",
				champs: Array.isArray(member.champs) ? member.champs.filter((champion: unknown): champion is string => typeof champion === "string").slice(0, 3) : [],
			};
		})
		.filter((member) => member.name);
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if (typeof tournament.maxTeams === "number" && Number(tournament.currentTeams || 0) >= tournament.maxTeams)
		return NextResponse.json({ error: `Dieses Turnier ist mit ${tournament.maxTeams} Teams bereits voll.` }, { status: 409 });
	const discordManaged = body?.createDiscordResources === true;
	const team = {
		id: createId("team"),
		tournamentId: id,
		name,
		members,
		seed: Number.isInteger(body?.seed) ? body.seed : 999,
		published: false,
		discordManaged,
		createdAt: new Date(),
	};
	await db.collection("tournament_teams").insertOne(team);
	await db.collection("tournaments").updateOne({ id }, { $inc: { currentTeams: 1 }, $set: { rosterDirty: true } });
	if (tournament.maxTeams === 4 && Number(tournament.currentTeams || 0) + 1 === 4) {
		const existingMatches = await db.collection("tournament_matches").countDocuments({ tournamentId: id });
		if (!existingMatches) {
			const allTeams = await db.collection("tournament_teams").find({ tournamentId: id }).sort({ seed: 1, name: 1 }).toArray();
			await db.collection("tournament_matches").insertMany(
				createSingleEliminationMatches(
					id,
					allTeams.map((entry) => String(entry.id))
				)
			);
			await recordTournamentAudit(db, staff, id, "bracket.playoffs_generated", { teamCount: allTeams.length, automatic: true });
		}
	}
	const discordJob = discordManaged ? await queueTeamProvisioning(db, id, team.id) : null;
	await recordTournamentAudit(db, staff, id, "team.created", { teamId: team.id, name, discordJobId: discordJob?.id || null });
	return NextResponse.json({ team, discordJobQueued: Boolean(discordJob) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten von Teams." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	if (!body?.teamId) return NextResponse.json({ error: "Team fehlt." }, { status: 400 });
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
		const slot = typeof body.slot === "string" ? body.slot.trim().slice(0, 24) : "Spieler";
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
	if (body.action === "provision") {
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		id = String(tournament.id);
		const current = await db.collection("tournament_teams").findOne({ id: body.teamId, tournamentId: id });
		if (!current) return NextResponse.json({ error: "Team nicht gefunden." }, { status: 404 });
		const job = await queueTeamProvisioning(db, id, body.teamId);
		if (!job) return NextResponse.json({ error: "Discord-Provisionierung ist noch nicht konfiguriert." }, { status: 503 });
		await recordTournamentAudit(db, staff, id, "team.discord_provisioning_queued", { teamId: body.teamId, jobId: job.id });
		return NextResponse.json({ job });
	}
	const update: Record<string, unknown> = {};
	for (const key of ["name", "members", "seed", "published"]) if (key in body) update[key] = body[key];
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
	const discordJobs = typeof update.name === "string" && update.name.trim() && update.name.trim() !== current.name ? await queueTeamRename(db, id, body.teamId) : [];
	await recordTournamentAudit(db, staff, id, "team.updated", { teamId: body.teamId, fields: Object.keys(update), discordRenameJobIds: discordJobs.map((job) => job.id) });
	return NextResponse.json({ team: result, discordRenameJobsQueued: discordJobs.length });
}
