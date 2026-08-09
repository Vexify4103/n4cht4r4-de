import { ensureCommunityIndexes, recordCommunityAudit } from "@/lib/community";
import client from "@/lib/db";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	const staff = await hasTournamentPermission("viewer");
	if (!staff) return NextResponse.json({ error: "Kein Zugriff auf die Community-Moderation." }, { status: 403 });
	const requestedStatus = request.nextUrl.searchParams.get("status");
	const status = ["pending", "published", "rejected"].includes(requestedStatus || "") ? requestedStatus : null;
	await client.connect();
	const db = client.db();
	await ensureCommunityIndexes(db);
	const query = status ? { status } : {};
	const posts = await db.collection("community_posts").find(query).project({ _id: 0 }).sort({ createdAt: -1 }).limit(150).toArray();
	const counts = await db
		.collection("community_posts")
		.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
		.toArray();
	return NextResponse.json({
		posts: posts.map((post) => ({ ...post, mediaUrl: post.mediaId ? `/api/community/media/${post.mediaId}` : null })),
		counts: Object.fromEntries(counts.map((entry) => [entry._id, entry.count])),
	});
}

export async function PATCH(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Moderieren." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const id = typeof body?.id === "string" ? body.id : "";
	const status = ["pending", "published", "rejected"].includes(body?.status) ? body.status : null;
	if (!id || !status) return NextResponse.json({ error: "Beitrag und Moderationsstatus fehlen." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const update: Record<string, unknown> = {
		status,
		moderationNote: typeof body?.moderationNote === "string" ? body.moderationNote.trim().slice(0, 500) : "",
		moderatedBy: staff.userId,
		moderatedAt: new Date(),
		updatedAt: new Date(),
	};
	if (status === "published") update.publishedAt = new Date();
	const post = await db.collection("community_posts").findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after", projection: { _id: 0 } });
	if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
	await recordCommunityAudit(db, staff, "community.post.moderated", { postId: id, status });
	return NextResponse.json({ post: { ...post, mediaUrl: post.mediaId ? `/api/community/media/${post.mediaId}` : null } });
}

export async function DELETE(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Löschen." }, { status: 403 });
	const body = await request.json().catch(() => null);
	const id = typeof body?.id === "string" ? body.id : "";
	if (!id) return NextResponse.json({ error: "Beitrag fehlt." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const post = await db.collection("community_posts").findOneAndDelete({ id });
	if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
	if (post.mediaId && ObjectId.isValid(String(post.mediaId))) {
		await new GridFSBucket(db, { bucketName: "community_media" }).delete(new ObjectId(String(post.mediaId))).catch(() => undefined);
	}
	await recordCommunityAudit(db, staff, "community.post.deleted", { postId: id, kind: post.kind });
	return NextResponse.json({ deleted: true });
}
