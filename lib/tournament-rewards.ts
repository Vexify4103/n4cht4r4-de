import type { Db } from "mongodb";
import { getChallengeDefinitions } from "@/lib/challenges";
import { ChallengeRewardGrant, syncChallengeCompletion } from "@/lib/challenge-rewards";
import { queueChallengeRoleGrant } from "@/lib/discord-queue";
import type { TournamentMatch } from "@/lib/tournament-engine";
import { userIdCandidates } from "@/lib/tournament-community";

export const TOURNAMENT_APPLICATION_CHALLENGE_ID = "permanent-tournament-application";
export const TOURNAMENT_WINNER_CHALLENGE_ID = "permanent-tournament-winner";

async function completeMilestone(db: Db, userId: string, challengeId: string) {
	const challenge = (await getChallengeDefinitions(db, { activeOnly: false })).find((definition) => definition.id === challengeId);
	if (!challenge) throw new Error(`Challenge ${challengeId} ist nicht konfiguriert.`);
	const now = new Date();
	await db.collection("challenge_progress").updateOne(
		{ userId, challengeId },
		{
			$max: { progress: challenge.target },
			$set: { updatedAt: now },
			$setOnInsert: { userId, challengeId, createdAt: now },
		},
		{ upsert: true }
	);
	await syncChallengeCompletion(db, userId, challenge);
	return challenge;
}

async function queueWinnerRole(db: Db, userId: string) {
	const grant = await db.collection<ChallengeRewardGrant>("challenge_reward_grants").findOne({
		userId,
		challengeId: TOURNAMENT_WINNER_CHALLENGE_ID,
		type: "discord_role",
	});
	if (!grant?.discordRoleId || grant.status === "granted" || grant.status === "queued") return false;
	const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(userId) }, provider: "discord" });
	const discordId = typeof account?.providerAccountId === "string" ? account.providerAccountId : "";
	if (!discordId) return false;
	const reserved = await db
		.collection<ChallengeRewardGrant>("challenge_reward_grants")
		.updateOne({ id: grant.id, status: { $in: ["available", "failed"] } }, { $set: { status: "queued", updatedAt: new Date() }, $unset: { lastError: "", discordJobId: "" } });
	if (!reserved.modifiedCount) return false;
	const job = await queueChallengeRoleGrant(db, grant.id, discordId, grant.discordRoleId);
	if (!job) {
		await db
			.collection<ChallengeRewardGrant>("challenge_reward_grants")
			.updateOne({ id: grant.id, status: "queued" }, { $set: { status: "available", updatedAt: new Date() } });
		return false;
	}
	await db.collection<ChallengeRewardGrant>("challenge_reward_grants").updateOne({ id: grant.id }, { $set: { discordJobId: job.id, updatedAt: new Date() } });
	return true;
}

export async function grantTournamentApplicationReward(db: Db, userId: string) {
	await completeMilestone(db, userId, TOURNAMENT_APPLICATION_CHALLENGE_ID);
}

export async function resolveTournamentChampionTeamId(db: Db, tournamentId: string) {
	const matches = await db.collection<TournamentMatch>("tournament_matches").find({ tournamentId, stage: "playoff" }).toArray();
	const completedReset = matches.find((match) => match.matchType === "bracket_reset" && match.status === "completed" && match.winnerTeamId);
	if (completedReset?.winnerTeamId) return completedReset.winnerTeamId;
	const grandFinal = matches.find((match) => match.matchType === "grand_final" && match.status === "completed" && match.winnerTeamId);
	if (grandFinal?.winnerTeamId) return grandFinal.winnerTeamId;
	const singleFinal = matches
		.filter((match) => match.status === "completed" && match.winnerTeamId && match.placement !== "third_place" && match.bracket !== "lower")
		.sort((a, b) => b.round - a.round || a.position - b.position)[0];
	return singleFinal?.winnerTeamId || null;
}

export async function grantTournamentWinnerRewards(db: Db, tournamentId: string, championTeamId: string) {
	const team = await db.collection("tournament_teams").findOne({ id: championTeamId, tournamentId });
	if (!team) return { userIds: [], roleJobsQueued: 0 };
	const members = Array.isArray(team.publicMembers) ? team.publicMembers : Array.isArray(team.members) ? team.members : [];
	const applications = await db.collection("tournament_applications").find({ tournamentId, teamId: championTeamId }).project({ userId: 1 }).toArray();
	const userIds = [
		...new Set(
			[
				...members.map((member: Record<string, unknown>) => (typeof member.userId === "string" ? member.userId : "")),
				...applications.map((application) => (typeof application.userId === "string" ? application.userId : "")),
			].filter(Boolean)
		),
	];
	let roleJobsQueued = 0;
	for (const userId of userIds) {
		await completeMilestone(db, userId, TOURNAMENT_WINNER_CHALLENGE_ID);
		if (await queueWinnerRole(db, userId)) roleJobsQueued += 1;
	}
	await db
		.collection("tournaments")
		.updateOne({ id: tournamentId }, { $set: { championTeamId, winnerRewardsGrantedAt: new Date(), winnerRewardUserIds: userIds, updatedAt: new Date() } });
	return { userIds, roleJobsQueued };
}

export async function syncPermanentTournamentMilestonesForUser(db: Db, userId: string) {
	const hasApplication = await db.collection("tournament_applications").findOne({ userId }, { projection: { _id: 1 } });
	if (hasApplication) await grantTournamentApplicationReward(db, userId);
	const teams = await db
		.collection("tournament_teams")
		.find({ $or: [{ "publicMembers.userId": userId }, { "members.userId": userId }] })
		.project({ id: 1 })
		.toArray();
	if (!teams.length) return;
	const winningTournament = await db.collection("tournaments").findOne({ status: "completed", championTeamId: { $in: teams.map((team) => team.id) } }, { projection: { id: 1 } });
	if (winningTournament) {
		await completeMilestone(db, userId, TOURNAMENT_WINNER_CHALLENGE_ID);
		await queueWinnerRole(db, userId);
	}
}
