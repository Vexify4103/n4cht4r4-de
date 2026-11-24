import { ObjectId } from "mongodb";
import client from "@/lib/db";
import { getApplicationTypes, isApplicationType } from "@/lib/applications";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordCommunityAudit } from "@/lib/community";
import { queueProjectRoleGrant } from "@/lib/discord-queue";
import { userIdCandidates } from "@/lib/tournament-community";
import { NextResponse } from "next/server";

/** Accepted applicants get the Discord role of every project linked to their application type. */
async function queueProjectRoles(db: ReturnType<typeof client.db>, applicationId: string) {
	const application = await db.collection("applications").findOne({ _id: new ObjectId(applicationId) });
	if (!application?.userId || !application.type) return 0;
	const projects = await db
		.collection("community_projects")
		.find({ applicationType: application.type, discordRoleId: { $regex: "^[0-9]{15,22}$" } })
		.project<{ id: string; discordRoleId: string }>({ _id: 0, id: 1, discordRoleId: 1 })
		.toArray();
	if (!projects.length) return 0;
	const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(String(application.userId)) }, provider: "discord" });
	const discordId = typeof account?.providerAccountId === "string" ? account.providerAccountId : "";
	if (!discordId) return 0;
	let queued = 0;
	for (const project of projects) if (await queueProjectRoleGrant(db, project.id, discordId, project.discordRoleId)) queued++;
	return queued;
}

export async function GET() {
	if (!(await hasTournamentPermission("tournament_admin"))) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
	const db = client.db();
	const definitions = await getApplicationTypes(db);
	const applications = await db.collection("applications").find({}).sort({ createdAt: -1 }).limit(200).toArray();
	return NextResponse.json({ definitions, applications: applications.map(({ _id, ...application }) => ({ ...application, id: _id.toString() })) });
}

export async function PATCH(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const db = client.db();
	if (body?.action === "settings") {
		if (typeof body.type !== "string" || !isApplicationType(body.type) || body.type === "tournaments" || typeof body.open !== "boolean")
			return NextResponse.json({ error: "Ungültige Bewerbungsphase." }, { status: 400 });
		await getApplicationTypes(db);
		await db.collection("application_settings").updateOne({ type: body.type }, { $set: { open: body.open, updatedAt: new Date() } }, { upsert: true });
		await recordCommunityAudit(db, staff, "application.settings.updated", { type: body.type, open: body.open });
	} else {
		if (typeof body?.id !== "string" || !ObjectId.isValid(body.id) || !["pending", "accepted", "rejected"].includes(body.status))
			return NextResponse.json({ error: "Ungültige Entscheidung." }, { status: 400 });
		const note = typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 1500) : "";
		const result = await db
			.collection("applications")
			.updateOne({ _id: new ObjectId(body.id) }, { $set: { status: body.status, reviewNote: note, reviewedBy: staff.userId, reviewedAt: new Date() } });
		if (!result.matchedCount) return NextResponse.json({ error: "Antrag nicht gefunden." }, { status: 404 });
		await recordCommunityAudit(db, staff, "application.reviewed", { id: body.id, status: body.status });
		if (body.status === "accepted") {
			// The decision is already saved; a Discord hiccup must not turn it into an error.
			const rolesQueued = await queueProjectRoles(db, body.id).catch((error) => {
				console.error("[applications] project role queue failed:", error);
				return 0;
			});
			return NextResponse.json({ ok: true, rolesQueued });
		}
	}
	return NextResponse.json({ ok: true });
}
