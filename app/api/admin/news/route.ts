import { randomUUID } from "node:crypto";
import client from "@/lib/db";
import { cleanNews, ensureNews } from "@/lib/news";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { recordCommunityAudit } from "@/lib/community";
import { NextResponse } from "next/server";

export async function GET() {
	if (!(await hasTournamentPermission("tournament_admin"))) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
	const db = client.db();
	await ensureNews(db);
	return NextResponse.json({
		news: await db
			.collection("news")
			.find({ deleted: { $ne: true } })
			.project({ _id: 0 })
			.sort({ createdAt: -1 })
			.limit(100)
			.toArray(),
	});
}

async function save(request: Request, create: boolean) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const news = body && cleanNews(body);
	if (!news || (!create && typeof body.id !== "string")) return NextResponse.json({ error: "Titel, Text, Kategorie und ein gültiger Link sind erforderlich." }, { status: 400 });
	const db = client.db();
	await ensureNews(db);
	const id = create ? randomUUID() : body.id;
	if (create) await db.collection("news").insertOne({ ...news, id, createdAt: new Date(), updatedAt: new Date() });
	else {
		const result = await db.collection("news").updateOne({ id, deleted: { $ne: true } }, { $set: { ...news, updatedAt: new Date() } });
		if (!result.matchedCount) return NextResponse.json({ error: "News nicht gefunden." }, { status: 404 });
	}
	await recordCommunityAudit(db, staff, create ? "news.created" : "news.updated", { id });
	return NextResponse.json({ ok: true });
}
export async function POST(request: Request) {
	return save(request, true);
}
export async function PATCH(request: Request) {
	return save(request, false);
}
export async function DELETE(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (typeof body?.id !== "string") return NextResponse.json({ error: "News fehlt." }, { status: 400 });
	const db = client.db();
	const result = await db.collection("news").updateOne({ id: body.id, deleted: { $ne: true } }, { $set: { deleted: true, published: false, updatedAt: new Date() } });
	if (!result.matchedCount) return NextResponse.json({ error: "News nicht gefunden." }, { status: 404 });
	await recordCommunityAudit(db, staff, "news.deleted", { id: body.id });
	return NextResponse.json({ ok: true });
}
