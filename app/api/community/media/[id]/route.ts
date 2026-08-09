import { hasTournamentPermission } from "@/lib/tournament-admin";
import client from "@/lib/db";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
	await client.connect();
	const db = client.db();
	const mediaId = new ObjectId(id);
	const post = await db.collection("community_posts").findOne({ mediaId });
	if (!post) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
	if (post.status !== "published" && !(await hasTournamentPermission("viewer"))) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });

	const bucket = new GridFSBucket(db, { bucketName: "community_media" });
	const file = await db.collection("community_media.files").findOne({ _id: mediaId });
	if (!file) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
	const chunks: Buffer[] = [];
	for await (const chunk of bucket.openDownloadStream(mediaId)) chunks.push(Buffer.from(chunk));
	return new Response(Buffer.concat(chunks), {
		headers: {
			"Content-Type": String(file.metadata?.mimeType || post.mediaMime || "application/octet-stream"),
			"Content-Length": String(file.length),
			"Content-Disposition": "inline",
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": post.status === "published" ? "public, max-age=86400, immutable" : "private, no-store",
		},
	});
}
