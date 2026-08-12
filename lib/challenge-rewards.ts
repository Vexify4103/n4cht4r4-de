import type { Db } from "mongodb";
import { ChallengeDef, getChallengeDefinitions } from "@/lib/challenges";

export type ChallengeCompletion = {
	id: string;
	userId: string;
	challengeId: string;
	seasonId: string;
	completedAt: Date;
};

export type ChallengeRewardGrant = {
	id: string;
	userId: string;
	challengeId: string;
	seasonId: string;
	type: "badge" | "discord_role";
	rewardKey: string;
	label: string;
	badge?: ChallengeDef["badge"];
	discordRoleId?: string;
	status: "granted" | "available" | "queued" | "failed";
	discordJobId?: string;
	createdAt: Date;
	updatedAt: Date;
};

let indexPromise: Promise<unknown> | null = null;

export async function ensureChallengeRewardIndexes(db: Db) {
	if (!indexPromise) {
		indexPromise = Promise.all([
			db.collection<ChallengeCompletion>("challenge_completions").createIndex({ userId: 1, challengeId: 1 }, { unique: true }),
			db.collection<ChallengeRewardGrant>("challenge_reward_grants").createIndex({ userId: 1, challengeId: 1, type: 1, rewardKey: 1 }, { unique: true }),
			db.collection<ChallengeRewardGrant>("challenge_reward_grants").createIndex({ userId: 1, createdAt: -1 }),
		]).catch((error) => {
			indexPromise = null;
			throw error;
		});
	}
	await indexPromise;
}

async function createRewards(db: Db, userId: string, challenge: ChallengeDef) {
	const now = new Date();
	const grants = db.collection<ChallengeRewardGrant>("challenge_reward_grants");
	if (challenge.badge) {
		await grants.updateOne(
			{ userId, challengeId: challenge.id, type: "badge", rewardKey: challenge.badge.id },
			{
				$set: {
					label: challenge.badge.name,
					badge: challenge.badge,
					updatedAt: now,
				},
				$setOnInsert: {
					id: `reward_${crypto.randomUUID()}`,
					userId,
					challengeId: challenge.id,
					seasonId: challenge.seasonId,
					type: "badge",
					rewardKey: challenge.badge.id,
					status: "granted",
					createdAt: now,
				},
			},
			{ upsert: true }
		);
	}
	if (challenge.discordRoleId) {
		await grants.updateOne(
			{ userId, challengeId: challenge.id, type: "discord_role", rewardKey: challenge.discordRoleId },
			{
				$setOnInsert: {
					id: `reward_${crypto.randomUUID()}`,
					userId,
					challengeId: challenge.id,
					seasonId: challenge.seasonId,
					type: "discord_role",
					rewardKey: challenge.discordRoleId,
					label: challenge.discordRoleName || "Challenge-Rolle",
					discordRoleId: challenge.discordRoleId,
					status: "available",
					createdAt: now,
					updatedAt: now,
				},
			},
			{ upsert: true }
		);
	}
}

async function refreshMetaChallenges(db: Db, userId: string) {
	const definitions = (await getChallengeDefinitions(db)).filter((challenge) => challenge.type === "meta" && challenge.prerequisiteIds?.length);
	for (const challenge of definitions) {
		const count = await db.collection<ChallengeCompletion>("challenge_completions").countDocuments({ userId, challengeId: { $in: challenge.prerequisiteIds } });
		await db
			.collection("challenge_progress")
			.updateOne(
				{ userId, challengeId: challenge.id },
				{ $set: { progress: count, updatedAt: new Date() }, $setOnInsert: { userId, challengeId: challenge.id, createdAt: new Date() } },
				{ upsert: true }
			);
		if (count >= challenge.target) await syncChallengeCompletion(db, userId, challenge, false);
	}
}

export async function syncChallengeCompletion(db: Db, userId: string, challenge: ChallengeDef, refreshMeta = true) {
	if (challenge.type === "community") return false;
	await ensureChallengeRewardIndexes(db);
	const progress = await db.collection("challenge_progress").findOne({ userId, challengeId: challenge.id });
	if (Number(progress?.progress || 0) < challenge.target) return false;
	const now = new Date();
	const result = await db
		.collection<ChallengeCompletion>("challenge_completions")
		.updateOne(
			{ userId, challengeId: challenge.id },
			{ $setOnInsert: { id: `completion_${crypto.randomUUID()}`, userId, challengeId: challenge.id, seasonId: challenge.seasonId, completedAt: now } },
			{ upsert: true }
		);
	await createRewards(db, userId, challenge);
	if (result.upsertedCount && refreshMeta) await refreshMetaChallenges(db, userId);
	return true;
}

export async function syncChallengeCompletions(db: Db, userId: string, challenges: ChallengeDef[]) {
	for (const challenge of challenges) await syncChallengeCompletion(db, userId, challenge);
}

export async function getUserChallengeRewards(db: Db, userId: string) {
	await ensureChallengeRewardIndexes(db);
	return db.collection<ChallengeRewardGrant>("challenge_reward_grants").find({ userId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray();
}
