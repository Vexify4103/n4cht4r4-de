export type TournamentRegistrationState = "scheduled" | "open" | "closed" | "unavailable";

type RegistrationTournament = {
	[key: string]: unknown;
	status?: unknown;
	registrationOpen?: unknown;
	registrationOpensAt?: unknown;
	registrationClosesAt?: unknown;
};

function asDate(value: unknown) {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value !== "string" || !value.trim()) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function registrationWindowState(tournament: RegistrationTournament, now = new Date()): TournamentRegistrationState {
	if (tournament.status === "completed" || tournament.status === "live") return "unavailable";

	const opensAt = asDate(tournament.registrationOpensAt);
	const closesAt = asDate(tournament.registrationClosesAt);
	if (opensAt && closesAt && opensAt < closesAt) {
		if (now < opensAt) return "scheduled";
		if (now >= closesAt) return "closed";
		return "open";
	}

	return tournament.registrationOpen === true ? "open" : "closed";
}

export function registrationIsOpen(tournament: RegistrationTournament, now = new Date()) {
	return registrationWindowState(tournament, now) === "open";
}

export function parseRegistrationWindow(opensAtValue: unknown, closesAtValue: unknown, startsAtValue?: unknown) {
	const hasOpensAt = typeof opensAtValue === "string" && opensAtValue.trim().length > 0;
	const hasClosesAt = typeof closesAtValue === "string" && closesAtValue.trim().length > 0;
	if (hasOpensAt !== hasClosesAt) return { error: "Bitte trage Beginn und Ende der Bewerbungsphase ein oder lasse beide Felder frei." } as const;
	if (!hasOpensAt && !hasClosesAt) return { opensAt: null, closesAt: null } as const;

	const opensAt = asDate(opensAtValue);
	const closesAt = asDate(closesAtValue);
	if (!opensAt || !closesAt) return { error: "Die Zeitpunkte der Bewerbungsphase sind ungültig." } as const;
	if (opensAt >= closesAt) return { error: "Die Bewerbungsphase muss enden, nachdem sie begonnen hat." } as const;

	const startsAt = asDate(startsAtValue);
	if (startsAt && closesAt > startsAt) return { error: "Die Bewerbungsphase muss spätestens zum Turnierstart enden." } as const;

	return { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() } as const;
}
