import { auth } from "@/auth";
import client from "@/lib/db";
import { getUserChallengeRewards } from "@/lib/challenge-rewards";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function userFilter(userId: string) {
	return ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId as unknown as ObjectId };
}

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	await client.connect();
	const db = client.db();
	const [rewards, user] = await Promise.all([
		getUserChallengeRewards(db, session.user.id),
		db.collection("users").findOne(userFilter(session.user.id), { projection: { showcasedBadgeIds: 1 } }),
	]);
	return NextResponse.json({
		badges: rewards.filter((reward) => reward.type === "badge" && reward.status === "granted"),
		showcasedBadgeIds: Array.isArray(user?.showcasedBadgeIds) ? user.showcasedBadgeIds : [],
	});
}

export async function PATCH(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const body = await request.json().catch(() => null);
	const badgeIds = Array.isArray(body?.badgeIds) ? [...new Set(body.badgeIds.filter((id: unknown): id is string => typeof id === "string"))] : [];
	if (badgeIds.length > 3) return NextResponse.json({ error: "Du kannst höchstens drei Badges präsentieren." }, { status: 400 });
	await client.connect();
	const db = client.db();
	const rewards = await getUserChallengeRewards(db, session.user.id);
	const owned = new Set(rewards.filter((reward) => reward.type === "badge" && reward.status === "granted").map((reward) => reward.rewardKey));
	if (badgeIds.some((id) => !owned.has(id))) return NextResponse.json({ error: "Mindestens ein Badge gehört nicht zu deinem Profil." }, { status: 403 });
	await db.collection("users").updateOne(userFilter(session.user.id), { $set: { showcasedBadgeIds: badgeIds, updatedAt: new Date() } });
	return NextResponse.json({ showcasedBadgeIds: badgeIds });
}
