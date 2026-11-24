import type { Db } from "mongodb";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/tournament-community";

// Whether tournament players are on the N4cht4r4 Discord server. Bots can only DM people who share a
// server with them, and team roles/channels only work for members, so staff need to see who is missing.

export type MembershipEntry = { discordId: string; inGuild: boolean | null; checkedAt: Date | null };
export type DeliveryStatus = {
	applicationId: string;
	userId: string;
	discordId: string | null;
	inGuild: boolean | null;
	checkedAt: string | null;
	dmOptIn: boolean;
	dm: "sent" | "failed" | "disabled" | "pending" | null;
	role: "completed" | "failed" | "queued" | "processing" | null;
};

const COLLECTION = "discord_guild_members";

export function isMembershipCheckConfigured() {
	return Boolean(process.env.DISCORD_BOT_TOKEN?.trim() && process.env.DISCORD_GUILD_ID?.trim());
}

/** Asks Discord for each ID (one request each, honouring rate limits) and caches the answer. */
export async function refreshGuildMembership(db: Db, discordIds: string[]) {
	const token = process.env.DISCORD_BOT_TOKEN?.trim();
	const guildId = process.env.DISCORD_GUILD_ID?.trim();
	if (!token || !guildId) return;
	for (const discordId of [...new Set(discordIds.filter((id) => /^\d{15,22}$/.test(id)))]) {
		let inGuild: boolean | null = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: `Bot ${token}` } });
			if (response.status === 429) {
				const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
				await new Promise((resolve) => setTimeout(resolve, Math.ceil((body.retry_after ?? 1) * 1000) + 100));
				continue;
			}
			inGuild = response.ok ? true : response.status === 404 ? false : null;
			break;
		}
		if (inGuild === null) continue;
		await db.collection(COLLECTION).updateOne({ discordId }, { $set: { discordId, inGuild, checkedAt: new Date() } }, { upsert: true });
	}
}

export async function cachedGuildMembership(db: Db, discordIds: string[]) {
	const rows = await db
		.collection(COLLECTION)
		.find({ discordId: { $in: discordIds } })
		.project<MembershipEntry>({ _id: 0 })
		.toArray();
	return new Map(rows.map((row) => [row.discordId, row]));
}

/** Membership plus the last DM and team-role result for every active applicant of a tournament. */
export async function tournamentDeliveryStatus(db: Db, tournamentId: string): Promise<DeliveryStatus[]> {
	const applications = await db
		.collection("tournament_applications")
		.find({ tournamentId, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } })
		.project({ _id: 0, id: 1, userId: 1, discordId: 1, discordDmOptIn: 1 })
		.toArray();
	const discordIds = applications.map((application) => String(application.discordId || "")).filter(Boolean);
	const [membership, notifications, roleJobs] = await Promise.all([
		cachedGuildMembership(db, discordIds),
		db
			.collection("tournament_notifications")
			// Only roster notices count as "the team DM"; a later reschedule notice must not hide a failed one.
			.find({
				tournamentId,
				type: { $ne: "tournament.rescheduled" },
				userId: { $in: applications.map((application) => String(application.userId)) },
			})
			.project({ _id: 0, userId: 1, discordStatus: 1, createdAt: 1 })
			.sort({ createdAt: 1 })
			.toArray(),
		db
			.collection("discord_queue")
			.find({ tournamentId, type: "team.assign-member-role", "payload.discordId": { $in: discordIds } })
			.project({ _id: 0, status: 1, payload: 1, createdAt: 1 })
			.sort({ createdAt: 1 })
			.toArray(),
	]);
	// Later entries overwrite earlier ones, so each map holds the latest result.
	const lastDm = new Map(notifications.map((notification) => [String(notification.userId), notification.discordStatus as DeliveryStatus["dm"]]));
	const lastRole = new Map(roleJobs.map((job) => [String(job.payload?.discordId), job.status as DeliveryStatus["role"]]));
	return applications.map((application) => {
		const discordId = application.discordId ? String(application.discordId) : null;
		const member = discordId ? membership.get(discordId) : undefined;
		return {
			applicationId: String(application.id),
			userId: String(application.userId),
			discordId,
			inGuild: member?.inGuild ?? null,
			checkedAt: member?.checkedAt ? new Date(member.checkedAt).toISOString() : null,
			dmOptIn: application.discordDmOptIn === true,
			dm: lastDm.get(String(application.userId)) ?? null,
			role: lastRole.get(discordId || "") ?? null,
		};
	});
}
