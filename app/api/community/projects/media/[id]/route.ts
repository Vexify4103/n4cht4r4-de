import client from "@/lib/db";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Public project pictures uploaded by staff. IDs never change, so responses cache for a long time. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
	await client.connect();
	const db = client.db();
	const mediaId = new ObjectId(id);
	const file = await db.collection("project_media.files").findOne({ _id: mediaId });
	if (!file) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
	const chunks: Buffer[] = [];
	for await (const chunk of new GridFSBucket(db, { bucketName: "project_media" }).openDownloadStream(mediaId)) chunks.push(Buffer.from(chunk));
	return new Response(Buffer.concat(chunks), {
		headers: {
			"Content-Type": String(file.metadata?.mimeType || "application/octet-stream"),
			"Content-Length": String(file.length),
			"Content-Disposition": "inline",
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
