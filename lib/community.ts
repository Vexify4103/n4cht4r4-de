import type { Db } from "mongodb";

export type CommunityProjectStatus = "online" | "planning" | "paused" | "ended";
export type CommunityPostKind = "message" | "fanart";
export type CommunityPostStatus = "pending" | "published" | "rejected";

export type CommunityProject = {
	id: string;
	title: string;
	game: string;
	summary: string;
	details: string;
	status: CommunityProjectStatus;
	statusLabel: string;
	imageUrl: string;
	applicationHref: string | null;
	rules: string[];
	order: number;
	published: boolean;
};

export const defaultCommunityProjects: CommunityProject[] = [
	{
		id: "nachtara-smp",
		title: "Nachtara SMP",
		game: "Minecraft",
		summary: "Eine gemeinsame Survival-Welt für langfristige Builds, kleine Geschichten und entspannte Community-Abende.",
		details: "Wenn eine neue Saison startet, erscheinen hier Version, Modpack, Whitelist-Infos, Termine und die passende Bewerbung.",
		status: "paused",
		statusLabel: "Zwischen den Saisons",
		imageUrl: "/images/community-minecraft-v1.png",
		applicationHref: "/bewerbungen/minecraft",
		rules: ["Respektvoll miteinander spielen", "Kein Griefing oder Diebstahl", "Keine Cheats, X-Ray oder Exploits", "Große Farmen und Projekte vorher abstimmen"],
		order: 10,
		published: true,
	},
	{
		id: "palworld-community-server",
		title: "Palworld Community Server",
		game: "Palworld",
		summary: "Gemeinsam erkunden, Basen bauen und einen Server gestalten, auf dem Fortschritt und gemütliches Zusammenspielen zusammenpassen.",
		details: "Serverregeln, Starttermin, Einstellungen und Zugangsdaten werden veröffentlicht, sobald die nächste Runde feststeht.",
		status: "planning",
		statusLabel: "In Vorbereitung",
		imageUrl: "/images/community-palworld-v1.png",
		applicationHref: null,
		rules: ["Gemeinsame Ressourcen fair nutzen", "Basen anderer respektieren", "Keine Exploits oder absichtliche Serverbelastung", "Absprachen im Discord beachten"],
		order: 20,
		published: true,
	},
];

export async function ensureCommunityIndexes(db: Db) {
	await Promise.all([
		db.collection("community_posts").createIndex({ id: 1 }, { unique: true }),
		db.collection("community_posts").createIndex({ status: 1, createdAt: -1 }),
		db.collection("community_posts").createIndex({ userId: 1, createdAt: -1 }),
		db.collection("community_projects").createIndex({ id: 1 }, { unique: true }),
		db.collection("community_projects").createIndex({ published: 1, order: 1 }),
		db.collection("community_audit_log").createIndex({ createdAt: -1 }),
	]);
}

export async function seedDefaultCommunityProjects(db: Db) {
	const now = new Date();
	await Promise.all(
		defaultCommunityProjects.map((project) =>
			db.collection("community_projects").updateOne({ id: project.id }, { $setOnInsert: { ...project, createdAt: now, updatedAt: now } }, { upsert: true })
		)
	);
}

export function cleanCommunityProject(value: Record<string, unknown>, fallbackId?: string): CommunityProject | null {
	const id = String(value.id || fallbackId || "")
		.trim()
		.slice(0, 80);
	const title = String(value.title || "")
		.trim()
		.slice(0, 100);
	const game = String(value.game || "")
		.trim()
		.slice(0, 80);
	const summary = String(value.summary || "")
		.trim()
		.slice(0, 300);
	if (!id || !title || !game || !summary) return null;
	const status = ["online", "planning", "paused", "ended"].includes(String(value.status)) ? (value.status as CommunityProjectStatus) : "planning";
	const rawImageUrl = String(value.imageUrl || "")
		.trim()
		.slice(0, 300);
	const rawApplicationHref = value.applicationHref ? String(value.applicationHref).trim().slice(0, 300) : "";
	return {
		id,
		title,
		game,
		summary,
		details: String(value.details || "")
			.trim()
			.slice(0, 1_500),
		status,
		statusLabel: String(value.statusLabel || "In Vorbereitung")
			.trim()
			.slice(0, 80),
		imageUrl: rawImageUrl.startsWith("/") && !rawImageUrl.startsWith("//") ? rawImageUrl : "",
		applicationHref:
			rawApplicationHref.startsWith("/") && !rawApplicationHref.startsWith("//") ? rawApplicationHref : rawApplicationHref.startsWith("https://") ? rawApplicationHref : null,
		rules: Array.isArray(value.rules)
			? value.rules
					.filter((rule): rule is string => typeof rule === "string")
					.map((rule) => rule.trim())
					.filter(Boolean)
					.slice(0, 20)
			: [],
		order: Number.isFinite(Number(value.order)) ? Math.max(0, Math.min(10_000, Number(value.order))) : 100,
		published: value.published !== false,
	};
}

export function detectCommunityImageMime(buffer: Buffer) {
	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
	if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
	if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
	if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
	return null;
}

export async function recordCommunityAudit(db: Db, actor: { userId: string; discordId: string | null; role: string }, action: string, details: Record<string, unknown> = {}) {
	await db.collection("community_audit_log").insertOne({
		actorUserId: actor.userId,
		actorDiscordId: actor.discordId,
		actorRole: actor.role,
		action,
		details,
		createdAt: new Date(),
	});
}
