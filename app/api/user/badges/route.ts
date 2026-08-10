import { auth } from "@/auth";
import client from "@/lib/db";
import { getUserChallengeRewards } from "@/lib/challenge-rewards";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { syncPermanentTournamentMilestonesForUser } from "@/lib/tournament-rewards";
import { SITE_ADMIN_CHALLENGE_ID, SITE_OWNER_CHALLENGE_ID, syncStaffBadgesForUser } from "@/lib/staff-badges";

export const runtime = "nodejs";

function userFilter(userId: string) {
	return ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId as unknown as ObjectId };
}

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	await client.connect();
	const db = client.db();
	await syncPermanentTournamentMilestonesForUser(db, session.user.id).catch((error) => {
		console.error("Permanent tournament rewards could not be synchronized:", error);
	});
	await syncStaffBadgesForUser(db, session.user.id).catch((error) => {
		console.error("Staff badges could not be synchronized:", error);
	});
	const [rewards, user] = await Promise.all([
		getUserChallengeRewards(db, session.user.id),
		db.collection("users").findOne(userFilter(session.user.id), { projection: { showcasedBadgeIds: 1 } }),
	]);
	const identityChallengeIds = new Set([SITE_ADMIN_CHALLENGE_ID, SITE_OWNER_CHALLENGE_ID]);
	const grantedBadges = rewards.filter((reward) => reward.type === "badge" && reward.status === "granted");
	return NextResponse.json({
		badges: grantedBadges.filter((reward) => !identityChallengeIds.has(reward.challengeId)),
		identityBadges: grantedBadges.filter((reward) => identityChallengeIds.has(reward.challengeId)),
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
	const identityChallengeIds = new Set([SITE_ADMIN_CHALLENGE_ID, SITE_OWNER_CHALLENGE_ID]);
	const owned = new Set(
		rewards.filter((reward) => reward.type === "badge" && reward.status === "granted" && !identityChallengeIds.has(reward.challengeId)).map((reward) => reward.rewardKey)
	);
	if (badgeIds.some((id) => !owned.has(id))) return NextResponse.json({ error: "Mindestens ein Badge gehört nicht zu deinem Profil." }, { status: 403 });
	await db.collection("users").updateOne(userFilter(session.user.id), { $set: { showcasedBadgeIds: badgeIds, updatedAt: new Date() } });
	return NextResponse.json({ showcasedBadgeIds: badgeIds });
}
