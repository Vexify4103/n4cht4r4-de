import { CronJob } from "cron";
import client from "@/lib/db";
import { syncRiotChallengesForUser } from "@/lib/riot-challenge-sync";
import { startWatchTimeTracker } from "@/lib/watchtime";

let jobsStarted = false;

async function runChallengeUpdate() {
	if (!process.env.RIOT_API_KEY) return;

	try {
		await client.connect();
		const db = client.db();
		const users = await db.collection("users").find({ riotPuuid: { $exists: true, $ne: null } }).toArray();
		let updated = 0;

		for (const user of users) {
			try {
				const result = await syncRiotChallengesForUser(db, user._id.toString(), user.riotPuuid, 30);
				if (result.matchesChecked > 0) updated++;
			} catch (error) {
				console.error(`Scheduled Riot challenge sync failed for ${user._id}:`, error);
			}
		}

		console.log(`[Cron] Challenges updated: ${updated}/${users.length} users`);
	} catch (error) {
		console.error("[Cron] Challenge update failed:", error);
	}
}

export function startChallengeCron() {
	if (jobsStarted) return;
	jobsStarted = true;

	new CronJob("0 * * * *", runChallengeUpdate, null, true, "Europe/Berlin");
	startWatchTimeTracker();
	console.log("[Cron] Challenge update job started (hourly)");
}
