import type { Db } from "mongodb";

export type ApplicationType = "tournaments" | "jobs" | "minecraft" | "game-team" | "appeal";
export type ApplicationDefinition = {
	label: string;
	labelEn: string;
	description: string;
	descriptionEn: string;
	requires: ("discord" | "riot")[];
	open: boolean;
};

export const defaultApplicationTypes: Record<ApplicationType, ApplicationDefinition> = {
	tournaments: {
		label: "Turniere",
		labelEn: "Tournaments",
		description: "Turnierbewerbungen werden direkt beim jeweiligen Event geöffnet.",
		descriptionEn: "Tournament applications open directly on the relevant event.",
		requires: ["discord", "riot"],
		open: false,
	},
	jobs: {
		label: "Community-Team",
		labelEn: "Community team",
		description: "Moderation, Discord-Team, Cutter und weitere Rollen rund um Nachtaras Content.",
		descriptionEn: "Moderation, Discord team, video editors, and other roles around Nachtara's content.",
		requires: ["discord"],
		open: true,
	},
	appeal: {
		label: "Entbannungsantrag",
		labelEn: "Ban appeal",
		description: "Du hältst einen Discord- oder Community-Bann für ungerecht? Erkläre uns in Ruhe, was passiert ist. Twitch-Banns werden ausschließlich über Twitch geprüft.",
		descriptionEn: "Think a Discord or community ban was unfair? Tell us what happened. Twitch bans are reviewed exclusively through Twitch.",
		requires: ["discord"],
		open: true,
	},
	minecraft: {
		label: "Minecraft SMP",
		labelEn: "Minecraft SMP",
		description: "Bewirb dich für eine aktive Nachtara-SMP-Welt.",
		descriptionEn: "Apply for an active Nachtara SMP world.",
		requires: ["discord"],
		open: false,
	},
	"game-team": {
		label: "League Flex-Team",
		labelEn: "League Flex team",
		description: "Feste Flex-Abende mit Nachtara und einem verlässlichen Team.",
		descriptionEn: "Regular Flex nights with Nachtara and a reliable team.",
		requires: ["discord", "riot"],
		open: false,
	},
};

export const applicationTypes = defaultApplicationTypes;

export function isApplicationType(value: string): value is ApplicationType {
	return Object.hasOwn(defaultApplicationTypes, value);
}

export async function getApplicationTypes(db: Db) {
	await db.collection("application_settings").updateOne({ type: "jobs" }, { $setOnInsert: { type: "jobs", open: true } }, { upsert: true });
	await db
		.collection("application_settings")
		.updateMany({ type: "jobs", launchActivation: { $ne: "2026-10-team-applications" } }, { $set: { open: true, launchActivation: "2026-10-team-applications" } });
	const settings = await db.collection("application_settings").find({}).toArray();
	const overrides = new Map(settings.map((setting) => [setting.type, setting]));
	return Object.fromEntries(
		Object.entries(defaultApplicationTypes).map(([type, definition]) => {
			const override = overrides.get(type);
			return [
				type,
				{
					...definition,
					...(typeof override?.label === "string" ? { label: override.label } : {}),
					...(typeof override?.description === "string" ? { description: override.description } : {}),
					...(typeof override?.open === "boolean" ? { open: override.open } : {}),
				},
			];
		})
	) as Record<ApplicationType, ApplicationDefinition>;
}
