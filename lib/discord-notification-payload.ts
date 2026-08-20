type EmbedField = {
	name: string;
	value: string;
	inline?: boolean;
};

export type DiscordNotificationPayload = {
	content: string;
	embeds: Array<{
		author: { name: string; icon_url: string };
		title: string;
		description: string;
		color: number;
		fields: EmbedField[];
		footer: { text: string; icon_url: string };
		timestamp: string;
	}>;
	components: Array<{
		type: 1;
		components: Array<{ type: 2; style: 5; label: string; url: string }>;
	}>;
	allowed_mentions: { parse: string[] };
};

type TournamentDmInput = {
	title: string;
	body: string;
	href: string;
	tournamentTitle?: string;
	tournamentFormat?: string;
	tournamentStartsAt?: Date | string | null;
	teamName?: string;
	role?: string;
	reminder?: boolean;
	now?: Date;
};

function truncate(value: string, limit: number) {
	const clean = value.trim();
	return clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function siteOrigin() {
	const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://n4cht4r4.de";
	try {
		const parsed = new URL(configured);
		if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.origin;
	} catch {
		// Fall back to the public production origin when configuration is malformed.
	}
	return "https://n4cht4r4.de";
}

function absoluteSiteUrl(path: string) {
	const origin = siteOrigin();
	try {
		const url = new URL(path, `${origin}/`);
		return url.origin === origin ? url.toString() : `${origin}/me`;
	} catch {
		return `${origin}/me`;
	}
}

function formatStart(value?: Date | string | null) {
	if (!value) return "Im Turnierhub ansehen";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Im Turnierhub ansehen";
	return new Intl.DateTimeFormat("de-DE", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Europe/Berlin",
	}).format(date);
}

export function buildTournamentDmPayload(input: TournamentDmInput): DiscordNotificationPayload {
	const origin = siteOrigin();
	const iconUrl = `${origin}/favicon.png`;
	const fields: EmbedField[] = [];
	if (input.tournamentTitle) fields.push({ name: "TURNIER", value: truncate(input.tournamentTitle, 256), inline: true });
	if (input.teamName) fields.push({ name: "DEIN TEAM", value: truncate(input.teamName, 256), inline: true });
	if (input.role) fields.push({ name: "DEIN PLATZ", value: truncate(input.role, 256), inline: true });
	if (input.tournamentStartsAt) fields.push({ name: "START", value: formatStart(input.tournamentStartsAt), inline: true });
	if (input.tournamentFormat) fields.push({ name: "FORMAT", value: truncate(input.tournamentFormat, 256), inline: true });

	return {
		content: input.reminder ? "Eine kleine Erinnerung aus Nachtaras Turniergarten." : "Post aus Nachtaras Turniergarten.",
		embeds: [
			{
				author: { name: "N4CHT4R4 · TURNIERPOST", icon_url: iconUrl },
				title: truncate(input.title, 256),
				description: truncate(input.body, 4096),
				color: 15490222,
				fields,
				footer: { text: "N4cht4r4 Community · Viel Spaß und Fairplay", icon_url: iconUrl },
				timestamp: (input.now || new Date()).toISOString(),
			},
		],
		components: [
			{
				type: 1,
				components: [
					{ type: 2, style: 5, label: "Teamübersicht", url: absoluteSiteUrl(input.href) },
					{ type: 2, style: 5, label: "Mein Profil", url: `${origin}/me` },
				],
			},
		],
		allowed_mentions: { parse: [] },
	};
}
