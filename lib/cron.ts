import { CronJob } from "cron";
import client from "@/lib/db";
import { enqueueRiotChallengeSync } from "@/lib/riot-sync-queue";
import { startWatchTimeTracker, stopWatchTimeTracker } from "@/lib/watchtime";
import { syncStreamElementsDonations } from "@/lib/streamelements";

let challengeJob: CronJob | null = null;
let donationJob: CronJob | null = null;

async function runChallengeUpdate() {
	if (!process.env.RIOT_API_KEY) return;

	try {
		await client.connect();
		const db = client.db();
		const users = await db
			.collection("users")
			.find({ riotPuuid: { $exists: true, $ne: null } })
			.toArray();
		let queued = 0;

		for (const user of users) {
			try {
				const result = await enqueueRiotChallengeSync(db, user._id.toString(), String(user.riotPuuid), 30);
				if (result.created) queued++;
			} catch (error) {
				console.error(`Scheduled Riot challenge sync failed for ${user._id}:`, error);
			}
		}

		console.log(`[Cron] Riot challenge jobs queued: ${queued}/${users.length} users`);
	} catch (error) {
		console.error("[Cron] Challenge update failed:", error);
	}
}

async function runDonationSync() {
	if (!process.env.STREAMELEMENTS_JWT) return;

	try {
		const result = await syncStreamElementsDonations();
		console.log(`[Cron] Donations synced: ${result.imported} imported, ${result.skipped} skipped`);
	} catch (error) {
		console.error("[Cron] Donation sync failed:", error);
	}
}

export function startChallengeCron() {
	if (challengeJob) return;

	challengeJob = new CronJob("*/15 * * * *", runChallengeUpdate, null, true, "Europe/Berlin");
	donationJob = new CronJob("0 * * * *", runDonationSync, null, true, "Europe/Berlin");
	void runChallengeUpdate();
	void runDonationSync();
	startWatchTimeTracker();
	console.log("[Cron] Challenge update job started (every 15 minutes)");
	console.log("[Cron] Donation sync job started (every hour)");
}

export function stopChallengeCron() {
	challengeJob?.stop();
	challengeJob = null;
	donationJob?.stop();
	donationJob = null;
	stopWatchTimeTracker();
}
