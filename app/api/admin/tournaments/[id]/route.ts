import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordTournamentAudit } from "@/lib/tournament-audit";
import client from "@/lib/db";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { registrationWindowState } from "@/lib/tournament-registration";
import { createTournamentNotification } from "@/lib/tournament-notifications";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/tournament-community";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission();
	if (!staff) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	const { id } = await params;
	await client.connect();
	const tournament = await resolveTournament(client.db(), id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	return NextResponse.json({ tournament: { ...tournament, id: tournament.slug || tournament.id, registrationState: registrationWindowState(tournament) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten." }, { status: 403 });
	let { id } = await params;
	const body = await request.json().catch(() => null);
	const allowed = [
		"title",
		"format",
		"status",
		"date",
		"startsAt",
		"rules",
		"published",
		"registrationOpen",
		"maxTeams",
		"bracketType",
		"seriesBestOf",
		"championRule",
		"description",
		"tagline",
		"registrationNote",
		"teamSize",
		"gameMode",
		"applicationModes",
		"wishGroupMode",
		"collectRoles",
	];
	const update: Record<string, unknown> = {};
	for (const key of allowed) if (body && key in body) update[key] = body[key];
	if (Array.isArray(update.rules))
		update.rules = update.rules
			.filter((rule) => typeof rule === "string")
			.map((rule) => rule.trim())
			.filter(Boolean)
			.slice(0, 150);
	if (update.seriesBestOf !== undefined && update.seriesBestOf !== null && ![1, 3, 5].includes(Number(update.seriesBestOf)))
		return NextResponse.json({ error: "Für eine Serie sind nur Best of 1, 3 oder 5 erlaubt." }, { status: 400 });
	if (update.maxTeams !== undefined && update.maxTeams !== null && (!Number.isInteger(Number(update.maxTeams)) || Number(update.maxTeams) < 2 || Number(update.maxTeams) > 128))
		return NextResponse.json({ error: "Das Teamlimit muss zwischen 2 und 128 liegen oder offen bleiben." }, { status: 400 });
	if (update.bracketType !== undefined && !["single_elimination", "double_elimination", "groups"].includes(String(update.bracketType)))
		return NextResponse.json({ error: "Ungültiges Turnierformat." }, { status: 400 });
	if (update.wishGroupMode !== undefined && !["disabled", "duo", "team"].includes(String(update.wishGroupMode)))
		return NextResponse.json({ error: "Ungültige Wunschgruppen-Einstellung." }, { status: 400 });
	if (update.championRule !== undefined && !["none", "light_fearless"].includes(String(update.championRule)))
		return NextResponse.json({ error: "Ungueltige Champion-Regel." }, { status: 400 });
	if (update.status !== undefined && !["announcement", "registration", "live", "completed"].includes(String(update.status)))
		return NextResponse.json({ error: "Ungültiger Turnierstatus." }, { status: 400 });
	if (update.startsAt !== undefined && update.startsAt !== null) {
		const startsAt = new Date(String(update.startsAt));
		if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "Der Turnierstart ist ungültig." }, { status: 400 });
		update.startsAt = startsAt.toISOString();
		update.date = startsAt.toISOString();
	}
	if (update.published !== undefined) update.published = update.published === true;
	if (update.teamSize !== undefined && (!Number.isInteger(Number(update.teamSize)) || Number(update.teamSize) < 1 || Number(update.teamSize) > 10))
		return NextResponse.json({ error: "Die Teamgröße muss zwischen 1 und 10 liegen." }, { status: 400 });
	if (update.gameMode !== undefined) update.gameMode = String(update.gameMode).trim().slice(0, 60);
	if (update.title !== undefined) update.title = String(update.title).trim().slice(0, 100);
	if (update.format !== undefined) update.format = String(update.format).trim().slice(0, 100);
	if (update.title === "" || update.format === "") return NextResponse.json({ error: "Turniername und Format dürfen nicht leer sein." }, { status: 400 });
	if (!Object.keys(update).length) return NextResponse.json({ error: "Keine Änderungen übergeben." }, { status: 400 });
	update.updatedAt = new Date();
	await client.connect();
	const db = client.db();
	const tournament = await resolveTournament(db, id);
	if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	id = String(tournament.id);
	if (update.startsAt && tournament.registrationClosesAt && new Date(String(tournament.registrationClosesAt)) > new Date(String(update.startsAt)))
		return NextResponse.json({ error: "Der Turnierstart darf nicht vor dem Ende der Bewerbungsphase liegen." }, { status: 400 });
	const result = await db.collection("tournaments").findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after", projection: { _id: 0 } });
	if (!result) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
	await recordTournamentAudit(db, staff, id, "tournament.updated", { fields: Object.keys(update) });
	// A moved start date reaches every active applicant (rostered or not) on the site and, if allowed, by Discord DM.
	// Compared per minute: the form only sends minutes, so stored seconds must not count as a move.
	const toMinute = (value: unknown) => (value ? Math.floor(new Date(String(value)).getTime() / 60000) * 60000 : null);
	const previousStart = toMinute(tournament.startsAt);
	const nextStart = toMinute(update.startsAt);
	let rescheduleNotices = 0;
	if (nextStart && previousStart && nextStart !== previousStart && result.status !== "completed") {
		const when = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" }).format(new Date(nextStart));
		const applicants = await db
			.collection("tournament_applications")
			.find({ tournamentId: id, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } })
			.project({ _id: 0, userId: 1 })
			.toArray();
		// One failed notice must not turn the already saved date change into an error response.
		const notices = await Promise.allSettled(
			[...new Set(applicants.map((applicant) => String(applicant.userId)))].map((userId) =>
				createTournamentNotification(db, {
					userId,
					tournamentId: id,
					type: "tournament.rescheduled",
					title: `Neuer Termin: ${result.title}`,
					body: `Das Turnier startet jetzt am ${when} Uhr. Deine Anmeldung bleibt bestehen. Falls du zum neuen Termin nicht kannst, sag bitte der Turnierleitung Bescheid.`,
					href: `/tournaments/${publicTournamentId(result)}`,
				})
			)
		);
		rescheduleNotices = notices.filter((notice) => notice.status === "fulfilled").length;
		const failed = notices.length - rescheduleNotices;
		if (failed) console.error(`[tournament] ${failed} reschedule notices failed for ${id}`);
		await recordTournamentAudit(db, staff, id, "tournament.rescheduled", { from: new Date(previousStart).toISOString(), to: new Date(nextStart).toISOString(), notified: rescheduleNotices });
	}
	return NextResponse.json({ tournament: result, rescheduleNotices });
}
