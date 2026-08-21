import { Db, ObjectId } from "mongodb";
import { syncRiotChallengesForUser } from "@/lib/riot-challenge-sync";
import { getRiotIdentityByPuuid, getRiotRank, resolveRiotIdentity } from "@/lib/riot";

export type RiotSyncJob = {
	id: string;
	type?: "challenge" | "profile";
	userId?: string;
	userIds?: string[];
	applicationIds?: string[];
	puuid?: string;
	platform?: string;
	riotId?: string;
	batchId?: string;
	status: "queued" | "processing" | "completed" | "failed";
	activeKey?: string;
	maxMatches?: number;
	attempts: number;
	runAfter: Date;
	lockedAt?: Date;
	lastError?: string;
	result?: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

let indexPromise: Promise<unknown> | null = null;

export async function ensureRiotQueueIndexes(db: Db) {
	if (!indexPromise) {
		indexPromise = Promise.all([
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ status: 1, runAfter: 1, createdAt: 1 }),
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ userId: 1, createdAt: -1 }),
			db.collection<RiotSyncJob>("riot_sync_queue").createIndex({ type: 1, batchId: 1, status: 1 }),
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
	const existing = await db.collection<RiotSyncJob>("riot_sync_queue").findOne({
		userId,
		status: { $in: ["queued", "processing"] },
		$or: [{ type: "challenge" }, { type: { $exists: false } }],
	});
	if (existing) return { job: existing, created: false };
	const now = new Date();
	const job: RiotSyncJob = {
		id: `riot_sync_${crypto.randomUUID()}`,
		type: "challenge",
		userId,
		puuid,
		status: "queued",
		activeKey: `challenge:user:${userId}`,
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

export type RiotProfileRefreshTarget = {
	puuid?: string;
	platform?: string;
	riotId?: string;
	userIds: string[];
	applicationIds: string[];
};

export async function enqueueRiotProfileRefresh(db: Db, target: RiotProfileRefreshTarget, batchId: string, runAfter: Date) {
	await ensureRiotQueueIndexes(db);
	const identityKey = target.puuid
		? `puuid:${target.puuid}`
		: `riot-id:${String(target.riotId || "")
				.trim()
				.toLowerCase()}`;
	const job: RiotSyncJob = {
		id: `riot_profile_${crypto.randomUUID()}`,
		type: "profile",
		userIds: [...new Set(target.userIds)],
		applicationIds: [...new Set(target.applicationIds)],
		puuid: target.puuid,
		platform: target.platform,
		riotId: target.riotId,
		batchId,
		status: "queued",
		activeKey: `profile:${identityKey}`,
		attempts: 0,
		runAfter,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	try {
		await db.collection<RiotSyncJob>("riot_sync_queue").insertOne(job);
		return { job, created: true };
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
		const active = await db.collection<RiotSyncJob>("riot_sync_queue").findOne({ activeKey: job.activeKey });
		if (active) return { job: active, created: false };
		throw error;
	}
}

function parseRiotId(riotId: string) {
	const separator = riotId.lastIndexOf("#");
	if (separator <= 0 || separator === riotId.length - 1) return null;
	return { gameName: riotId.slice(0, separator).trim(), tagLine: riotId.slice(separator + 1).trim() };
}

async function syncRiotProfile(db: Db, job: RiotSyncJob) {
	let identity = job.puuid ? await getRiotIdentityByPuuid(job.puuid, job.platform || "euw1") : null;
	if (!identity && job.riotId) {
		const parsed = parseRiotId(job.riotId);
		if (parsed) identity = await resolveRiotIdentity(parsed.gameName, parsed.tagLine);
	}
	if (!identity) throw new Error("Riot profile could not be resolved.");

	const rank = await getRiotRank(identity.puuid, identity.platform);
	const currentRank = rank?.label || "Unranked";
	const riotId = `${identity.gameName}#${identity.tagLine}`;
	const userObjectIds = (job.userIds || []).filter(ObjectId.isValid).map((userId) => new ObjectId(userId));
	const userFilters: Record<string, unknown>[] = [{ riotPuuid: identity.puuid }];
	if (userObjectIds.length) userFilters.push({ _id: { $in: userObjectIds } });
	await db.collection("users").updateMany(
		{ $or: userFilters },
		{
			$set: {
				riotVerified: true,
				riotPuuid: identity.puuid,
				riotPlatform: identity.platform,
				riotSummonerName: identity.gameName,
				riotTagLine: identity.tagLine,
				riotRank: currentRank,
				riotRankUpdatedAt: new Date(),
				riotIdentityUpdatedAt: new Date(),
			},
		}
	);

	const applicationFilters: Record<string, unknown>[] = [{ riotPuuid: identity.puuid }];
	if (job.applicationIds?.length) applicationFilters.push({ id: { $in: job.applicationIds } });
	if (job.userIds?.length) applicationFilters.push({ userId: { $in: job.userIds } });
	const applications = await db.collection("tournament_applications").find({ $or: applicationFilters }).project({ id: 1 }).toArray();
	const applicationIds = applications.map((application) => String(application.id)).filter(Boolean);
	if (applicationIds.length) {
		await db
			.collection("tournament_applications")
			.updateMany({ id: { $in: applicationIds } }, { $set: { riotPuuid: identity.puuid, riotPlatform: identity.platform, riotId, currentRank, riotUpdatedAt: new Date() } });
		await Promise.all(
			applicationIds.map((applicationId) =>
				db
					.collection("tournament_teams")
					.updateMany(
						{ "members.applicationId": applicationId },
						{ $set: { "members.$[member].name": riotId } },
						{ arrayFilters: [{ "member.applicationId": applicationId }] }
					)
			)
		);
	}
	return { riotId, currentRank, applicationsUpdated: applicationIds.length };
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
		const result =
			job.type === "profile"
				? await syncRiotProfile(db, job)
				: await syncRiotChallengesForUser(db, String(job.userId || ""), String(job.puuid || ""), Number(job.maxMatches || 30));
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
