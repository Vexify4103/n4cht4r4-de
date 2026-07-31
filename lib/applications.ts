import type { Db } from "mongodb";

export type ApplicationType = "tournaments" | "jobs" | "minecraft" | "game-team";
export type ApplicationDefinition = {
	label: string;
	description: string;
	requires: ("discord" | "riot")[];
	open: boolean;
};

export const defaultApplicationTypes: Record<ApplicationType, ApplicationDefinition> = {
	tournaments: {
		label: "Turniere",
		description: "Turnierbewerbungen werden direkt beim jeweiligen Event geöffnet.",
		requires: ["discord", "riot"],
		open: false,
	},
	jobs: {
		label: "Community-Team",
		description: "Moderation, Discord-Team, Cutter und weitere Rollen rund um Nachtaras Content.",
		requires: ["discord"],
		open: false,
	},
	minecraft: {
		label: "Minecraft SMP",
		description: "Bewirb dich für eine aktive Nachtara-SMP-Welt.",
		requires: ["discord"],
		open: false,
	},
	"game-team": {
		label: "League Flex-Team",
		description: "Feste Flex-Abende mit Nachtara und einem verlässlichen Team.",
		requires: ["discord", "riot"],
		open: false,
	},
};

export const applicationTypes = defaultApplicationTypes;

export function isApplicationType(value: string): value is ApplicationType {
	return value in defaultApplicationTypes;
}

export async function getApplicationTypes(db: Db) {
	const settings = await db.collection("application_settings").find({}).toArray();
	const overrides = new Map(settings.map((setting) => [setting.type, setting]));
	return Object.fromEntries(Object.entries(defaultApplicationTypes).map(([type, definition]) => {
		const override = overrides.get(type);
		return [type, {
			...definition,
			...(typeof override?.label === "string" ? { label: override.label } : {}),
			...(typeof override?.description === "string" ? { description: override.description } : {}),
			...(typeof override?.open === "boolean" ? { open: override.open } : {}),
		}];
	})) as Record<ApplicationType, ApplicationDefinition>;
}
