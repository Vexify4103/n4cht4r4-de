import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/db";
import { enqueueRiotChallengeSync } from "@/lib/riot-sync-queue";

export const runtime = "nodejs";

export async function POST() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await client.connect();
	const db = client.db();
	const id = session.user.id;
	const user = await db.collection("users").findOne(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as unknown as ObjectId });
	if (!user?.riotPuuid) return NextResponse.json({ error: "Riot account is not verified" }, { status: 400 });

	const result = await enqueueRiotChallengeSync(db, id, String(user.riotPuuid), 30);
	return NextResponse.json({ queued: true, created: result.created, jobId: result.job.id }, { status: 202 });
}
