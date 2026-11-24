// Server roles for the staff role picker. The bot can only give out roles that sit below its own highest role.

export type GuildRoleOption = { id: string; name: string; color: number; position: number; assignable: boolean };

type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean };

function config() {
	const token = process.env.DISCORD_BOT_TOKEN?.trim();
	const guildId = process.env.DISCORD_GUILD_ID?.trim();
	return token && guildId ? { token, guildId } : null;
}

async function discordGet<T>(path: string, token: string): Promise<T> {
	const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
	if (!response.ok) throw new Error(`Discord ${path} antwortete mit ${response.status}.`);
	return (await response.json()) as T;
}

export function isRolePickerConfigured() {
	return Boolean(config());
}

export async function listGuildRoles(): Promise<GuildRoleOption[]> {
	const settings = config();
	if (!settings) return [];
	const [roles, bot] = await Promise.all([
		discordGet<DiscordRole[]>(`/guilds/${settings.guildId}/roles`, settings.token),
		discordGet<{ id: string }>("/users/@me", settings.token),
	]);
	const botMember = await discordGet<{ roles: string[] }>(`/guilds/${settings.guildId}/members/${bot.id}`, settings.token);
	const botTop = Math.max(0, ...roles.filter((role) => botMember.roles.includes(role.id)).map((role) => role.position));
	return roles
		.filter((role) => role.id !== settings.guildId && !role.managed)
		.sort((a, b) => b.position - a.position)
		.map((role) => ({ id: role.id, name: role.name, color: role.color, position: role.position, assignable: role.position < botTop }));
}

/** Creates a plain cosmetic role (no permissions) and returns its ID. */
export async function createGuildRole(name: string) {
	const settings = config();
	if (!settings) throw new Error("Der Discord-Bot ist nicht konfiguriert.");
	const response = await fetch(`https://discord.com/api/v10/guilds/${settings.guildId}/roles`, {
		method: "POST",
		headers: { Authorization: `Bot ${settings.token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ name, permissions: "0", color: 15418846, hoist: false, mentionable: false }),
	});
	const role = (await response.json().catch(() => null)) as { id?: string } | null;
	if (!response.ok || !role?.id) throw new Error("Die Discord-Rolle konnte nicht erstellt werden.");
	return role.id;
}
