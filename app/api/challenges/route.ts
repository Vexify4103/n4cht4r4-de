import { auth } from "@/auth";
import { NextResponse } from "next/server";
import client from "@/lib/db";
import { getChallengeDefinitions } from "@/lib/challenges";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();
	await client.connect();
	const db = client.db();
	const progressCollection = db.collection("challenge_progress");
	const definitions = await getChallengeDefinitions(db);

	const challenges = await Promise.all(definitions.map(async (challenge) => {
		if (challenge.type === "community") {
			const result = await progressCollection.aggregate([
				{ $match: { challengeId: challenge.id } },
				{ $group: { _id: null, total: { $sum: "$progress" } } },
			]).toArray();
			return { ...challenge, progress: result[0]?.total || 0 };
		}

		const progress = session?.user?.id
			? await progressCollection.findOne({ userId: session.user.id, challengeId: challenge.id })
			: null;

		return { ...challenge, progress: progress?.progress || 0 };
	}));

	return NextResponse.json({ challenges });
}
