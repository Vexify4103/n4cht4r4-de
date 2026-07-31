import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/db";
import { syncRiotChallengesForUser } from "@/lib/riot-challenge-sync";

export const runtime = "nodejs";

export async function POST() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await client.connect();
	const db = client.db();
	const id = session.user.id;
	const user = await db.collection("users").findOne(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as unknown as ObjectId });
	if (!user?.riotPuuid) return NextResponse.json({ error: "Riot account is not verified" }, { status: 400 });

	try {
		const result = await syncRiotChallengesForUser(db, id, user.riotPuuid, 50);
		return NextResponse.json({ updated: result.matchesChecked > 0, ...result });
	} catch (error) {
		console.error("Manual Riot challenge sync failed:", error);
		return NextResponse.json({ error: "Challenge progress could not be updated" }, { status: 502 });
	}
}
