import type { Db } from "mongodb";
import { ensureChallengeRewardIndexes, type ChallengeRewardGrant } from "@/lib/challenge-rewards";
import type { PublicBadge } from "@/lib/public-badges";
import { resolveTournamentStaffRole } from "@/lib/tournament-staff";
import { userIdCandidates } from "@/lib/tournament-community";

export const SITE_ADMIN_BADGE_ID = "gartenwache";
export const SITE_OWNER_BADGE_ID = "gartenherrin";
export const SITE_ADMIN_CHALLENGE_ID = "identity-site-admin";
export const SITE_OWNER_CHALLENGE_ID = "identity-site-owner";
export const N4CHT4R4_DISCORD_ID = "248841932913115136";

export const SITE_ADMIN_BADGE: PublicBadge = {
	id: SITE_ADMIN_BADGE_ID,
	name: "Gartenwache",
	description: "Gehört zum Team, das Nachtaras Community Garden behütet.",
	icon: "🛡️",
	rarity: "rare",
};

export const SITE_OWNER_BADGE: PublicBadge = {
	id: SITE_OWNER_BADGE_ID,
	name: "Gartenherrin",
	description: "N4cht4r4, Gastgeberin und Besitzerin dieses Community Gardens.",
	icon: "🌸",
	rarity: "epic",
};

async function setIdentityBadge(db: Db, userId: string, challengeId: string, badge: PublicBadge, enabled: boolean) {
	const grants = db.collection<ChallengeRewardGrant>("challenge_reward_grants");
	if (!enabled) {
		await grants.deleteMany({ userId, challengeId, type: "badge" });
		return;
	}
	const now = new Date();
	await grants.updateOne(
		{ userId, challengeId, type: "badge", rewardKey: badge.id },
		{
			$set: { label: badge.name, badge, status: "granted", updatedAt: now },
			$setOnInsert: {
				id: `reward_${crypto.randomUUID()}`,
				userId,
				challengeId,
				seasonId: "community-identity",
				type: "badge",
				rewardKey: badge.id,
				createdAt: now,
			},
		},
		{ upsert: true }
	);
}

export async function syncStaffBadgesForUser(db: Db, userId: string) {
	await ensureChallengeRewardIndexes(db);
	const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(userId) }, provider: "discord" });
	const discordId = typeof account?.providerAccountId === "string" ? account.providerAccountId : null;
	const role = await resolveTournamentStaffRole(db, userId, discordId);
	const isSiteOwner = discordId === N4CHT4R4_DISCORD_ID;
	const isStaff = Boolean(role);
	await Promise.all([
		setIdentityBadge(db, userId, SITE_ADMIN_CHALLENGE_ID, SITE_ADMIN_BADGE, isStaff),
		setIdentityBadge(db, userId, SITE_OWNER_CHALLENGE_ID, SITE_OWNER_BADGE, isSiteOwner),
	]);
	return { role, isSiteOwner, isStaff };
}
