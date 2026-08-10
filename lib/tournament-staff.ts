import type { Db } from "mongodb";

export type TournamentStaffRole = "owner" | "tournament_admin" | "referee" | "viewer";

export const tournamentRoleRank: Record<TournamentStaffRole, number> = {
	viewer: 1,
	referee: 2,
	tournament_admin: 3,
	owner: 4,
};

function configuredIds(name: string) {
	return new Set(
		(process.env[name] || "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean)
	);
}

async function memberHasConfiguredDiscordRole(discordId: string) {
	const guildId = process.env.DISCORD_GUILD_ID;
	const token = process.env.DISCORD_BOT_TOKEN;
	const allowedRoleIds = configuredIds("TOURNAMENT_ADMIN_ROLE_IDS");
	if (!guildId || !token || allowedRoleIds.size === 0) return false;

	const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
		headers: { Authorization: `Bot ${token}` },
	}).catch(() => null);
	if (!response?.ok) return false;

	const member = await response.json();
	return Array.isArray(member.roles) && member.roles.some((roleId: string) => allowedRoleIds.has(roleId));
}

export async function resolveTournamentStaffRole(db: Db, userId: string, discordId: string | null): Promise<TournamentStaffRole | null> {
	const ownerIds = configuredIds("TOURNAMENT_OWNER_DISCORD_IDS");
	if (discordId && ownerIds.has(discordId)) return "owner";

	const storedRole = await db.collection("tournament_staff").findOne({ $or: [{ userId }, ...(discordId ? [{ discordId }] : [])], active: { $ne: false } });
	if (storedRole && typeof storedRole.role === "string" && storedRole.role in tournamentRoleRank) return storedRole.role as TournamentStaffRole;
	if (discordId && (await memberHasConfiguredDiscordRole(discordId))) return "tournament_admin";
	return null;
}
