export type TournamentStatus = "announcement" | "registration" | "live" | "completed";

export interface TournamentRecord {
	id: string;
	title: string;
	game: string;
	format: string;
	status: TournamentStatus;
	date: string | null;
	maxTeams: number;
	currentTeams: number;
	rules: string[];
	registrationOpen?: boolean;
}

// Public tournaments are created through the admin area and stored in MongoDB.
// Keep this fallback empty so retired placeholder events cannot leak back into production.
export const announcedTournaments: TournamentRecord[] = [];

export function isTournamentStatus(value: unknown): value is TournamentStatus {
	return value === "announcement" || value === "registration" || value === "live" || value === "completed";
}
