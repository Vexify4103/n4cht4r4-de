import { ObjectId } from "mongodb";
import client from "@/lib/db";
import { getApplicationTypes, isApplicationType } from "@/lib/applications";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordCommunityAudit } from "@/lib/community";
import { NextResponse } from "next/server";

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
	}
	return NextResponse.json({ ok: true });
}
