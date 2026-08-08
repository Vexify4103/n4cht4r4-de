import { registrationWindowState, TournamentRegistrationState } from "@/lib/tournament-registration";

export type TournamentStatus = "announcement" | "registration" | "live" | "completed";
export type TournamentConnection = "discord" | "riot";
export type TournamentApplicationMode = "solo" | "team";

export interface TournamentRecord {
	id: string;
	title: string;
	game: string;
	format: string;
	status: TournamentStatus;
	date: string | null;
	startsAt?: string | null;
	maxTeams: number | null;
	currentTeams: number;
	rules: string[];
	registrationOpen?: boolean;
	registrationOpensAt?: string | null;
	registrationClosesAt?: string | null;
	registrationState?: TournamentRegistrationState;
	description?: string;
	tagline?: string;
	registrationNote?: string;
	teamSize?: number;
	gameMode?: string;
	applicationModes?: TournamentApplicationMode[];
	wishGroupMode?: "disabled" | "duo" | "team";
	requiredConnections?: TournamentConnection[];
	collectRoles?: boolean;
	bracketType?: "single_elimination" | "double_elimination" | "groups";
	seriesBestOf?: number | null;
}

// Public tournaments are created through the admin area and stored in MongoDB.
// Keep this fallback empty so retired placeholder events cannot leak back into production.
export const announcedTournaments: TournamentRecord[] = [];

export function isTournamentStatus(value: unknown): value is TournamentStatus {
	return value === "announcement" || value === "registration" || value === "live" || value === "completed";
}

export function normalizeTournament(value: Record<string, unknown>): TournamentRecord | null {
	if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.game !== "string" || typeof value.format !== "string" || !isTournamentStatus(value.status))
		return null;

	const applicationModes = Array.isArray(value.applicationModes)
		? value.applicationModes.filter((mode): mode is TournamentApplicationMode => mode === "solo" || mode === "team")
		: undefined;
	const requiredConnections: TournamentConnection[] = ["discord", "riot"];

	const registrationState = registrationWindowState(value);

	return {
		id: value.id,
		title: value.title,
		game: value.game,
		format: value.format,
		status: value.status,
		date: typeof value.date === "string" ? value.date : null,
		startsAt: typeof value.startsAt === "string" ? value.startsAt : value.startsAt instanceof Date ? value.startsAt.toISOString() : null,
		maxTeams: typeof value.maxTeams === "number" ? value.maxTeams : null,
		currentTeams: typeof value.currentTeams === "number" ? value.currentTeams : 0,
		registrationOpen: registrationState === "open",
		registrationOpensAt:
			typeof value.registrationOpensAt === "string" ? value.registrationOpensAt : value.registrationOpensAt instanceof Date ? value.registrationOpensAt.toISOString() : null,
		registrationClosesAt:
			typeof value.registrationClosesAt === "string"
				? value.registrationClosesAt
				: value.registrationClosesAt instanceof Date
					? value.registrationClosesAt.toISOString()
					: null,
		registrationState,
		rules: Array.isArray(value.rules) ? value.rules.filter((rule): rule is string => typeof rule === "string") : [],
		...(typeof value.description === "string" ? { description: value.description } : {}),
		...(typeof value.tagline === "string" ? { tagline: value.tagline } : {}),
		...(typeof value.registrationNote === "string" ? { registrationNote: value.registrationNote } : {}),
		...(typeof value.teamSize === "number" ? { teamSize: value.teamSize } : {}),
		...(typeof value.gameMode === "string" ? { gameMode: value.gameMode } : {}),
		...(applicationModes?.length ? { applicationModes } : {}),
		...(value.wishGroupMode === "disabled" || value.wishGroupMode === "duo" || value.wishGroupMode === "team" ? { wishGroupMode: value.wishGroupMode } : {}),
		requiredConnections,
		...(typeof value.collectRoles === "boolean" ? { collectRoles: value.collectRoles } : {}),
		...(value.bracketType === "single_elimination" || value.bracketType === "double_elimination" || value.bracketType === "groups" ? { bracketType: value.bracketType } : {}),
		...(typeof value.seriesBestOf === "number" || value.seriesBestOf === null ? { seriesBestOf: value.seriesBestOf as number | null } : {}),
	};
}
