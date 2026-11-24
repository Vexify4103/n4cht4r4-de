import { detectCommunityImageMime, recordCommunityAudit } from "@/lib/community";
import client from "@/lib/db";
import { hasTournamentPermission } from "@/lib/tournament-admin";
import { GridFSBucket } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_IMAGE_SIZE = 6 * 1024 * 1024;

/** Stores a project picture in MongoDB (GridFS) and returns its public URL for the project's imageUrl. */
export async function POST(request: Request) {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung zum Hochladen." }, { status: 403 });
	if (Number(request.headers.get("content-length") || 0) > MAX_IMAGE_SIZE + 256_000)
		return NextResponse.json({ error: "Das Bild darf höchstens 6 MB groß sein." }, { status: 413 });
	const form = await request.formData().catch(() => null);
	const image = form?.get("image");
	if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "Bitte wähle eine Bilddatei aus." }, { status: 400 });
	if (image.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: "Das Bild darf höchstens 6 MB groß sein." }, { status: 413 });
	const buffer = Buffer.from(await image.arrayBuffer());
	const mimeType = detectCommunityImageMime(buffer);
	if (!mimeType) return NextResponse.json({ error: "Erlaubt sind PNG, JPG, WEBP und GIF." }, { status: 415 });
	await client.connect();
	const db = client.db();
	const upload = new GridFSBucket(db, { bucketName: "project_media" }).openUploadStream(`project-${crypto.randomUUID()}`, {
		metadata: { uploadedBy: staff.userId, originalName: image.name.slice(0, 180), mimeType },
	});
	await new Promise<void>((resolve, reject) => {
		upload.once("finish", resolve);
		upload.once("error", reject);
		upload.end(buffer);
	});
	await recordCommunityAudit(db, staff, "community.project.image-uploaded", { mediaId: upload.id.toString() });
	return NextResponse.json({ url: `/api/community/projects/media/${upload.id.toString()}` }, { status: 201 });
}
