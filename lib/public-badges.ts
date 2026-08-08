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
	rewardKey: string;
	badge?: PublicBadge;
};

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
		.project({ _id: 0, userId: 1, rewardKey: 1, badge: 1 })
		.toArray();

	for (const userId of uniqueUserIds) {
		const grantsByKey = new Map(grants.filter((grant) => grant.userId === userId && grant.badge).map((grant) => [grant.rewardKey, grant.badge as PublicBadge]));
		result.set(
			userId,
			(showcaseByUser.get(userId) || []).map((badgeId) => grantsByKey.get(badgeId)).filter((badge): badge is PublicBadge => Boolean(badge))
		);
	}

	return result;
}
