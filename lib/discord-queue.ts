import { Db } from "mongodb";
import { TournamentNotification, userIdCandidates } from "@/lib/tournament-community";
import { ChallengeRewardGrant } from "@/lib/challenge-rewards";
import { buildTournamentDmPayload } from "@/lib/discord-notification-payload";

export type DiscordQueueJobType =
	| "team.create-role"
	| "team.create-text-channel"
	| "team.create-voice-channel"
	| "team.assign-member-role"
	| "team.remove-member-role"
	| "team.rename-role"
	| "team.rename-text-channel"
	| "team.rename-voice-channel"
	| "notification.send-dm"
	| "reward.assign-role";

export type DiscordQueueJob = {
	id: string;
	type: DiscordQueueJobType;
	tournamentId: string | null;
	teamId: string | null;
	payload: Record<string, unknown>;
	status: "queued" | "processing" | "completed" | "failed" | "skipped";
	activeKey?: string;
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
type DiscordGuildConfig = DiscordBotConfig & { guildId: string };

let discordBlockedUntil = 0;
let queueIndexPromise: Promise<unknown> | null = null;

class DiscordRequestError extends Error {
	constructor(
		message: string,
		readonly retryAfterMs?: number,
		readonly retryable = true,
		readonly status?: number
	) {
		super(message);
	}
}

function getDiscordGuildConfig(): DiscordGuildConfig | null {
	const guildId = process.env.DISCORD_GUILD_ID?.trim();
	const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
	return guildId && botToken ? { guildId, botToken } : null;
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
	if (discordBlockedUntil > Date.now()) await new Promise((resolve) => setTimeout(resolve, discordBlockedUntil - Date.now()));
	const response = await fetch(`https://discord.com/api/v10${path}`, {
		method,
		headers: {
			Authorization: `Bot ${config.botToken}`,
			"Content-Type": "application/json",
			"User-Agent": "DiscordBot (https://n4cht4r4.de, 1.0)",
		},
		body: body ? JSON.stringify(body) : undefined,
	}).catch(() => null);

	if (!response) throw new DiscordRequestError("Discord ist nicht erreichbar.", undefined, true);
	const remaining = Number(response.headers.get("X-RateLimit-Remaining"));
	const resetAfterSeconds = Number(response.headers.get("X-RateLimit-Reset-After"));
	if (remaining === 0 && Number.isFinite(resetAfterSeconds)) discordBlockedUntil = Math.max(discordBlockedUntil, Date.now() + resetAfterSeconds * 1_000 + 100);
	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string; retry_after?: number } | null;
		const headerRetry = Number(response.headers.get("Retry-After"));
		const retryAfterMs = response.status === 429 ? Math.ceil((payload?.retry_after || (Number.isFinite(headerRetry) ? headerRetry : 1)) * 1_000) : undefined;
		if (retryAfterMs) discordBlockedUntil = Math.max(discordBlockedUntil, Date.now() + retryAfterMs);
		throw new DiscordRequestError(
			payload?.message || `Discord API Fehler ${response.status}`,
			retryAfterMs,
			response.status === 429 || response.status >= 500,
			response.status
		);
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
	if (!queueIndexPromise) {
		queueIndexPromise = db
			.collection<DiscordQueueJob>("discord_queue")
			.createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $exists: true } } })
			.catch((error) => {
				queueIndexPromise = null;
				throw error;
			});
	}
	await queueIndexPromise;
	const discriminator = String(payload.notificationId || payload.grantId || payload.discordId || "");
	const job: DiscordQueueJob = {
		id: `discord_${crypto.randomUUID()}`,
		type,
		tournamentId,
		teamId,
		payload,
		status: "queued",
		activeKey: [type, tournamentId || "-", teamId || "-", discriminator].join(":"),
		attempts: 0,
		runAfter,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	try {
		await db.collection<DiscordQueueJob>("discord_queue").insertOne(job);
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
		const active = await db.collection<DiscordQueueJob>("discord_queue").findOne({ activeKey: job.activeKey });
		if (active) return active;
		throw error;
	}
	return job;
}

export async function enqueueDiscordNotification(db: Db, notificationId: string, tournamentId: string | null) {
	if (!getDiscordBotConfig()) return null;
	return enqueueDiscordJob(db, "notification.send-dm", tournamentId, null, { notificationId });
}

export async function queueChallengeRoleGrant(db: Db, grantId: string, discordId: string, roleId: string) {
	if (!getDiscordGuildConfig()) return null;
	return enqueueDiscordJob(db, "reward.assign-role", null, null, { grantId, discordId, roleId });
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
	const tournament = notification.tournamentId ? await db.collection("tournaments").findOne({ id: notification.tournamentId }) : null;
	const team = notification.tournamentId
		? await db.collection("tournament_teams").findOne({
				tournamentId: notification.tournamentId,
				published: true,
				"publicMembers.userId": { $in: userIdCandidates(notification.userId) },
			})
		: null;
	const publicMembers = Array.isArray(team?.publicMembers) ? (team.publicMembers as { userId?: string; role?: string }[]) : [];
	const member = publicMembers.find((entry) => userIdCandidates(notification.userId).includes(String(entry.userId || "")));
	await discordRequest(
		config,
		`/channels/${channel.id}/messages`,
		"POST",
		buildTournamentDmPayload({
			title: notification.title,
			body: notification.body,
			href: notification.href,
			tournamentTitle: typeof tournament?.title === "string" ? tournament.title : undefined,
			tournamentFormat: typeof tournament?.format === "string" ? tournament.format : undefined,
			tournamentStartsAt: tournament?.startsAt instanceof Date || typeof tournament?.startsAt === "string" ? tournament.startsAt : null,
			teamName: typeof team?.publicName === "string" ? team.publicName : typeof team?.name === "string" ? team.name : undefined,
			role: member?.role,
			reminder: notification.type === "roster.reminder",
		}) as unknown as Record<string, unknown>
	);
	await db.collection<TournamentNotification>("tournament_notifications").updateOne({ id: notification.id }, { $set: { discordStatus: "sent" } });
	return "completed" as const;
}

async function processRewardRoleJob(db: Db, job: DiscordQueueJob, config: DiscordGuildConfig) {
	const grantId = typeof job.payload.grantId === "string" ? job.payload.grantId : "";
	const discordId = typeof job.payload.discordId === "string" ? job.payload.discordId : "";
	let roleId = typeof job.payload.roleId === "string" ? job.payload.roleId : "";
	const grant = grantId ? await db.collection<ChallengeRewardGrant>("challenge_reward_grants").findOne({ id: grantId }) : null;
	if (!grant || !discordId || !roleId) return "skipped" as const;
	if (grant.status === "granted") return "skipped" as const;
	if (roleId.startsWith("managed:")) {
		const registryKey = roleId.slice("managed:".length);
		const roleName = registryKey === "turnierkrone" ? "Turnierkrone" : grant.label;
		const registered = await db.collection("discord_role_registry").findOne({ key: registryKey });
		roleId = typeof registered?.roleId === "string" ? registered.roleId : "";
		if (!roleId) {
			const roles = await discordRequest<{ id: string; name: string }[]>(config, `/guilds/${config.guildId}/roles`, "GET");
			let role: { id: string; name: string } | null | undefined = roles?.find((entry) => entry.name === roleName);
			if (!role) {
				role = await discordRequest<{ id: string; name: string }>(config, `/guilds/${config.guildId}/roles`, "POST", {
					name: roleName,
					permissions: "0",
					color: 15418846,
					hoist: false,
					mentionable: false,
				});
			}
			if (!role?.id) throw new DiscordRequestError("Discord hat keine Gewinnerrolle zurückgegeben.");
			roleId = role.id;
			await db
				.collection("discord_role_registry")
				.updateOne(
					{ key: registryKey },
					{ $set: { key: registryKey, roleId, roleName, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
					{ upsert: true }
				);
		}
	}
	await discordRequest(config, `/guilds/${config.guildId}/members/${discordId}/roles/${roleId}`, "PUT");
	await db
		.collection<ChallengeRewardGrant>("challenge_reward_grants")
		.updateOne({ id: grant.id }, { $set: { status: "granted", discordRoleId: roleId, grantedAt: new Date(), updatedAt: new Date() } });
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
		else if (job.type === "reward.assign-role") {
			const guildConfig = getDiscordGuildConfig();
			if (!guildConfig) throw new DiscordRequestError("Discord Guild ist nicht konfiguriert.", undefined, false);
			status = await processRewardRoleJob(db, job, guildConfig);
		} else {
			const teamConfig = getDiscordConfig();
			if (!teamConfig) throw new DiscordRequestError("Discord Team-Kanäle sind nicht konfiguriert.");
			status = await processTeamJob(db, job, teamConfig);
		}
		await db.collection<DiscordQueueJob>("discord_queue").updateOne({ id: job.id }, { $set: { status, updatedAt: new Date() }, $unset: { lockedAt: "", activeKey: "" } });
		return { processed: true, jobId: job.id, status };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unbekannter Discord Queue Fehler";
		const retryAfter = error instanceof DiscordRequestError && error.retryAfterMs ? error.retryAfterMs : Math.min(2 ** (job.attempts + 1) * 60_000, 60 * 60 * 1000);
		const attempts = job.attempts + 1;
		const failed = attempts >= 5 || (error instanceof DiscordRequestError && !error.retryable);
		await db.collection<DiscordQueueJob>("discord_queue").updateOne(
			{ id: job.id },
			{
				$set: { status: failed ? "failed" : "queued", attempts, runAfter: new Date(Date.now() + retryAfter), lastError: message, updatedAt: new Date() },
				$unset: failed ? { lockedAt: "", activeKey: "" } : { lockedAt: "" },
			}
		);
		if (failed && job.type === "reward.assign-role" && typeof job.payload.grantId === "string") {
			await db
				.collection<ChallengeRewardGrant>("challenge_reward_grants")
				.updateOne({ id: job.payload.grantId }, { $set: { status: "failed", lastError: message, updatedAt: new Date() } });
		}
		if (failed && job.type === "notification.send-dm" && typeof job.payload.notificationId === "string") {
			await db.collection<TournamentNotification>("tournament_notifications").updateOne({ id: job.payload.notificationId }, { $set: { discordStatus: "failed" } });
		}
		return { processed: true, jobId: job.id, status: failed ? "failed" : "requeued", error: message };
	}
}
