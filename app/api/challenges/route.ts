import { auth } from "@/auth";
import { NextResponse } from "next/server";
import client from "@/lib/db";
import { getChallengeDefinitions } from "@/lib/challenges";
import { ChallengeCompletion, getUserChallengeRewards } from "@/lib/challenge-rewards";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();
	await client.connect();
	const db = client.db();
	const definitions = await getChallengeDefinitions(db);
	const challengeIds = definitions.map((challenge) => challenge.id);
	const [progressRecords, communityProgress, completions, rewards] = await Promise.all([
		session?.user?.id
			? db
					.collection("challenge_progress")
					.find({ userId: session.user.id, challengeId: { $in: challengeIds } })
					.project({ _id: 0 })
					.toArray()
			: [],
		db
			.collection("challenge_progress")
			.aggregate([
				{ $match: { challengeId: { $in: definitions.filter((challenge) => challenge.type === "community").map((challenge) => challenge.id) } } },
				{ $group: { _id: "$challengeId", total: { $sum: "$progress" } } },
			])
			.toArray(),
		session?.user?.id
			? db
					.collection<ChallengeCompletion>("challenge_completions")
					.find({ userId: session.user.id, challengeId: { $in: challengeIds } })
					.project({ _id: 0 })
					.toArray()
			: [],
		session?.user?.id ? getUserChallengeRewards(db, session.user.id) : [],
	]);
	const progressById = new Map(progressRecords.map((entry) => [String(entry.challengeId), Number(entry.progress || 0)]));
	const communityById = new Map(communityProgress.map((entry) => [String(entry._id), Number(entry.total || 0)]));
	const completionById = new Map(completions.map((entry) => [entry.challengeId, entry]));

	return NextResponse.json({
		challenges: definitions.map((challenge) => ({
			...challenge,
			progress: challenge.type === "community" ? communityById.get(challenge.id) || 0 : progressById.get(challenge.id) || 0,
			completedAt: completionById.get(challenge.id)?.completedAt || null,
			rewards: rewards.filter((reward) => reward.challengeId === challenge.id),
		})),
	});
}
