import { loadEnvConfig } from "@next/env";

async function main() {
	loadEnvConfig(process.cwd());
	const [{ default: client }, { getPublicBadgeShowcases }, staffBadges] = await Promise.all([import("../lib/db"), import("../lib/public-badges"), import("../lib/staff-badges")]);
	const { N4CHT4R4_DISCORD_ID, SITE_ADMIN_CHALLENGE_ID, SITE_OWNER_CHALLENGE_ID, syncStaffBadgesForUser } = staffBadges;
	await client.connect();
	try {
		const db = client.db();
		const accounts = await db.collection("accounts").find({ provider: "discord" }).project({ userId: 1 }).toArray();
		const userIds = [...new Set(accounts.map((account) => String(account.userId)))];

		for (const userId of userIds) await syncStaffBadgesForUser(db, userId);

		const [staffBadgeCount, ownerBadges] = await Promise.all([
			db.collection("challenge_reward_grants").countDocuments({ challengeId: SITE_ADMIN_CHALLENGE_ID, status: "granted" }),
			db.collection("challenge_reward_grants").countDocuments({ challengeId: SITE_OWNER_CHALLENGE_ID, status: "granted" }),
		]);
		const showcases = await getPublicBadgeShowcases(db, userIds);
		const publicIdentityBadges = [...showcases.values()].flat().filter((badge) => badge.id === "gartenwache" || badge.id === "gartenherrin").length;
		const ownerAccount = await db.collection("accounts").findOne({ provider: "discord", providerAccountId: N4CHT4R4_DISCORD_ID });
		const ownerProfilePath = ownerAccount ? `/community/members/${String(ownerAccount.userId)}` : null;
		console.log(JSON.stringify({ accountsChecked: userIds.length, staffBadges: staffBadgeCount, ownerBadges, publicIdentityBadges, ownerProfilePath }));
	} finally {
		await client.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
