import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import { createTournamentNotification } from "@/lib/tournament-notifications";
import { isDiscordQueueConfigured, queueMemberRoleAssignment, queueMemberRoleRemoval, queueTeamProvisioning, queueTeamRename } from "@/lib/discord-queue";
import client from "@/lib/db";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RosterMember = {
	applicationId?: string;
	userId?: string;
	name?: string;
	role?: string;
	discordId?: string;
};

type RosterTeam = {
	id: string;
	name: string;
	seed?: number | null;
	members?: RosterMember[];
	publicMembers?: RosterMember[];
	publicName?: string;
	discordManaged?: boolean;
	discord?: { roleId?: string };
};

type ApplicationDocument = {
	id: string;
	tournamentId: string;
	userId?: string;
	discordId?: string;
	status?: string;
	teamId?: string | null;
};

function rosterSnapshot(teams: RosterTeam[]) {
	return teams.flatMap((team) =>
		(team.members || [])
			.filter((member) => member.userId)
			.map((member) => ({
				userId: String(member.userId),
				applicationId: String(member.applicationId || ""),
				teamId: team.id,
				teamName: team.name,
				role: String(member.role || "Spieler"),
			}))
	);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("referee");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Veröffentlichen des Rosters." }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (!body || !["publish", "renotify"].includes(body.action)) {
		return NextResponse.json({ error: "Ungültige Roster-Aktion." }, { status: 400 });
	}

	let { id } = await params;
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	const teams = (await db.collection<RosterTeam>("tournament_teams").find({ tournamentId: id }).sort({ seed: 1, name: 1 }).toArray()) as RosterTeam[];
	if (!teams.length) return NextResponse.json({ error: "Lege zuerst mindestens ein Team an." }, { status: 409 });

	const teamSize = typeof tournament.teamSize === "number" ? tournament.teamSize : 5;
	const incompleteTeams = teams.filter((team) => (team.members || []).length !== teamSize);
	if (body.action === "publish" && incompleteTeams.length) {
		return NextResponse.json(
			{
				error: `Noch nicht vollständig: ${incompleteTeams.map((team) => `${team.name} (${team.members?.length || 0}/${teamSize})`).join(", ")}.`,
			},
			{ status: 409 }
		);
	}

	const rosterEntries = teams.flatMap((team) => (team.members || []).map((member) => ({ team, member })));
	const applicationIds = rosterEntries
		.map(({ member }) => member.applicationId)
		.filter((applicationId): applicationId is string => typeof applicationId === "string" && Boolean(applicationId));
	const applications = applicationIds.length
		? await db
				.collection<ApplicationDocument>("tournament_applications")
				.find({ tournamentId: id, id: { $in: applicationIds } })
				.toArray()
		: [];
	const applicationById = new Map(applications.map((application) => [application.id, application]));
	const seenApplications = new Set<string>();
	const seenUsers = new Set<string>();
	const invalidMembers = rosterEntries.filter(({ team, member }) => {
		const applicationId = member.applicationId?.trim() || "";
		const userId = member.userId?.trim() || "";
		const discordId = member.discordId?.trim() || "";
		const application = applicationById.get(applicationId);
		const duplicate = seenApplications.has(applicationId) || seenUsers.has(userId);
		if (applicationId) seenApplications.add(applicationId);
		if (userId) seenUsers.add(userId);
		return (
			!applicationId ||
			!userId ||
			!discordId ||
			!application ||
			application.status !== "accepted" ||
			application.teamId !== team.id ||
			application.userId !== userId ||
			application.discordId !== discordId ||
			duplicate
		);
	});
	if (invalidMembers.length) {
		const affectedTeams = [...new Set(invalidMembers.map(({ team }) => team.name))].join(", ");
		return NextResponse.json(
			{
				error: `Der Roster enthält Spieler ohne gültige Turnieranmeldung (${affectedTeams}). Entferne alte manuelle Einträge und besetze jeden Platz über den Bewerber-Pool.`,
			},
			{ status: 409 }
		);
	}

	const snapshot = rosterSnapshot(teams);
	const previous = Array.isArray(tournament.publishedRoster) ? (tournament.publishedRoster as { userId?: string; teamId?: string; teamName?: string; role?: string }[]) : [];
	const changed =
		body.action === "renotify"
			? snapshot
			: snapshot.filter(
					(entry) => !previous.some((old) => old.userId === entry.userId && old.teamId === entry.teamId && old.teamName === entry.teamName && old.role === entry.role)
				);

	if (body.action === "publish") {
		const publishedAt = new Date();
		const teamById = new Map(teams.map((team) => [team.id, team]));
		const removed = previous.filter((entry) => entry.userId && !snapshot.some((current) => current.userId === entry.userId));
		const roleJobs: Promise<unknown>[] = [];
		const discordSetupJobs: Promise<unknown>[] = [];
		const discordConfigured = isDiscordQueueConfigured();
		for (const team of teams) {
			if (!discordConfigured) break;
			if (!team.discord?.roleId) discordSetupJobs.push(queueTeamProvisioning(db, id, team.id));
			else if (team.publicName && team.publicName !== team.name) discordSetupJobs.push(queueTeamRename(db, id, team.id));
		}
		await Promise.all(discordSetupJobs);
		for (const entry of changed) {
			const team = teamById.get(entry.teamId);
			const member = team?.members?.find((candidate) => candidate.userId === entry.userId);
			const previousEntry = previous.find((candidate) => candidate.userId === entry.userId);
			const previousTeam = previousEntry?.teamId ? teamById.get(previousEntry.teamId) : undefined;
			if (previousEntry?.teamId && previousEntry.teamId !== entry.teamId && previousTeam?.discordManaged && member?.discordId) {
				roleJobs.push(queueMemberRoleRemoval(db, id, previousEntry.teamId, member.discordId));
			}
			if (member?.discordId) roleJobs.push(queueMemberRoleAssignment(db, id, entry.teamId, member.discordId));
		}
		for (const entry of removed) {
			const previousTeam = entry.teamId ? teamById.get(entry.teamId) : undefined;
			const member = previousTeam?.publicMembers?.find((candidate) => candidate.userId === entry.userId);
			if (previousTeam?.discordManaged && member?.discordId) roleJobs.push(queueMemberRoleRemoval(db, id, previousTeam.id, member.discordId));
		}
		await Promise.all(
			teams.map((team) =>
				db.collection("tournament_teams").updateOne(
					{ id: team.id, tournamentId: id },
					{
						$set: {
							published: true,
							publishedAt,
							publicName: team.name,
							publicSeed: team.seed,
							publicMembers: team.members || [],
							discordManaged: discordConfigured || Boolean(team.discordManaged),
						},
					}
				)
			)
		);
		await db.collection("tournaments").updateOne({ id }, { $set: { publishedRoster: snapshot, rosterPublishedAt: publishedAt, rosterDirty: false } });
		await Promise.all(roleJobs);
	}

	const href = `/tournaments/${publicTournamentId(tournament)}/teams`;
	const notifications = await Promise.all(
		changed.map((entry) =>
			createTournamentNotification(db, {
				userId: entry.userId,
				tournamentId: id,
				type: body.action === "renotify" ? "roster.reminder" : "roster.published",
				title: body.action === "renotify" ? `Erinnerung: Dein Team für ${tournament.title}` : `Dein Team für ${tournament.title} steht fest`,
				body: `Du spielst in ${entry.teamName} auf dem Platz ${entry.role}. Deine Einteilung findest du jetzt im Turnierhub.`,
				href,
			})
		)
	);
	const dmQueued = notifications.filter((notification) => notification.discordStatus === "pending").length;
	const dmDisabled = notifications.length - dmQueued;

	await recordTournamentAudit(db, staff, id, body.action === "renotify" ? "roster.renotified" : "roster.published", {
		teamCount: teams.length,
		playerCount: snapshot.length,
		notificationCount: notifications.length,
	});
	return NextResponse.json({
		published: body.action === "publish",
		teamCount: teams.length,
		playerCount: snapshot.length,
		notificationCount: notifications.length,
		dmQueued,
		dmDisabled,
	});
}
