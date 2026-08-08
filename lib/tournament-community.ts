import { Db, ObjectId } from "mongodb";

export const ACTIVE_APPLICATION_STATUSES = ["pending", "accepted", "waitlisted"] as const;

export type TournamentWishGroup = {
	id: string;
	tournamentId: string;
	name: string;
	inviteCode: string;
	ownerUserId: string;
	memberUserIds: string[];
	createdAt: Date;
	updatedAt: Date;
};

export type TournamentNotification = {
	id: string;
	userId: string;
	tournamentId: string | null;
	type: string;
	title: string;
	body: string;
	href: string;
	readAt: Date | null;
	discordStatus: "pending" | "disabled" | "sent" | "failed";
	createdAt: Date;
};

let indexPromise: Promise<unknown> | null = null;

export function userIdCandidates(userId: string) {
	const candidates: unknown[] = [userId];
	if (ObjectId.isValid(userId)) candidates.push(new ObjectId(userId));
	return candidates;
}

export function wishGroupLimit(tournament: Record<string, unknown>) {
	if (tournament.wishGroupMode === "disabled") return 0;
	if (tournament.wishGroupMode === "duo") return 2;
	return typeof tournament.teamSize === "number" ? tournament.teamSize : 5;
}

export function createWishGroupCode() {
	return `WG-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function ensureTournamentCommunityIndexes(db: Db) {
	if (!indexPromise) {
		indexPromise = Promise.all([
			db.collection("tournament_wish_groups").createIndex({ inviteCode: 1 }, { unique: true }),
			db.collection("tournament_wish_groups").createIndex({ tournamentId: 1, memberUserIds: 1 }, { unique: true }),
			db.collection("tournament_notifications").createIndex({ userId: 1, createdAt: -1 }),
			db.collection("tournament_applications").createIndex({ tournamentId: 1, userId: 1 }),
		]).catch((error) => {
			indexPromise = null;
			throw error;
		});
	}
	await indexPromise;
}
