import { auth } from "@/auth";
import { detectCommunityImageMime, ensureCommunityIndexes } from "@/lib/community";
import client from "@/lib/db";
import { getPublicBadgeShowcases } from "@/lib/public-badges";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_ARTWORK_SIZE = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
	const kind = request.nextUrl.searchParams.get("kind");
	const mine = request.nextUrl.searchParams.get("mine") === "1";
	const page = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("page") || "0", 10) || 0);
	const limit = Math.min(150, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") || "18", 10) || 18));
	const session = mine ? await auth() : null;
	if (mine && (!session?.user?.id || !ObjectId.isValid(session.user.id))) {
		return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	}
	try {
		await client.connect();
		const db = client.db();
		await ensureCommunityIndexes(db);
		const query: Record<string, unknown> = mine ? { userId: session!.user!.id } : { status: "published" };
		if (kind === "message" || kind === "fanart") query.kind = kind;
		const [posts, total] = await Promise.all([
			db
				.collection("community_posts")
				.find(query)
				.project({ _id: 0, discordId: 0, moderationNote: 0, moderatedBy: 0 })
				.sort(mine ? { createdAt: -1 } : { publishedAt: -1, createdAt: -1 })
				.skip(page * limit)
				.limit(limit)
				.toArray(),
			db.collection("community_posts").countDocuments(query),
		]);
		const badgeShowcases = await getPublicBadgeShowcases(
			db,
			posts.map((post) => (typeof post.userId === "string" ? post.userId : ""))
		);
		return NextResponse.json(
			{
				posts: posts.map((post) => {
					const userId = typeof post.userId === "string" ? post.userId : "";
					const { userId: _userId, mediaId, mediaMime: _mediaMime, ...safePost } = post;
					void _userId;
					void _mediaMime;
					return {
						...safePost,
						authorId: userId,
						profileHref: userId ? `/community/members/${userId}` : null,
						badges: badgeShowcases.get(userId) || [],
						mediaUrl: mediaId ? `/api/community/media/${mediaId}` : null,
					};
				}),
				total,
				hasMore: (page + 1) * limit < total,
			},
			{ headers: mine ? { "Cache-Control": "private, no-store" } : undefined }
		);
	} catch {
		return mine
			? NextResponse.json({ error: "Deine Einreichungen konnten gerade nicht geladen werden." }, { status: 503 })
			: NextResponse.json({ posts: [], total: 0, hasMore: false });
	}
}

export async function POST(request: NextRequest) {
	const session = await auth();
	if (!session?.user?.id || !ObjectId.isValid(session.user.id)) return NextResponse.json({ error: "Bitte melde dich zuerst mit Discord an." }, { status: 401 });
	const contentLength = Number(request.headers.get("content-length") || 0);
	if (contentLength > MAX_ARTWORK_SIZE + 256_000) return NextResponse.json({ error: "Die Datei darf höchstens 8 MB groß sein." }, { status: 413 });

	const form = await request.formData().catch(() => null);
	if (!form) return NextResponse.json({ error: "Die Einsendung konnte nicht gelesen werden." }, { status: 400 });
	const kind = form.get("kind") === "fanart" ? "fanart" : "message";
	const title = String(form.get("title") || "")
		.trim()
		.slice(0, 100);
	const body = String(form.get("body") || "")
		.trim()
		.slice(0, 1_200);
	if (body.length < 3) return NextResponse.json({ error: "Schreib bitte mindestens ein paar Worte." }, { status: 400 });
	if (kind === "fanart" && title.length < 2) return NextResponse.json({ error: "Gib deinem Fanart bitte einen kurzen Titel." }, { status: 400 });

	await client.connect();
	const db = client.db();
	await ensureCommunityIndexes(db);
	const userId = session.user.id;
	const userObjectId = new ObjectId(userId);
	const account = await db.collection("accounts").findOne({ userId: { $in: [userObjectId, userId] }, provider: "discord" });
	if (!account) return NextResponse.json({ error: "Für die Community-Pinnwand muss Discord verbunden sein." }, { status: 403 });

	const since = new Date(Date.now() - 60 * 60 * 1000);
	const [recentCount, pendingCount] = await Promise.all([
		db.collection("community_posts").countDocuments({ userId, createdAt: { $gte: since } }),
		db.collection("community_posts").countDocuments({ userId, status: "pending" }),
	]);
	if (recentCount >= 4) return NextResponse.json({ error: "Du hast gerade mehrere Beiträge gesendet. Versuch es bitte in einer Stunde wieder." }, { status: 429 });
	if (pendingCount >= 5) return NextResponse.json({ error: "Du hast bereits fünf Beiträge in der Moderation." }, { status: 429 });

	let mediaId: ObjectId | null = null;
	let mediaMime: string | null = null;
	if (kind === "fanart") {
		const artwork = form.get("artwork");
		if (!(artwork instanceof File) || artwork.size === 0) return NextResponse.json({ error: "Bitte wähle eine Bilddatei aus." }, { status: 400 });
		if (artwork.size > MAX_ARTWORK_SIZE) return NextResponse.json({ error: "Das Fanart darf höchstens 8 MB groß sein." }, { status: 413 });
		const buffer = Buffer.from(await artwork.arrayBuffer());
		mediaMime = detectCommunityImageMime(buffer);
		if (!mediaMime) return NextResponse.json({ error: "Erlaubt sind PNG, JPG, WEBP und GIF." }, { status: 415 });
		const bucket = new GridFSBucket(db, { bucketName: "community_media" });
		const upload = bucket.openUploadStream(`community-${crypto.randomUUID()}`, {
			metadata: { userId, discordId: account.providerAccountId, originalName: artwork.name.slice(0, 180), mimeType: mediaMime },
		});
		await new Promise<void>((resolve, reject) => {
			upload.once("finish", resolve);
			upload.once("error", reject);
			upload.end(buffer);
		});
		mediaId = upload.id;
	}

	const now = new Date();
	const post = {
		id: `community_${crypto.randomUUID()}`,
		kind,
		title,
		body,
		userId,
		discordId: account.providerAccountId,
		authorName: String(session.user.name || "Community-Mitglied").slice(0, 80),
		authorImage: session.user.image || null,
		mediaId,
		mediaMime,
		status: "pending",
		createdAt: now,
		updatedAt: now,
		publishedAt: null,
	};
	try {
		await db.collection("community_posts").insertOne(post);
	} catch (error) {
		if (mediaId) await new GridFSBucket(db, { bucketName: "community_media" }).delete(mediaId).catch(() => undefined);
		throw error;
	}
	return NextResponse.json(
		{ post: { ...post, mediaId: mediaId?.toString(), profileHref: `/community/members/${userId}`, mediaUrl: mediaId ? `/api/community/media/${mediaId}` : null } },
		{ status: 201 }
	);
}
