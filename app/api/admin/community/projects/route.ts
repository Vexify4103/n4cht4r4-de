import { cleanCommunityProject, defaultCommunityProjects, ensureCommunityIndexes, recordCommunityAudit, seedDefaultCommunityProjects } from "@/lib/community";
import client from "@/lib/db";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function projectId(title: string) {
	return title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 70);
}

export async function GET() {
	const staff = await hasTournamentPermission("viewer");
	if (!staff) return NextResponse.json({ error: "Kein Zugriff auf Community-Projekte." }, { status: 403 });
	await client.connect();
	const db = client.db();
	await ensureCommunityIndexes(db);
	const records = await db.collection("community_projects").find({}).project({ _id: 0 }).sort({ order: 1 }).toArray();
	return NextResponse.json({ projects: records.length ? records : defaultCommunityProjects, usingDefaults: records.length === 0 });
}

export async function POST(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Erstellen." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const title = typeof body?.title === "string" ? body.title.trim() : "";
	const id = projectId(title);
	const project = cleanCommunityProject({ ...body, id });
	if (!project) return NextResponse.json({ error: "Titel, Spiel und Kurzbeschreibung sind erforderlich." }, { status: 400 });
	await client.connect();
	const db = client.db();
	await ensureCommunityIndexes(db);
	await seedDefaultCommunityProjects(db);
	try {
		await db.collection("community_projects").insertOne({ ...project, createdAt: new Date(), updatedAt: new Date() });
	} catch (error) {
		if (error instanceof Error && error.message.includes("duplicate key"))
			return NextResponse.json({ error: "Ein Projekt mit diesem Namen existiert bereits." }, { status: 409 });
		throw error;
	}
	await recordCommunityAudit(db, staff, "community.project.created", { projectId: id });
	return NextResponse.json({ project }, { status: 201 });
}

export async function PATCH(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const id = typeof body?.id === "string" ? body.id.trim() : "";
	const project = cleanCommunityProject({ ...body, id }, id);
	if (!project) return NextResponse.json({ error: "Titel, Spiel und Kurzbeschreibung sind erforderlich." }, { status: 400 });
	await client.connect();
	const db = client.db();
	await ensureCommunityIndexes(db);
	await seedDefaultCommunityProjects(db);
	const result = await db
		.collection("community_projects")
		.findOneAndUpdate(
			{ id },
			{ $set: { ...project, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
			{ upsert: true, returnDocument: "after", projection: { _id: 0 } }
		);
	await recordCommunityAudit(db, staff, "community.project.updated", { projectId: id });
	return NextResponse.json({ project: result });
}

export async function DELETE(request: Request) {
	const staff = await hasTournamentPermission("owner");
	if (!staff) return NextResponse.json({ error: "Nur Owner können Projekte vollständig löschen." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const id = typeof body?.id === "string" ? body.id : "";
	if (!id) return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const result = await db.collection("community_projects").deleteOne({ id });
	if (!result.deletedCount) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	await recordCommunityAudit(db, staff, "community.project.deleted", { projectId: id });
	return NextResponse.json({ deleted: true });
}
