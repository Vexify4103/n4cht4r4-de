import type { Db } from "mongodb";
import type { ChallengeRewardGrant } from "@/lib/challenge-rewards";
import { cachedGuildMembership, isMembershipCheckConfigured, refreshGuildMembership } from "@/lib/discord-membership";
import { queueChallengeRoleGrant } from "@/lib/discord-queue";
import { userIdCandidates } from "@/lib/tournament-community";

// Role grants fail with "Unknown Member" when someone is not on the Discord server yet.
// This hourly pass checks those people again and re-queues their roles once they have joined.

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

async function discordIdForUser(db: Db, userId: string) {
	const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(userId) }, provider: "discord" });
	return typeof account?.providerAccountId === "string" ? account.providerAccountId : "";
}

export async function retryRolesForNewMembers(db: Db) {
	if (!isMembershipCheckConfigured()) return { checked: 0, rewards: 0, teamRoles: 0 };
	const since = new Date(Date.now() - LOOKBACK_MS);

	const failedGrants = await db
		.collection<ChallengeRewardGrant>("challenge_reward_grants")
		.find({ type: "discord_role", status: "failed", updatedAt: { $gte: since } })
		.toArray();
	const grantTargets: { grant: ChallengeRewardGrant; discordId: string }[] = [];
	for (const grant of failedGrants) {
		const discordId = await discordIdForUser(db, grant.userId);
		if (discordId && grant.discordRoleId) grantTargets.push({ grant, discordId });
	}

	// Team roles only matter while the tournament is still running.
	const failedTeamJobs = await db
		.collection("discord_queue")
		.find({ type: "team.assign-member-role", status: "failed", updatedAt: { $gte: since } })
		.project<{ id: string; tournamentId: string; payload?: { discordId?: string } }>({ _id: 0, id: 1, tournamentId: 1, payload: 1 })
		.toArray();
	const openTournamentIds = new Set(
		(
			await db
				.collection("tournaments")
				.find({ id: { $in: [...new Set(failedTeamJobs.map((job) => job.tournamentId))] }, status: { $ne: "completed" } })
				.project<{ id: string }>({ _id: 0, id: 1 })
				.toArray()
		).map((tournament) => tournament.id)
	);
	const failedProjectJobs = await db
		.collection("discord_queue")
		.find({ type: "project.assign-role", status: "failed", updatedAt: { $gte: since } })
		.project<{ id: string; tournamentId: string; payload?: { discordId?: string } }>({ _id: 0, id: 1, tournamentId: 1, payload: 1 })
		.toArray();
	const teamTargets = [...failedTeamJobs.filter((job) => openTournamentIds.has(job.tournamentId)), ...failedProjectJobs].filter((job) => job.payload?.discordId);

	const discordIds = [...new Set([...grantTargets.map((target) => target.discordId), ...teamTargets.map((job) => String(job.payload?.discordId))])];
	if (!discordIds.length) return { checked: 0, rewards: 0, teamRoles: 0 };
	await refreshGuildMembership(db, discordIds);
	const membership = await cachedGuildMembership(db, discordIds);
	const joined = (discordId: string) => membership.get(discordId)?.inGuild === true;

	let rewards = 0;
	for (const { grant, discordId } of grantTargets.filter((target) => joined(target.discordId))) {
		const reserved = await db
			.collection<ChallengeRewardGrant>("challenge_reward_grants")
			.updateOne({ id: grant.id, status: "failed" }, { $set: { status: "queued", updatedAt: new Date() }, $unset: { lastError: "", discordJobId: "" } });
		if (!reserved.modifiedCount) continue;
		const job = await queueChallengeRoleGrant(db, grant.id, discordId, grant.discordRoleId as string).catch(() => null);
		if (!job) {
			await db.collection<ChallengeRewardGrant>("challenge_reward_grants").updateOne({ id: grant.id, status: "queued" }, { $set: { status: "failed", updatedAt: new Date() } });
			continue;
		}
		await db.collection<ChallengeRewardGrant>("challenge_reward_grants").updateOne({ id: grant.id }, { $set: { discordJobId: job.id } });
		rewards++;
	}

	const teamJobIds = teamTargets.filter((job) => joined(String(job.payload?.discordId))).map((job) => job.id);
	const teamResult = teamJobIds.length
		? await db
				.collection("discord_queue")
				.updateMany({ id: { $in: teamJobIds }, status: "failed" }, { $set: { status: "queued", attempts: 0, runAfter: new Date(), updatedAt: new Date() } })
		: null;

	return { checked: discordIds.length, rewards, teamRoles: teamResult?.modifiedCount || 0 };
}
