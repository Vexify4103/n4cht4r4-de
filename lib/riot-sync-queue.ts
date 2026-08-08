import type { Db } from "mongodb";
import { syncRiotChallengesForUser } from "@/lib/riot-challenge-sync";

export type RiotSyncJob = {
	id: string;
	userId: string;
	puuid: string;
	status: "queued" | "processing" | "completed" | "failed";
	activeKey?: string;
	maxMatches: number;
	attempts: number;
	runAfter: Date;
	lockedAt?: Date;
	lastError?: string;
	result?: { matchesChecked: number; progressUpdates: number };
	createdAt: Date;
	updatedAt: Date;
};

let indexPromise: Promise<unknown> | null = null;

export async function ensureRiotQueueIndexes(db: Db) {
	if (!indexPromise) {
		indexPromise = Promise.all([
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ status: 1, runAfter: 1, createdAt: 1 }),
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ userId: 1, createdAt: -1 }),
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $exists: true } } }),
		]).catch((error) => {
			indexPromise = null;
			throw error;
		});
	}
	await indexPromise;
}

export async function enqueueRiotChallengeSync(db: Db, userId: string, puuid: string, maxMatches = 30) {
	await ensureRiotQueueIndexes(db);
	const existing = await db.collection<RiotSyncJob>("riot_sync_queue").findOne({ userId, status: { $in: ["queued", "processing"] } });
	if (existing) return { job: existing, created: false };
	const now = new Date();
	const job: RiotSyncJob = {
		id: `riot_sync_${crypto.randomUUID()}`,
		userId,
		puuid,
		status: "queued",
		activeKey: `user:${userId}`,
		maxMatches: Math.max(1, Math.min(50, maxMatches)),
		attempts: 0,
		runAfter: now,
		createdAt: now,
		updatedAt: now,
	};
	try {
		await db.collection<RiotSyncJob>("riot_sync_queue").insertOne(job);
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
		const active = await db.collection<RiotSyncJob>("riot_sync_queue").findOne({ activeKey: job.activeKey });
		if (active) return { job: active, created: false };
		throw error;
	}
	return { job, created: true };
}

async function claimRiotSyncJob(db: Db) {
	const staleBefore = new Date(Date.now() - 15 * 60 * 1_000);
	await db
		.collection<RiotSyncJob>("riot_sync_queue")
		.updateMany(
			{ status: "processing", lockedAt: { $lt: staleBefore } },
			{ $set: { status: "queued", runAfter: new Date(), updatedAt: new Date() }, $unset: { lockedAt: "" } }
		);
	return db
		.collection<RiotSyncJob>("riot_sync_queue")
		.findOneAndUpdate(
			{ status: "queued", runAfter: { $lte: new Date() } },
			{ $set: { status: "processing", lockedAt: new Date(), updatedAt: new Date() } },
			{ sort: { runAfter: 1, createdAt: 1 }, returnDocument: "after" }
		);
}

export async function processNextRiotSyncJob(db: Db) {
	const job = await claimRiotSyncJob(db);
	if (!job) return { processed: false };
	try {
		const result = await syncRiotChallengesForUser(db, job.userId, job.puuid, job.maxMatches);
		await db
			.collection<RiotSyncJob>("riot_sync_queue")
			.updateOne({ id: job.id }, { $set: { status: "completed", result, updatedAt: new Date() }, $unset: { lockedAt: "", activeKey: "" } });
		return { processed: true, jobId: job.id, status: "completed", result };
	} catch (error) {
		const attempts = job.attempts + 1;
		const failed = attempts >= 5;
		await db.collection<RiotSyncJob>("riot_sync_queue").updateOne(
			{ id: job.id },
			{
				$set: {
					status: failed ? "failed" : "queued",
					attempts,
					runAfter: new Date(Date.now() + Math.min(2 ** attempts * 60_000, 60 * 60 * 1_000)),
					lastError: error instanceof Error ? error.message : "Unknown Riot sync error",
					updatedAt: new Date(),
				},
				$unset: failed ? { lockedAt: "", activeKey: "" } : { lockedAt: "" },
			}
		);
		return { processed: true, jobId: job.id, status: failed ? "failed" : "requeued" };
	}
}
