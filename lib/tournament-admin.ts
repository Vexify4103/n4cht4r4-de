import { auth } from "@/auth";
import client from "@/lib/db";
import { ObjectId } from "mongodb";

export type TournamentStaffRole = "owner" | "tournament_admin" | "referee" | "viewer";

export type TournamentAdminContext = {
	userId: string;
	discordId: string | null;
	role: TournamentStaffRole;
};

const roleRank: Record<TournamentStaffRole, number> = {
	viewer: 1,
	referee: 2,
	tournament_admin: 3,
	owner: 4,
};

function configuredIds(name: string) {
	return new Set((process.env[name] || "").split(",").map((value) => value.trim()).filter(Boolean));
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

export async function getTournamentAdminContext(): Promise<TournamentAdminContext | null> {
	const session = await auth();
	if (!session?.user?.id || !ObjectId.isValid(session.user.id)) return null;

	await client.connect();
	const db = client.db();
	const userId = session.user.id;
	const userObjectId = new ObjectId(userId);
	const discordAccount = await db.collection("accounts").findOne({ userId: userObjectId, provider: "discord" });
	const discordId = typeof discordAccount?.providerAccountId === "string" ? discordAccount.providerAccountId : null;
	const ownerIds = configuredIds("TOURNAMENT_OWNER_DISCORD_IDS");

	if (discordId && ownerIds.has(discordId)) {
		return { userId, discordId, role: "owner" };
	}

	const storedRole = await db.collection("tournament_staff").findOne({ $or: [{ userId }, ...(discordId ? [{ discordId }] : [])], active: { $ne: false } });
	if (storedRole && typeof storedRole.role === "string" && storedRole.role in roleRank) {
		return { userId, discordId, role: storedRole.role as TournamentStaffRole };
	}

	if (discordId && await memberHasConfiguredDiscordRole(discordId)) {
		return { userId, discordId, role: "tournament_admin" };
	}

	return null;
}

export async function hasTournamentPermission(minimumRole: TournamentStaffRole = "viewer") {
	const context = await getTournamentAdminContext();
	return context && roleRank[context.role] >= roleRank[minimumRole] ? context : null;
}
