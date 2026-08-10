import { ObjectId, type Db } from "mongodb";

export type PublicBadge = {
	id: string;
	name: string;
	description: string;
	icon: string;
	rarity: "common" | "rare" | "epic";
};

type BadgeGrant = {
	userId: string;
	challengeId: string;
	rewardKey: string;
	badge?: PublicBadge;
};

const IDENTITY_BADGE_ORDER = new Map([
	["identity-site-owner", 0],
	["identity-site-admin", 1],
]);

type ShowcaseUser = {
	_id: ObjectId | string;
	showcasedBadgeIds?: unknown[];
};

export async function getPublicBadgeShowcases(db: Db, userIds: string[]) {
	const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
	const result = new Map<string, PublicBadge[]>();
	if (!uniqueUserIds.length) return result;

	const userIdCandidates: (ObjectId | string)[] = [...uniqueUserIds, ...uniqueUserIds.filter(ObjectId.isValid).map((userId) => new ObjectId(userId))];
	const users = await db
		.collection<ShowcaseUser>("users")
		.find({ _id: { $in: userIdCandidates } })
		.project({ _id: 1, showcasedBadgeIds: 1 })
		.toArray();
	const showcaseByUser = new Map(
		users.map((user) => [
			String(user._id),
			Array.isArray(user.showcasedBadgeIds) ? user.showcasedBadgeIds.filter((id): id is string => typeof id === "string").slice(0, 3) : [],
		])
	);
	const grants = await db
		.collection<BadgeGrant>("challenge_reward_grants")
		.find({ userId: { $in: uniqueUserIds }, type: "badge", status: "granted" })
		.project({ _id: 0, userId: 1, challengeId: 1, rewardKey: 1, badge: 1 })
		.toArray();

	for (const userId of uniqueUserIds) {
		const userGrants = grants.filter((grant) => grant.userId === userId && grant.badge);
		const grantsByKey = new Map(userGrants.map((grant) => [grant.rewardKey, grant.badge as PublicBadge]));
		const identityBadges = userGrants
			.filter((grant) => IDENTITY_BADGE_ORDER.has(grant.challengeId))
			.sort((left, right) => (IDENTITY_BADGE_ORDER.get(left.challengeId) || 0) - (IDENTITY_BADGE_ORDER.get(right.challengeId) || 0))
			.map((grant) => grant.badge as PublicBadge);
		const selectedBadges = (showcaseByUser.get(userId) || []).map((badgeId) => grantsByKey.get(badgeId)).filter((badge): badge is PublicBadge => Boolean(badge));
		result.set(userId, [...new Map([...identityBadges, ...selectedBadges].map((badge) => [badge.id, badge])).values()]);
	}

	return result;
}
