import { Db } from "mongodb";
import { TournamentNotification, userIdCandidates } from "@/lib/tournament-community";

export type DiscordQueueJobType =
	| "team.create-role"
	| "team.create-text-channel"
	| "team.create-voice-channel"
	| "team.assign-member-role"
	| "team.remove-member-role"
	| "team.rename-role"
	| "team.rename-text-channel"
	| "team.rename-voice-channel"
	| "notification.send-dm";

export type DiscordQueueJob = {
	id: string;
	type: DiscordQueueJobType;
	tournamentId: string | null;
	teamId: string | null;
	payload: Record<string, unknown>;
	status: "queued" | "processing" | "completed" | "failed" | "skipped";
	attempts: number;
	runAfter: Date;
	lockedAt?: Date;
	lastError?: string;
	createdAt: Date;
	updatedAt: Date;
};

type DiscordConfig = {
	guildId: string;
	botToken: string;
	categoryId: string;
	memberRoleId: string | null;
};

type DiscordBotConfig = Pick<DiscordConfig, "botToken">;

class DiscordRequestError extends Error {
	constructor(
		message: string,
		readonly retryAfterMs?: number
	) {
		super(message);
	}
}

function getDiscordConfig(): DiscordConfig | null {
	const guildId = process.env.DISCORD_GUILD_ID?.trim();
	const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
	const categoryId = process.env.DISCORD_TOURNAMENT_CATEGORY_ID?.trim();
	if (!guildId || !botToken || !categoryId) return null;
	return { guildId, botToken, categoryId, memberRoleId: process.env.DISCORD_TOURNAMENT_MEMBER_ROLE_ID?.trim() || null };
}

function getDiscordBotConfig(): DiscordBotConfig | null {
	const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
	return botToken ? { botToken } : null;
}

function channelSlug(name: string, suffix: "chat" | "voice") {
	const clean =
		name
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 84) || "team";
	return `${clean}-${suffix}`.slice(0, 100);
}

async function discordRequest<T>(config: DiscordBotConfig, path: string, method: string, body?: Record<string, unknown>) {
	const response = await fetch(`https://discord.com/api/v10${path}`, {
		method,
		headers: {
			Authorization: `Bot ${config.botToken}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	}).catch(() => null);

	if (!response) throw new DiscordRequestError("Discord ist nicht erreichbar.");
	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string; retry_after?: number } | null;
		const retryAfterMs = response.status === 429 && payload?.retry_after ? Math.ceil(payload.retry_after * 1000) : undefined;
		throw new DiscordRequestError(payload?.message || `Discord API Fehler ${response.status}`, retryAfterMs);
	}
	return response.status === 204 ? null : (response.json() as Promise<T>);
}

export function isDiscordQueueConfigured() {
	return Boolean(getDiscordConfig());
}

export async function enqueueDiscordJob(
	db: Db,
	type: DiscordQueueJobType,
	tournamentId: string | null,
	teamId: string | null,
	payload: Record<string, unknown> = {},
	runAfter = new Date()
) {
	const job: DiscordQueueJob = {
		id: `discord_${crypto.randomUUID()}`,
		type,
		tournamentId,
		teamId,
		payload,
		status: "queued",
		attempts: 0,
		runAfter,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	await db.collection<DiscordQueueJob>("discord_queue").insertOne(job);
	return job;
}

export async function enqueueDiscordNotification(db: Db, notificationId: string, tournamentId: string | null) {
	if (!getDiscordBotConfig()) return null;
	return enqueueDiscordJob(db, "notification.send-dm", tournamentId, null, { notificationId });
}

export async function queueTeamProvisioning(db: Db, tournamentId: string, teamId: string) {
	if (!isDiscordQueueConfigured()) return null;
	return enqueueDiscordJob(db, "team.create-role", tournamentId, teamId);
}

export async function queueMemberRoleAssignment(db: Db, tournamentId: string, teamId: string, discordId: string) {
	if (!getDiscordConfig()) return null;
	return enqueueDiscordJob(db, "team.assign-member-role", tournamentId, teamId, { discordId });
}

export async function queueMemberRoleRemoval(db: Db, tournamentId: string, teamId: string, discordId: string) {
	if (!getDiscordConfig()) return null;
	return enqueueDiscordJob(db, "team.remove-member-role", tournamentId, teamId, { discordId });
}

export async function queueTeamRename(db: Db, tournamentId: string, teamId: string) {
	if (!isDiscordQueueConfigured()) return [];
	const now = Date.now();
	const renameInterval = 10 * 60 * 1000;
	return Promise.all([
		enqueueDiscordJob(db, "team.rename-role", tournamentId, teamId, {}, new Date(now)),
		enqueueDiscordJob(db, "team.rename-text-channel", tournamentId, teamId, {}, new Date(now + renameInterval)),
		enqueueDiscordJob(db, "team.rename-voice-channel", tournamentId, teamId, {}, new Date(now + renameInterval * 2)),
	]);
}

async function claimNextDiscordJob(db: Db) {
	const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
	await db
		.collection<DiscordQueueJob>("discord_queue")
		.updateMany(
			{ status: "processing", lockedAt: { $lt: staleBefore } },
			{ $set: { status: "queued", runAfter: new Date(), updatedAt: new Date() }, $unset: { lockedAt: "" } }
		);
	return db
		.collection<DiscordQueueJob>("discord_queue")
		.findOneAndUpdate(
			{ status: "queued", runAfter: { $lte: new Date() } },
			{ $set: { status: "processing", lockedAt: new Date(), updatedAt: new Date() } },
			{ sort: { runAfter: 1, createdAt: 1 }, returnDocument: "after" }
		);
}

async function processTeamJob(db: Db, job: DiscordQueueJob, config: DiscordConfig) {
	if (!job.teamId || !job.tournamentId) return "skipped" as const;
	const team = await db.collection("tournament_teams").findOne({ id: job.teamId, tournamentId: job.tournamentId });
	if (!team) return "skipped" as const;
	const discord = (team.discord || {}) as { roleId?: string; textChannelId?: string; voiceChannelId?: string };
	const members = Array.isArray(team.members) ? (team.members as { discordId?: string }[]) : [];

	if (job.type === "team.create-role") {
		if (discord.roleId) return "skipped" as const;
		const role = await discordRequest<{ id: string }>(config, `/guilds/${config.guildId}/roles`, "POST", { name: team.name, mentionable: false, hoist: false });
		if (!role?.id) throw new DiscordRequestError("Discord hat keine Teamrolle zurückgegeben.");
		await db.collection("tournament_teams").updateOne({ id: team.id }, { $set: { "discord.roleId": role.id, "discord.provisionedAt": new Date() } });
		await enqueueDiscordJob(db, "team.create-text-channel", job.tournamentId, job.teamId);
		await enqueueDiscordJob(db, "team.create-voice-channel", job.tournamentId, job.teamId);
		for (const member of members) if (member.discordId) await enqueueDiscordJob(db, "team.assign-member-role", job.tournamentId, job.teamId, { discordId: member.discordId });
		return "completed" as const;
	}

	if (!discord.roleId) throw new DiscordRequestError("Teamrolle wurde noch nicht erstellt.");
	if (job.type === "team.create-text-channel") {
		if (discord.textChannelId) return "skipped" as const;
		const channel = await discordRequest<{ id: string }>(config, `/guilds/${config.guildId}/channels`, "POST", {
			name: channelSlug(team.name as string, "chat"),
			type: 0,
			parent_id: config.categoryId,
			permission_overwrites: [
				{ id: config.guildId, type: 0, deny: "1024" },
				{ id: discord.roleId, type: 0, allow: "3072" },
			],
		});
		if (!channel?.id) throw new DiscordRequestError("Discord hat keinen Textkanal zurückgegeben.");
		await db.collection("tournament_teams").updateOne({ id: team.id }, { $set: { "discord.textChannelId": channel.id } });
		return "completed" as const;
	}

	if (job.type === "team.create-voice-channel") {
		if (discord.voiceChannelId) return "skipped" as const;
		const channel = await discordRequest<{ id: string }>(config, `/guilds/${config.guildId}/channels`, "POST", {
			name: channelSlug(team.name as string, "voice"),
			type: 2,
			parent_id: config.categoryId,
			permission_overwrites: [
				{ id: config.guildId, type: 0, deny: "1024" },
				{ id: discord.roleId, type: 0, allow: "1049600" },
			],
		});
		if (!channel?.id) throw new DiscordRequestError("Discord hat keinen Voice-Kanal zurückgegeben.");
		await db.collection("tournament_teams").updateOne({ id: team.id }, { $set: { "discord.voiceChannelId": channel.id } });
		return "completed" as const;
	}

	if (job.type === "team.assign-member-role" || job.type === "team.remove-member-role") {
		const discordId = typeof job.payload.discordId === "string" ? job.payload.discordId : "";
		if (!discordId) return "skipped" as const;
		if (job.type === "team.remove-member-role") {
			await discordRequest(config, `/guilds/${config.guildId}/members/${discordId}/roles/${discord.roleId}`, "DELETE");
		} else {
			await discordRequest(config, `/guilds/${config.guildId}/members/${discordId}/roles/${discord.roleId}`, "PUT");
			if (config.memberRoleId) await discordRequest(config, `/guilds/${config.guildId}/members/${discordId}/roles/${config.memberRoleId}`, "PUT");
		}
		return "completed" as const;
	}

	const target = job.type === "team.rename-role" ? discord.roleId : job.type === "team.rename-text-channel" ? discord.textChannelId : discord.voiceChannelId;
	if (!target) return "skipped" as const;
	const path = job.type === "team.rename-role" ? `/guilds/${config.guildId}/roles/${target}` : `/channels/${target}`;
	const name = job.type === "team.rename-role" ? (team.name as string) : channelSlug(team.name as string, job.type === "team.rename-text-channel" ? "chat" : "voice");
	await discordRequest(config, path, "PATCH", { name });
	return "completed" as const;
}

async function processNotificationJob(db: Db, job: DiscordQueueJob, config: DiscordBotConfig) {
	const notificationId = typeof job.payload.notificationId === "string" ? job.payload.notificationId : "";
	const notification = notificationId ? await db.collection<TournamentNotification>("tournament_notifications").findOne({ id: notificationId }) : null;
	if (!notification || notification.discordStatus !== "pending") return "skipped" as const;
	const application = notification.tournamentId
		? await db.collection("tournament_applications").findOne({ tournamentId: notification.tournamentId, userId: notification.userId })
		: null;
	if (notification.tournamentId && application?.discordDmOptIn !== true) {
		await db.collection<TournamentNotification>("tournament_notifications").updateOne({ id: notification.id }, { $set: { discordStatus: "disabled" } });
		return "skipped" as const;
	}
	let discordId = typeof application?.discordId === "string" ? application.discordId : "";
	if (!discordId) {
		const account = await db.collection("accounts").findOne({ userId: { $in: userIdCandidates(notification.userId) }, provider: "discord" });
		discordId = typeof account?.providerAccountId === "string" ? account.providerAccountId : "";
	}
	if (!discordId) {
		await db.collection<TournamentNotification>("tournament_notifications").updateOne({ id: notification.id }, { $set: { discordStatus: "disabled" } });
		return "skipped" as const;
	}
	const channel = await discordRequest<{ id: string }>(config, "/users/@me/channels", "POST", { recipient_id: discordId });
	if (!channel?.id) throw new DiscordRequestError("Discord hat keinen DM-Kanal zurückgegeben.");
	const origin = (process.env.NEXT_PUBLIC_APP_URL || "https://n4cht4r4.de").replace(/\/$/, "");
	await discordRequest(config, `/channels/${channel.id}/messages`, "POST", {
		content: `**${notification.title}**\n${notification.body}\n${origin}${notification.href}`,
		allowed_mentions: { parse: [] },
	});
	await db.collection<TournamentNotification>("tournament_notifications").updateOne({ id: notification.id }, { $set: { discordStatus: "sent" } });
	return "completed" as const;
}

export async function processNextDiscordQueueJob(db: Db) {
	const job = await claimNextDiscordJob(db);
	if (!job) return { processed: false, reason: "No due jobs." };

	try {
		const botConfig = getDiscordBotConfig();
		if (!botConfig) throw new DiscordRequestError("Discord Bot Token ist nicht konfiguriert.");
		let status;
		if (job.type === "notification.send-dm") status = await processNotificationJob(db, job, botConfig);
		else {
			const teamConfig = getDiscordConfig();
			if (!teamConfig) throw new DiscordRequestError("Discord Team-Kanäle sind nicht konfiguriert.");
			status = await processTeamJob(db, job, teamConfig);
		}
		await db.collection<DiscordQueueJob>("discord_queue").updateOne({ id: job.id }, { $set: { status, updatedAt: new Date() }, $unset: { lockedAt: "" } });
		return { processed: true, jobId: job.id, status };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unbekannter Discord Queue Fehler";
		const retryAfter = error instanceof DiscordRequestError && error.retryAfterMs ? error.retryAfterMs : Math.min(2 ** (job.attempts + 1) * 60_000, 60 * 60 * 1000);
		const attempts = job.attempts + 1;
		await db.collection<DiscordQueueJob>("discord_queue").updateOne(
			{ id: job.id },
			{
				$set: { status: attempts >= 5 ? "failed" : "queued", attempts, runAfter: new Date(Date.now() + retryAfter), lastError: message, updatedAt: new Date() },
				$unset: { lockedAt: "" },
			}
		);
		return { processed: true, jobId: job.id, status: attempts >= 5 ? "failed" : "requeued", error: message };
	}
}
