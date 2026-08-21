"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
	ArrowLeft,
	ArrowDown,
	ArrowUp,
	BellRing,
	CalendarClock,
	Check,
	ClipboardList,
	Clock3,
	Crown,
	Flower2,
	Globe2,
	LockKeyhole,
	Pencil,
	Plus,
	Save,
	Search,
	Send,
	Settings,
	ShieldAlert,
	Shuffle,
	Swords,
	UserMinus,
	UserPlus,
	Users,
	UsersRound,
	X,
} from "lucide-react";
import { averageLeagueRank, leagueRankScore } from "@/lib/rank";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	});
type Tab = "teams" | "applications" | "matches" | "settings";
type Tournament = {
	id: string;
	title: string;
	format: string;
	maxTeams: number | null;
	seriesBestOf?: number | null;
	status?: string;
	registrationOpen?: boolean;
	registrationOpensAt?: string | null;
	registrationClosesAt?: string | null;
	registrationState?: "scheduled" | "open" | "closed" | "unavailable";
	registrationNote?: string;
	startsAt?: string | null;
	published?: boolean;
	bracketType?: "single_elimination" | "double_elimination" | "groups";
	teamSize?: number;
	collectRoles?: boolean;
	gameMode?: string;
	championRule?: "none" | "light_fearless";
	wishGroupMode?: "disabled" | "duo" | "team";
	rosterPublishedAt?: string | null;
	rosterDirty?: boolean;
};

function dateTimeLocalValue(value?: string | null) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: FormDataEntryValue | null) {
	const text = String(value || "").trim();
	if (!text) return null;
	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function formatAdminDate(value: string | null | undefined, locale: "de" | "en") {
	if (!value) return locale === "en" ? "Not set yet" : "Noch nicht festgelegt";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return locale === "en" ? "Not set yet" : "Noch nicht festgelegt";
	return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const registrationStateCopy = {
	scheduled: {
		en: { label: "Starts automatically", detail: "The application page opens at the scheduled time." },
		de: { label: "Startet automatisch", detail: "Die Bewerbungsseite öffnet sich zum eingetragenen Zeitpunkt." },
	},
	open: {
		en: { label: "Applications open", detail: "New applications and preferred groups are currently available." },
		de: { label: "Bewerbung geöffnet", detail: "Neue Bewerbungen und Wunschgruppen sind gerade möglich." },
	},
	closed: {
		en: { label: "Applications closed", detail: "No new applications are currently accepted." },
		de: { label: "Bewerbung geschlossen", detail: "Aktuell werden keine neuen Bewerbungen angenommen." },
	},
	unavailable: {
		en: { label: "Tournament active or completed", detail: "Applications are no longer accepted for this tournament." },
		de: { label: "Turnier läuft oder ist beendet", detail: "Für dieses Turnier werden keine Bewerbungen mehr angenommen." },
	},
};
type Member = { applicationId?: string; userId?: string; name: string; role?: string; discordId?: string };
type Team = { id: string; name: string; seed: number | null; members: Member[]; discordManaged?: boolean; published?: boolean };
type Match = {
	id: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	bracket?: "upper" | "lower" | "finals";
	matchType?: "standard" | "grand_final" | "bracket_reset";
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	status?: string;
};
type Application = {
	id: string;
	userId: string;
	riotId: string;
	discordId?: string | null;
	currentRank?: string | null;
	role?: string;
	note: string;
	discordDmOptIn?: boolean;
	teamId?: string | null;
	status: "pending" | "accepted" | "waitlisted" | "rejected" | "banned";
	createdAt: string;
};
type WishGroup = {
	id: string;
	name: string;
	inviteCode: string;
	ownerUserId: string;
	memberUserIds: string[];
};

function matchLabel(match: Match, locale: "de" | "en") {
	if (match.placement === "third_place") return locale === "en" ? "Third-place match" : "Spiel um Platz 3";
	if (match.matchType === "grand_final") return "Grand Final";
	if (match.matchType === "bracket_reset") return "Grand Final Reset";
	if (match.bracket === "lower") return `Loser Bracket · ${locale === "en" ? "Round" : "Runde"} ${match.round}`;
	if (match.bracket === "upper") return `Winner Bracket · ${locale === "en" ? "Round" : "Runde"} ${match.round}`;
	if (match.round === 1) return locale === "en" ? "Semifinal" : "Halbfinale";
	return locale === "en" ? "Final" : "Finale";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	const { text } = useLocale();
	return (
		<div className="roster-modal-backdrop" onMouseDown={onClose}>
			<section className="roster-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
				<header>
					<div>
						<Flower2 size={18} />
						<h2>{title}</h2>
					</div>
					<button className="icon-action" onClick={onClose} type="button" title={text("Close", "Schließen")}>
						<X size={18} />
					</button>
				</header>
				{children}
			</section>
		</div>
	);
}

export function AdminTournamentWorkspace() {
	const { locale, text } = useLocale();
	const { id } = useParams<{ id: string }>();
	const [tab, setTab] = useState<Tab>("teams");
	const [notice, setNotice] = useState("");
	const [dialog, setDialog] = useState<
		"team" | { edit: Team } | { team: Team; role: string } | { application: Application; applicationAction: "remove" | "ban" | "unban" } | null
	>(null);
	const [publishing, setPublishing] = useState(false);
	const [poolQuery, setPoolQuery] = useState("");
	const [poolSort, setPoolSort] = useState<"rank-desc" | "rank-asc" | "name">("rank-desc");
	const [seedOrder, setSeedOrder] = useState<string[] | null>(null);
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data: tournamentData, mutate: refreshTournament } = useSWR<{ tournament: Tournament }>(access ? `/api/admin/tournaments/${id}` : null, fetcher);
	const { data: teamsData, mutate: refreshTeams } = useSWR<{ teams: Team[] }>(access ? `/api/admin/tournaments/${id}/teams` : null, fetcher);
	const { data: matchesData, mutate: refreshMatches } = useSWR<{ matches: Match[] }>(access ? `/api/admin/tournaments/${id}/matches` : null, fetcher);
	const { data: applicationData, mutate: refreshApplications } = useSWR<{ applications: Application[]; wishGroups: WishGroup[] }>(
		access ? `/api/admin/tournaments/${id}/applications` : null,
		fetcher
	);
	const tournament = tournamentData?.tournament;
	const teams = useMemo(() => teamsData?.teams || [], [teamsData]);
	const matches = matchesData?.matches || [];
	const applications = useMemo(() => applicationData?.applications || [], [applicationData]);
	const wishGroups = applicationData?.wishGroups || [];
	const assignedApplicationIds = new Set(teams.flatMap((team) => team.members.map((member) => member.applicationId).filter(Boolean)));
	const availableApplications = applications.filter((application) => !["rejected", "banned"].includes(application.status) && !assignedApplicationIds.has(application.id));
	const applicationById = useMemo(() => new Map(applications.map((application) => [application.id, application])), [applications]);
	const visibleApplications = useMemo(() => {
		const query = poolQuery.trim().toLowerCase();
		return availableApplications
			.filter((application) => !query || `${application.riotId} ${application.role || ""} ${application.currentRank || ""}`.toLowerCase().includes(query))
			.sort((left, right) => {
				if (poolSort === "name") return left.riotId.localeCompare(right.riotId, "de");
				const leftScore = leagueRankScore(left.currentRank || "") ?? -1;
				const rightScore = leagueRankScore(right.currentRank || "") ?? -1;
				return poolSort === "rank-asc" ? leftScore - rightScore : rightScore - leftScore;
			});
	}, [availableApplications, poolQuery, poolSort]);
	const groupByUserId = new Map(wishGroups.flatMap((group) => group.memberUserIds.map((userId) => [userId, group] as const)));
	const teamSize = tournament?.teamSize || 5;
	const slots =
		tournament?.collectRoles === false || tournament?.gameMode?.toLowerCase().includes("aram")
			? Array.from({ length: teamSize }, (_, index) => `${text("Player", "Spieler")} ${index + 1}`)
			: ["Top", "Jungle", "Mid", "Bot", "Support"].slice(0, teamSize);
	const names = new Map(teams.map((team) => [team.id, team.name]));
	const orderedTeams = useMemo(() => {
		const fallback = [...teams].sort((left, right) => {
			if (left.seed !== null && right.seed !== null) return left.seed - right.seed;
			if (left.seed !== null) return -1;
			if (right.seed !== null) return 1;
			return left.name.localeCompare(right.name, "de");
		});
		if (!seedOrder || seedOrder.length !== teams.length || seedOrder.some((teamId) => !teams.some((team) => team.id === teamId))) return fallback;
		return seedOrder.map((teamId) => teams.find((team) => team.id === teamId)).filter((team): team is Team => Boolean(team));
	}, [seedOrder, teams]);
	const teamAverage = (team: Team) => averageLeagueRank(team.members.map((member) => (member.applicationId ? applicationById.get(member.applicationId)?.currentRank || "" : "")));
	const winsNeeded = Math.ceil((tournament?.seriesBestOf || 1) / 2);
	const firstRoundMatches = matches.filter(
		(match) => match.stage === "playoff" && match.round === 1 && !match.placement && match.bracket !== "lower" && match.bracket !== "finals"
	);

	async function request(path: string, method: string, body: unknown) {
		const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || text("The change could not be saved.", "Die Änderung konnte nicht gespeichert werden."));
		return result;
	}

	async function createTeam(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "POST", {
				name: form.get("name"),
			});
			await refreshTeams();
			setSeedOrder(null);
			setDialog(null);
			setNotice(text("Team created as a private draft. You can now fill its open slots.", "Team als stiller Entwurf angelegt. Du kannst jetzt die freien Plätze besetzen."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The team could not be created.", "Team konnte nicht angelegt werden."));
		}
	}

	async function editTeam(event: FormEvent<HTMLFormElement>, team: Team) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "PATCH", { teamId: team.id, name: form.get("name") });
			await refreshTeams();
			setDialog(null);
			setNotice(
				text(
					"Team name saved in the draft. Discord is updated only when you publish.",
					"Teamname im Entwurf gespeichert. Discord wird erst beim Veröffentlichen aktualisiert."
				)
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The team could not be saved.", "Team konnte nicht gespeichert werden."));
		}
	}

	function moveSeed(teamId: string, direction: -1 | 1) {
		const ids = orderedTeams.map((team) => team.id);
		const index = ids.indexOf(teamId);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		setSeedOrder(ids);
	}

	async function saveSeedOrder() {
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "PATCH", { action: "reorder", orderedTeamIds: orderedTeams.map((team) => team.id) });
			await refreshTeams();
			setSeedOrder(null);
			setNotice(text("Seeding saved. The order remains a draft until publication.", "Setzliste gespeichert. Die Reihenfolge bleibt bis zur Veröffentlichung ein Entwurf."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The seeding could not be saved.", "Die Setzliste konnte nicht gespeichert werden."));
		}
	}

	async function assignApplication(team: Team, role: string, application: Application) {
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "PATCH", {
				action: "assign-application",
				teamId: team.id,
				applicationId: application.id,
				slot: role,
			});
			await Promise.all([refreshTeams(), refreshApplications()]);
			setDialog(null);
			setNotice(
				text(
					`${application.riotId} was assigned to ${team.name}. The change appears after publication.`,
					`${application.riotId} wurde ${team.name} zugewiesen. Die Änderung erscheint erst nach der Veröffentlichung.`
				)
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The player could not be saved.", "Spieler konnte nicht gespeichert werden."));
		}
	}

	async function removeApplication(team: Team, member: Member) {
		if (!member.applicationId) return;
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "PATCH", {
				action: "remove-application",
				teamId: team.id,
				applicationId: member.applicationId,
			});
			await Promise.all([refreshTeams(), refreshApplications()]);
			setDialog(null);
			setNotice(text(`${member.name} is back in the applicant pool.`, `${member.name} ist wieder im Bewerber-Pool.`));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The assignment could not be removed.", "Die Zuweisung konnte nicht entfernt werden."));
		}
	}

	async function publishRoster(action: "publish" | "renotify") {
		setPublishing(true);
		try {
			const result = await request(`/api/admin/tournaments/${id}/roster`, "POST", { action });
			await Promise.all([refreshTeams(), refreshTournament()]);
			setNotice(
				action === "publish"
					? text(
							`Roster published. ${result.playerCount} players can now see their team; ${result.dmQueued} Discord DMs were queued and ${result.dmDisabled} remain website-only.`,
							`Roster veröffentlicht. ${result.playerCount} Spieler sehen jetzt ihre Einteilung; ${result.dmQueued} Discord-DMs wurden eingeplant, ${result.dmDisabled} bleiben nur auf der Website.`
						)
					: text(
							`${result.dmQueued} Discord DMs were queued again; ${result.dmDisabled} notifications remain website-only.`,
							`${result.dmQueued} Discord-DMs wurden erneut eingeplant; ${result.dmDisabled} Benachrichtigungen bleiben nur auf der Website.`
						)
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The roster could not be published.", "Der Roster konnte nicht veröffentlicht werden."));
		} finally {
			setPublishing(false);
		}
	}

	async function saveResult(event: FormEvent<HTMLFormElement>, match: Match) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}/matches`, "PATCH", { matchId: match.id, scoreA: Number(form.get("scoreA")), scoreB: Number(form.get("scoreB")) });
			await refreshMatches();
			setNotice(text("Result saved. The winning team advanced automatically.", "Ergebnis gespeichert. Das Siegerteam wurde automatisch in die nächste Runde gesetzt."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The result could not be saved.", "Ergebnis konnte nicht gespeichert werden."));
		}
	}

	async function savePairings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const pairings = firstRoundMatches.map((match) => ({
			matchId: match.id,
			teamAId: String(form.get(`teamA-${match.id}`) || ""),
			teamBId: String(form.get(`teamB-${match.id}`) || ""),
		}));
		try {
			await request(`/api/admin/tournaments/${id}/matches`, "PATCH", { action: "pairings", pairings });
			await refreshMatches();
			setNotice(
				text(
					"Pairings saved. The final and third-place match are rebuilt from the results.",
					"Die Paarungen wurden gespeichert. Finale und Spiel um Platz 3 werden aus den Ergebnissen neu aufgebaut."
				)
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The pairings could not be saved.", "Paarungen konnten nicht gespeichert werden."));
		}
	}

	async function generateBracket() {
		try {
			await request(`/api/admin/tournaments/${id}/bracket`, "POST", { stage: "playoffs" });
			await refreshMatches();
			setNotice(
				text(
					"Winner bracket, loser bracket, and grand final were created from the confirmed teams.",
					"Winner Bracket, Loser Bracket und Grand Final wurden aus den bestätigten Teams erstellt."
				)
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The bracket could not be created.", "Der Turnierbaum konnte nicht erstellt werden."));
		}
	}

	async function manageApplication(applicationId: string, action: "remove" | "ban" | "unban") {
		try {
			await request(`/api/admin/tournaments/${id}/applications`, action === "remove" ? "DELETE" : "PATCH", { applicationId, action });
			await Promise.all([refreshApplications(), refreshTeams(), refreshTournament()]);
			setDialog(null);
			setNotice(
				action === "ban"
					? text("The user was banned from future tournaments.", "Die Person wurde für zukünftige Turniere gesperrt.")
					: action === "unban"
						? text("The tournament ban was lifted.", "Die Turniersperre wurde aufgehoben.")
						: text("The application was removed.", "Die Anmeldung wurde entfernt.")
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The application could not be updated.", "Die Anmeldung konnte nicht aktualisiert werden."));
		}
	}

	async function saveEventSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}`, "PATCH", {
				title: form.get("title"),
				status: form.get("status"),
				startsAt: localDateTimeToIso(form.get("startsAt")),
				date: form.get("startsAt") ? undefined : null,
				published: form.get("published") === "on",
			});
			await refreshTournament();
			setNotice(text("Tournament schedule and visibility saved.", "Turnierfahrplan und Sichtbarkeit wurden gespeichert."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The tournament schedule could not be saved.", "Der Turnierfahrplan konnte nicht gespeichert werden."));
		}
	}

	async function saveRegistrationWindow(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}/registration-window`, "PATCH", {
				registrationOpensAt: localDateTimeToIso(form.get("registrationOpensAt")),
				registrationClosesAt: localDateTimeToIso(form.get("registrationClosesAt")),
				registrationNote: form.get("registrationNote"),
				manualOpen: form.get("manualOpen") === "on",
			});
			await refreshTournament();
			setNotice(text("Application window saved. Opening and closing happen automatically.", "Bewerbungsfenster gespeichert. Öffnung und Schließung laufen automatisch."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The application window could not be saved.", "Das Bewerbungsfenster konnte nicht gespeichert werden."));
		}
	}

	async function saveFormatSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const maxTeams = String(form.get("maxTeams") || "").trim();
		const seriesBestOf = String(form.get("seriesBestOf") || "").trim();
		try {
			await request(`/api/admin/tournaments/${id}`, "PATCH", {
				format: form.get("format"),
				maxTeams: maxTeams ? Number(maxTeams) : null,
				seriesBestOf: seriesBestOf ? Number(seriesBestOf) : null,
				teamSize: Number(form.get("teamSize") || 5),
				gameMode: form.get("gameMode"),
				bracketType: form.get("bracketType"),
				championRule: form.get("championRule"),
				wishGroupMode: form.get("wishGroupMode"),
				collectRoles: form.get("collectRoles") === "on",
			});
			await refreshTournament();
			setNotice(text("Match format and team building saved.", "Spielformat und Teambildung wurden gespeichert."));
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The match format could not be saved.", "Das Spielformat konnte nicht gespeichert werden."));
		}
	}

	if (accessError)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>{text("No tournament access", "Kein Turnierzugriff")}</h3>
					<p>{text("Your Discord account is not registered as tournament staff.", "Dein Discord-Konto ist nicht als Turnier-Team hinterlegt.")}</p>
				</div>
			</section>
		);
	if (!access || !tournament)
		return (
			<section className="content-band">
				<div className="skeleton admin-workspace-skeleton" />
			</section>
		);

	return (
		<>
			<section className="admin-detail-hero">
				<Link className="admin-back-link" href="/admin/tournaments">
					<ArrowLeft size={15} /> {text("Tournament records", "Turnierakte")}
				</Link>
				<div>
					<span className="kicker">
						{text("Tournament staff", "Turnierleitung")} · {access.role}
					</span>
					<h1>{tournament.title}</h1>
					<p>
						{tournament.format} · {tournament.maxTeams ? `${tournament.maxTeams} Teams` : text("Team limit open", "Teamlimit offen")} ·{" "}
						{tournament.seriesBestOf ? `Best of ${tournament.seriesBestOf}` : text("Series format to be announced", "Serienformat folgt")}
					</p>
				</div>
				<span className="admin-hero-flower">
					<Crown size={28} />
				</span>
			</section>

			<section className="content-band admin-workbench">
				<div className="admin-workbench-bar">
					<div className="tab-nav">
						<button className={`tab-btn ${tab === "teams" ? "active" : ""}`} onClick={() => setTab("teams")}>
							<Users size={16} /> Roster
						</button>
						<button className={`tab-btn ${tab === "applications" ? "active" : ""}`} onClick={() => setTab("applications")}>
							<ClipboardList size={16} /> {text("Applications", "Anmeldungen")} ({applications.length})
						</button>
						<button className={`tab-btn ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
							<Swords size={16} /> {text("Results", "Ergebnisse")}
						</button>
						<button className={`tab-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
							<Settings size={16} /> {text("Settings", "Einstellungen")}
						</button>
					</div>
					{tab === "teams" && (
						<div className="admin-roster-actions">
							<button className="button button-secondary" onClick={() => setDialog("team")}>
								<Plus size={16} /> {text("Create team", "Team anlegen")}
							</button>
							{tournament.rosterPublishedAt && (
								<button className="button button-secondary" disabled={publishing} onClick={() => publishRoster("renotify")}>
									<BellRing size={16} /> {text("Notify again", "Erneut informieren")}
								</button>
							)}
							<button className="button button-primary" disabled={publishing || !teams.length} onClick={() => publishRoster("publish")}>
								<Send size={16} />{" "}
								{tournament.rosterPublishedAt
									? text("Publish & notify", "Veröffentlichen & informieren")
									: text("Publish roster & notify", "Roster veröffentlichen & informieren")}
							</button>
						</div>
					)}
				</div>
				{notice && (
					<p className="admin-notice">
						<Flower2 size={15} /> {notice}
					</p>
				)}

				{tab === "teams" && (
					<div className="admin-roster-builder">
						<aside className="admin-applicant-pool">
							<header>
								<span>
									<UsersRound size={17} /> {text("Applicant pool", "Bewerber-Pool")}
								</span>
								<strong>{availableApplications.length}</strong>
							</header>
							<p>
								{text(
									"Open slots are filled from verified solo applications. Discord and Riot are required.",
									"Freie Plätze werden aus verifizierten Solo-Anmeldungen besetzt. Discord und Riot sind dafür verpflichtend."
								)}
							</p>
							<div className="admin-pool-tools">
								<label>
									<Search size={14} />
									<input
										aria-label={text("Search applicants", "Bewerber suchen")}
										value={poolQuery}
										onChange={(event) => setPoolQuery(event.target.value)}
										placeholder={text("Name, role, or rank", "Name, Rolle oder Rang")}
									/>
								</label>
								<select
									aria-label={text("Sort applicants", "Bewerber sortieren")}
									value={poolSort}
									onChange={(event) => setPoolSort(event.target.value as typeof poolSort)}
								>
									<option value="rank-desc">{text("Rank descending", "Rang absteigend")}</option>
									<option value="rank-asc">{text("Rank ascending", "Rang aufsteigend")}</option>
									<option value="name">Name</option>
								</select>
							</div>
							<div className="admin-applicant-stack">
								{visibleApplications.map((application) => {
									const group = groupByUserId.get(application.userId);
									return (
										<div className="admin-applicant-chip" key={application.id}>
											<strong>{application.riotId}</strong>
											<span>
												{application.role || text("Any role", "Rolle frei")} · {application.currentRank || "Unranked"}
											</span>
											{group && (
												<small title={group.inviteCode}>
													<Flower2 size={12} /> {group.name}
												</small>
											)}
										</div>
									);
								})}
								{!visibleApplications.length && (
									<span className="admin-pool-empty">{text("No matching available applicants found.", "Keine passenden freien Bewerber gefunden.")}</span>
								)}
							</div>
							<div className="admin-pool-disclosure">
								<Flower2 size={15} />
								<span>
									{text(
										"Preferred groups are a placement request. Balanced team strength takes priority.",
										"Wunschgruppen sind ein Einteilungswunsch. Ausgeglichene Teamstärke hat Vorrang."
									)}
								</span>
							</div>
						</aside>
						<div className="admin-roster-main">
							<div className="admin-draft-note">
								<Flower2 size={18} />
								<div>
									<strong>{text("Unpublished working state", "Stiller Arbeitsstand")}</strong>
									<span>
										{text(
											"Teams, roles, and names are saved immediately as a draft. Discord is synchronised and DMs sent only after selecting Publish & notify.",
											"Teams, Rollen und Namen werden sofort als Entwurf gespeichert. Erst „Veröffentlichen & informieren“ gleicht Discord ab und verschickt DMs."
										)}
									</span>
								</div>
							</div>
							<div className="admin-roster-statusline">
								<span>
									{teams.length} {text("teams", "Teams")} · {teams.reduce((sum, team) => sum + team.members.length, 0)} {text("assigned", "zugewiesen")}
								</span>
								<strong>
									{tournament.rosterPublishedAt
										? tournament.rosterDirty
											? text("Unpublished changes", "Unveröffentlichte Änderungen")
											: text("Roster published", "Roster veröffentlicht")
										: text("Draft, not publicly visible", "Entwurf, öffentlich noch unsichtbar")}
								</strong>
							</div>
							<div className="admin-roster-grid">
								{orderedTeams.map((team) => (
									<article className="admin-team-sheet" key={team.id}>
										<header>
											<div>
												<small>
													{team.seed ? `${text("Seed", "Setzplatz")} ${team.seed}` : text("Seed open", "Setzplatz offen")} · {team.members.length}/
													{teamSize}
												</small>
												<h2>{team.name}</h2>
											</div>
											<button className="icon-action" onClick={() => setDialog({ edit: team })} title={text("Edit team name", "Teamname bearbeiten")}>
												<Pencil size={16} />
											</button>
										</header>
										<div className="admin-team-slots">
											{slots.map((role) => {
												const member = team.members.find((entry) => entry.role?.toLowerCase() === role.toLowerCase());
												const group = member?.userId ? groupByUserId.get(member.userId) : undefined;
												return (
													<button className={`admin-role-slot ${member ? "filled" : ""}`} key={role} onClick={() => setDialog({ team, role })}>
														<span>{role}</span>
														<strong>{member?.name || text("Fill open slot", "Freien Platz besetzen")}</strong>
														{group ? (
															<small>
																<Flower2 size={11} /> {group.name}
															</small>
														) : member ? (
															<UserMinus size={14} />
														) : (
															<UserPlus size={14} />
														)}
													</button>
												);
											})}
										</div>
										<footer>
											<span>
												{text("Avg. rank", "Ø Rang")}: {teamAverage(team).label} ({teamAverage(team).rankedPlayers}/{team.members.length})
											</span>
											<span>{team.published ? text("Public", "Öffentlich") : text("Draft", "Entwurf")}</span>
										</footer>
									</article>
								))}
								{teams.length === 0 && (
									<div className="empty-state">
										<Users size={36} />
										<h3>{text("No teams yet", "Noch keine Teams")}</h3>
										<p>
											{text(
												"Create a team first, then assign players to individual slots.",
												"Lege zuerst ein Team an. Danach werden Spieler einzeln über ihre Rolle zugewiesen."
											)}
										</p>
									</div>
								)}
							</div>
							{orderedTeams.length > 1 && (
								<section className="admin-seeding-sheet">
									<header>
										<div>
											<span className="kicker">{text("Seeding", "Setzliste")}</span>
											<h2>{text("Order by team strength", "Reihenfolge nach Teamstärke")}</h2>
											<p>
												{text(
													"The average official Riot rank helps with placement. The final order remains your decision.",
													"Der durchschnittliche offizielle Riot-Rang hilft bei der Einordnung. Die endgültige Reihenfolge bleibt eure Entscheidung."
												)}
											</p>
										</div>
										<button className="button button-secondary button-small" type="button" onClick={saveSeedOrder}>
											<Save size={14} /> {text("Save seeding", "Setzliste speichern")}
										</button>
									</header>
									<div className="admin-seeding-list">
										{orderedTeams.map((team, index) => {
											const average = teamAverage(team);
											return (
												<div className="admin-seeding-row" key={team.id}>
													<strong>{index + 1}</strong>
													<span>
														<b>{team.name}</b>
														<small>
															Ø {average.label} · {average.rankedPlayers} {text("rated", "gewertet")}
														</small>
													</span>
													<div>
														<button
															className="icon-action"
															type="button"
															disabled={index === 0}
															onClick={() => moveSeed(team.id, -1)}
															title={text("Move up", "Nach oben")}
														>
															<ArrowUp size={15} />
														</button>
														<button
															className="icon-action"
															type="button"
															disabled={index === orderedTeams.length - 1}
															onClick={() => moveSeed(team.id, 1)}
															title={text("Move down", "Nach unten")}
														>
															<ArrowDown size={15} />
														</button>
													</div>
												</div>
											);
										})}
									</div>
								</section>
							)}
						</div>
					</div>
				)}

				{tab === "applications" && (
					<div className="admin-application-list">
						{applications.map((application) => (
							<article className="admin-application-sheet" key={application.id}>
								<header>
									<div>
										<small>
											{text("Solo application", "Solo-Anmeldung")}
											{groupByUserId.get(application.userId)
												? ` · ${text("Preferred group", "Wunschgruppe")} ${groupByUserId.get(application.userId)?.name}`
												: ""}
										</small>
										<h2>{application.riotId}</h2>
									</div>
									<span
										className={`status-pill ${application.status === "accepted" ? "registration" : application.status === "rejected" ? "completed" : "announcement"}`}
									>
										{text(
											application.status === "accepted"
												? "Accepted"
												: application.status === "banned"
													? "Banned"
													: application.status === "rejected"
														? "Rejected"
														: application.status === "waitlisted"
															? "Waitlist"
															: "Pending",
											application.status === "accepted"
												? "Angenommen"
												: application.status === "banned"
													? "Gesperrt"
													: application.status === "rejected"
														? "Abgelehnt"
														: application.status === "waitlisted"
															? "Warteliste"
															: "Offen"
										)}
									</span>
								</header>
								<div className="admin-application-connections">
									<span>Discord: {application.discordId || text("missing", "fehlt")}</span>
									<span>
										{text("Riot rank", "Riot-Rang")}: {application.currentRank || "Unranked"}
									</span>
									{application.role && (
										<span>
											{text("Role", "Rolle")}: {application.role}
										</span>
									)}
									<span>Bot-DMs: {application.discordDmOptIn ? text("enabled", "aktiv") : text("off", "aus")}</span>
									{application.teamId && <span>{text("Already assigned", "Bereits zugewiesen")}</span>}
								</div>
								<p>{application.note}</p>
								<footer>
									{application.status === "banned" ? (
										<button className="button button-secondary button-small" onClick={() => setDialog({ application, applicationAction: "unban" })}>
											<Check size={14} /> {text("Lift ban", "Entbannen")}
										</button>
									) : (
										<>
											<button className="button button-secondary button-small" onClick={() => setDialog({ application, applicationAction: "remove" })}>
												<UserMinus size={14} /> {text("Remove", "Entfernen")}
											</button>
											<button className="button button-danger-soft button-small" onClick={() => setDialog({ application, applicationAction: "ban" })}>
												<ShieldAlert size={14} /> {text("Ban", "Bannen")}
											</button>
										</>
									)}
								</footer>
							</article>
						))}
						{applications.length === 0 && (
							<div className="empty-state">
								<ClipboardList size={36} />
								<h3>{text("No applications yet", "Noch keine Anmeldungen")}</h3>
								<p>
									{text(
										"New individual applications appear here once registration opens.",
										"Neue Einzelbewerbungen erscheinen nach dem Öffnen der Anmeldung hier."
									)}
								</p>
							</div>
						)}
					</div>
				)}

				{tab === "matches" && (
					<>
						{firstRoundMatches.length > 0 && (
							<form className="admin-pairing-editor" onSubmit={savePairings}>
								<header>
									<div>
										<Shuffle size={18} />
										<span>
											<strong>{text("First-round pairings", "Paarungen der ersten Runde")}</strong>
											<small>{text("Assign each team exactly once", "Jedes Team genau einmal zuweisen")}</small>
										</span>
									</div>
									<button className="button button-secondary button-small" type="submit">
										<Check size={14} /> {text("Save pairings", "Paarungen speichern")}
									</button>
								</header>
								<div className="admin-pairing-grid">
									{firstRoundMatches.map((match) => (
										<fieldset key={`${match.id}-${match.teamAId}-${match.teamBId}`}>
											<legend>Match {match.position}</legend>
											<select
												aria-label={`${text("First team in match", "Erstes Team in Match")} ${match.position}`}
												defaultValue={match.teamAId || ""}
												name={`teamA-${match.id}`}
												required
											>
												<option value="" disabled>
													{text("Select team", "Team auswählen")}
												</option>
												{teams.map((team) => (
													<option value={team.id} key={team.id}>
														{team.name}
													</option>
												))}
											</select>
											<span>{text("versus", "gegen")}</span>
											<select
												aria-label={`${text("Second team in match", "Zweites Team in Match")} ${match.position}`}
												defaultValue={match.teamBId || ""}
												name={`teamB-${match.id}`}
												required
											>
												<option value="" disabled>
													{text("Select team", "Team auswählen")}
												</option>
												{teams.map((team) => (
													<option value={team.id} key={team.id}>
														{team.name}
													</option>
												))}
											</select>
										</fieldset>
									))}
								</div>
							</form>
						)}
						<div className="admin-results">
							{matches.map((match) => {
								const ready = Boolean(match.teamAId && match.teamBId);
								return (
									<article
										className={`admin-match-sheet ${match.placement === "third_place" ? "is-placement" : ""}`}
										key={`${match.id}-${match.teamAId}-${match.teamBId}-${match.scoreA}-${match.scoreB}`}
									>
										<div>
											<small>{matchLabel(match, locale)}</small>
											<strong>
												{match.teamAId ? names.get(match.teamAId) : text("Open", "Noch offen")} <span>{text("versus", "gegen")}</span>{" "}
												{match.teamBId ? names.get(match.teamBId) : text("Open", "Noch offen")}
											</strong>
										</div>
										<form onSubmit={(event) => saveResult(event, match)}>
											<input
												aria-label={text("Team A score", "Punkte Team A")}
												defaultValue={match.scoreA}
												disabled={!ready}
												max={winsNeeded}
												min="0"
												name="scoreA"
												type="number"
											/>
											<span>:</span>
											<input
												aria-label={text("Team B score", "Punkte Team B")}
												defaultValue={match.scoreB}
												disabled={!ready}
												max={winsNeeded}
												min="0"
												name="scoreB"
												type="number"
											/>
											<button className="button button-primary button-small" disabled={!ready} type="submit">
												<Check size={14} /> {text("Save", "Speichern")}
											</button>
										</form>
									</article>
								);
							})}
							{matches.length === 0 && (
								<div className="empty-state">
									<Clock3 size={36} />
									<h3>{text("The bracket is waiting for the final teams", "Der Turnierbaum wartet auf die finalen Teams")}</h3>
									<p>
										{tournament.bracketType === "double_elimination"
											? text(
													"Once 4, 8, 16, or 32 teams are confirmed, the complete double-elimination bracket can be created.",
													"Sobald 4, 8, 16 oder 32 Teams bestätigt sind, kann der vollständige Double-Elimination-Baum erstellt werden."
												)
											: text(
													"Pairings are prepared here once all teams are confirmed.",
													"Sobald alle Teams feststehen, werden die Paarungen hier vorbereitet."
												)}
									</p>
									{tournament.bracketType === "double_elimination" && (
										<button className="button button-primary" onClick={generateBracket} type="button">
											<Swords size={15} /> {text(`Create bracket from ${teams.length} teams`, `Turnierbaum aus ${teams.length} Teams erstellen`)}
										</button>
									)}
								</div>
							)}
						</div>
					</>
				)}

				{tab === "settings" && (
					<div className="admin-settings-journal">
						<header className="admin-settings-intro">
							<span className="kicker">{text("Tournament management", "Turnierpflege")}</span>
							<h2>{text("Everything important across the tournament lifecycle", "Alles Wichtige entlang des Turnierablaufs")}</h2>
							<p>
								{text(
									"Changes appear immediately on the public tournament page. The application window needs no cron job.",
									"Änderungen greifen sofort auf der öffentlichen Turnierseite. Das Bewerbungsfenster benötigt keinen Cronjob."
								)}
							</p>
						</header>

						<form className="admin-settings-section" onSubmit={saveEventSettings}>
							<div className="admin-settings-number">01</div>
							<div className="admin-settings-heading">
								<CalendarClock size={22} />
								<div>
									<span className="kicker">{text("Tournament schedule", "Turnierfahrplan")}</span>
									<h3>{text("Name, start, and public status", "Name, Start und öffentlicher Status")}</h3>
								</div>
							</div>
							<div className="admin-settings-fields three-columns">
								<label>
									{text("Tournament name", "Turniername")}
									<input name="title" defaultValue={tournament.title} required />
								</label>
								<label>
									{text("Tournament start", "Turnierstart")}
									<input name="startsAt" type="datetime-local" defaultValue={dateTimeLocalValue(tournament.startsAt)} />
								</label>
								<label>
									Status
									<select name="status" defaultValue={tournament.status || "announcement"}>
										<option value="announcement">{text("Planning", "In Planung")}</option>
										<option value="registration">{text("Applications", "Bewerbungsphase")}</option>
										<option value="live">{text("Live", "Läuft gerade")}</option>
										<option value="completed">{text("Completed", "Abgeschlossen")}</option>
									</select>
								</label>
							</div>
							<div className="admin-settings-footer">
								<label className="settings-visibility">
									<input name="published" type="checkbox" defaultChecked={tournament.published !== false} />
									<span>
										{tournament.published !== false ? <Globe2 size={17} /> : <LockKeyhole size={17} />}{" "}
										{text("Visible on the tournament hub", "Auf dem Tournament-Hub sichtbar")}
									</span>
								</label>
								<button className="button button-primary" type="submit">
									<Check size={15} /> {text("Save schedule", "Fahrplan speichern")}
								</button>
							</div>
						</form>

						<form className="admin-settings-section registration-window-section" onSubmit={saveRegistrationWindow}>
							<div className="admin-settings-number">02</div>
							<div className="admin-settings-heading">
								<Flower2 size={22} />
								<div>
									<span className="kicker">{text("Application phase", "Bewerbungsphase")}</span>
									<h3>{text("Open and close automatically", "Automatisch öffnen und schließen")}</h3>
								</div>
								<div className={`registration-window-state ${tournament.registrationState || "closed"}`}>
									<strong>{registrationStateCopy[tournament.registrationState || "closed"][locale].label}</strong>
									<span>{registrationStateCopy[tournament.registrationState || "closed"][locale].detail}</span>
								</div>
							</div>
							<div className="registration-timeline" aria-label={text("Application phase schedule", "Zeitplan der Bewerbungsphase")}>
								<label>
									<span>{text("Opens on", "Öffnet am")}</span>
									<input name="registrationOpensAt" type="datetime-local" defaultValue={dateTimeLocalValue(tournament.registrationOpensAt)} />
									<small>{formatAdminDate(tournament.registrationOpensAt, locale)}</small>
								</label>
								<span className="registration-timeline-line" />
								<label>
									<span>{text("Closes on", "Schließt am")}</span>
									<input name="registrationClosesAt" type="datetime-local" defaultValue={dateTimeLocalValue(tournament.registrationClosesAt)} />
									<small>{formatAdminDate(tournament.registrationClosesAt, locale)}</small>
								</label>
							</div>
							<label className="settings-note">
								{text("Note on the application page", "Hinweis auf der Bewerbungsseite")}
								<textarea
									name="registrationNote"
									defaultValue={tournament.registrationNote || ""}
									placeholder={text(
										"For example: Places are limited; an application does not guarantee participation.",
										"Zum Beispiel: Die Plätze sind begrenzt; eine Bewerbung garantiert noch keine Teilnahme."
									)}
								/>
							</label>
							<div className="admin-settings-footer">
								<label className="settings-visibility manual-registration-toggle">
									<input name="manualOpen" type="checkbox" defaultChecked={!tournament.registrationOpensAt && tournament.registrationOpen} />
									<span>{text("Keep open manually without a schedule", "Ohne Zeitplan manuell geöffnet halten")}</span>
								</label>
								<button className="button button-primary" type="submit">
									<Check size={15} /> {text("Save application window", "Bewerbungsfenster speichern")}
								</button>
							</div>
						</form>

						<form className="admin-settings-section" onSubmit={saveFormatSettings}>
							<div className="admin-settings-number">03</div>
							<div className="admin-settings-heading">
								<Swords size={22} />
								<div>
									<span className="kicker">{text("Match format", "Spielformat")}</span>
									<h3>{text("Bracket, teams, and series", "Bracket, Teams und Serien")}</h3>
								</div>
							</div>
							<div className="admin-settings-fields three-columns">
								<label>
									{text("Format description", "Formatbeschreibung")}
									<input name="format" defaultValue={tournament.format} required />
								</label>
								<label>
									{text("Game mode", "Spielmodus")}
									<input name="gameMode" defaultValue={tournament.gameMode || "League of Legends"} />
								</label>
								<label>
									Bracket
									<select name="bracketType" defaultValue={tournament.bracketType || "single_elimination"}>
										<option value="single_elimination">Single Elimination</option>
										<option value="double_elimination">Double Elimination</option>
										<option value="groups">{text("Groups + playoffs", "Gruppen + Playoffs")}</option>
									</select>
								</label>
								<label>
									{text("Maximum teams", "Maximale Teams")}
									<input
										name="maxTeams"
										type="number"
										min="2"
										max="128"
										defaultValue={tournament.maxTeams || ""}
										placeholder={text("Still open", "Noch offen")}
									/>
								</label>
								<label>
									{text("Players per team", "Spieler pro Team")}
									<input name="teamSize" type="number" min="1" max="10" defaultValue={tournament.teamSize || 5} />
								</label>
								<label>
									{text("Series format", "Serienformat")}
									<select name="seriesBestOf" defaultValue={tournament.seriesBestOf || ""}>
										<option value="">{text("Still open", "Noch offen")}</option>
										<option value="1">Best of 1</option>
										<option value="3">Best of 3</option>
										<option value="5">Best of 5</option>
									</select>
								</label>
								<label>
									{text("Champion rule", "Champion-Regel")}
									<select name="championRule" defaultValue={tournament.championRule || "none"}>
										<option value="none">{text("None", "Keine")}</option>
										<option value="light_fearless">Light Fearless</option>
									</select>
								</label>
								<label>
									{text("Preferred groups", "Wunschgruppen")}
									<select name="wishGroupMode" defaultValue={tournament.wishGroupMode || "disabled"}>
										<option value="disabled">{text("Disabled", "Deaktiviert")}</option>
										<option value="duo">{text("Up to 2 players", "Bis 2 Spieler")}</option>
										<option value="team">{text("Up to team size", "Bis zur Teamgröße")}</option>
									</select>
								</label>
							</div>
							<div className="admin-settings-footer">
								<label className="settings-visibility">
									<input name="collectRoles" type="checkbox" defaultChecked={tournament.collectRoles !== false} />
									<span>{text("Ask for a preferred role in the application", "Rollenwunsch in der Bewerbung abfragen")}</span>
								</label>
								<button className="button button-primary" type="submit">
									<Check size={15} /> {text("Save match format", "Spielformat speichern")}
								</button>
							</div>
						</form>
					</div>
				)}
			</section>

			{dialog === "team" && (
				<Modal title={text("New team", "Neues Team")} onClose={() => setDialog(null)}>
					<form className="roster-form" onSubmit={createTeam}>
						<label>
							{text("Team name", "Teamname")}
							<input name="name" required autoFocus />
						</label>
						<p className="muted-note">
							{text(
								"The team starts as a private draft. Seed, Discord role, and channels are added later through seeding and publication.",
								"Das Team beginnt als stiller Entwurf. Setzplatz, Discord-Rolle und Kanäle folgen erst später über Setzliste und Veröffentlichung."
							)}
						</p>
						<button className="button button-primary" type="submit">
							{text("Create team", "Team erstellen")}
						</button>
					</form>
				</Modal>
			)}
			{dialog && typeof dialog === "object" && "applicationAction" in dialog && (
				<Modal
					title={
						dialog.applicationAction === "ban"
							? text("Ban from tournaments", "Für Turniere sperren")
							: dialog.applicationAction === "unban"
								? text("Lift tournament ban", "Turniersperre aufheben")
								: text("Remove application", "Anmeldung entfernen")
					}
					onClose={() => setDialog(null)}
				>
					<div className="roster-form">
						<p>
							<strong>{dialog.application.riotId}</strong>
						</p>
						<p className="muted-note">
							{dialog.applicationAction === "ban"
								? text(
										"This removes the application and any roster or preferred-group assignment. The linked user will be blocked from all future tournament applications until the ban is lifted.",
										"Die Anmeldung sowie jede Roster- oder Wunschgruppen-Zuweisung werden entfernt. Die verknüpfte Person kann sich bis zur Aufhebung der Sperre für kein zukünftiges Turnier anmelden."
									)
								: dialog.applicationAction === "unban"
									? text(
											"The user may apply to tournaments again. This application returns to the open applicant pool.",
											"Die Person kann sich wieder für Turniere anmelden. Diese Anmeldung kehrt in den offenen Bewerber-Pool zurück."
										)
									: text(
											"This application and its roster or preferred-group assignment will be removed. The user may apply to future tournaments again.",
											"Diese Anmeldung sowie ihre Roster- oder Wunschgruppen-Zuweisung werden entfernt. Die Person kann sich weiterhin für zukünftige Turniere anmelden."
										)}
						</p>
						<div className="dialog-actions">
							<button className="button button-secondary" type="button" onClick={() => setDialog(null)}>
								{text("Cancel", "Abbrechen")}
							</button>
							<button
								className={`button ${dialog.applicationAction === "unban" ? "button-primary" : "button-danger-soft"}`}
								type="button"
								onClick={() => manageApplication(dialog.application.id, dialog.applicationAction)}
							>
								{dialog.applicationAction === "ban" ? <ShieldAlert size={15} /> : <Check size={15} />}
								{dialog.applicationAction === "ban"
									? text("Ban permanently", "Verbindlich sperren")
									: dialog.applicationAction === "unban"
										? text("Lift ban", "Sperre aufheben")
										: text("Remove application", "Anmeldung entfernen")}
							</button>
						</div>
					</div>
				</Modal>
			)}
			{dialog && typeof dialog === "object" && "edit" in dialog && (
				<Modal title={text("Edit team", "Team bearbeiten")} onClose={() => setDialog(null)}>
					<form className="roster-form" onSubmit={(event) => editTeam(event, dialog.edit)}>
						<label>
							{text("Team name", "Teamname")}
							<input name="name" defaultValue={dialog.edit.name} required autoFocus />
						</label>
						<p className="muted-note">
							{text(
								"This change remains private until you publish the roster. The Discord role and channels are then renamed through the queue.",
								"Diese Änderung bleibt still, bis du den Roster veröffentlichst. Dann werden Discord-Rolle und Kanäle über die Queue umbenannt."
							)}
						</p>
						<button className="button button-primary" type="submit">
							{text("Save changes", "Änderungen speichern")}
						</button>
					</form>
				</Modal>
			)}
			{dialog && typeof dialog === "object" && "team" in dialog && (
				<Modal title={`${dialog.role} ${text("slot", "besetzen")}`} onClose={() => setDialog(null)}>
					{(() => {
						const member = dialog.team.members.find((entry) => entry.role?.toLowerCase() === dialog.role.toLowerCase());
						const matchingApplications =
							tournament.collectRoles === false
								? availableApplications
								: availableApplications.filter((application) => !application.role || application.role.toLowerCase() === dialog.role.toLowerCase());
						if (member)
							return (
								<div className="roster-current-player">
									<div>
										<span className="kicker">{text("Current assignment", "Aktuelle Zuweisung")}</span>
										<h3>{member.name}</h3>
										<p>
											{dialog.team.name} · {dialog.role}
										</p>
									</div>
									<button
										className="button button-danger-soft"
										type="button"
										onClick={() => removeApplication(dialog.team, member)}
										disabled={!member.applicationId}
									>
										<UserMinus size={15} /> {text("Remove from team", "Aus Team entfernen")}
									</button>
								</div>
							);
						return (
							<div className="roster-candidate-list">
								<p>{text("Select a solo application for this open slot.", "Wähle eine Solo-Anmeldung für diesen freien Platz aus.")}</p>
								{matchingApplications.map((application) => {
									const group = groupByUserId.get(application.userId);
									return (
										<button
											className="roster-candidate"
											type="button"
											key={application.id}
											onClick={() => assignApplication(dialog.team, dialog.role, application)}
										>
											<span>
												<strong>{application.riotId}</strong>
												<small>
													{application.role || text("Any role", "Rolle frei")} · {application.currentRank || "Unranked"}
													{group ? ` · ${group.name}` : ""}
												</small>
											</span>
											<UserPlus size={16} />
										</button>
									);
								})}
								{!matchingApplications.length && (
									<div className="empty-state compact-empty">
										<Users size={28} />
										<h3>{text("Nobody available", "Niemand verfügbar")}</h3>
										<p>
											{text(
												"There is currently no suitable unassigned application for this slot.",
												"Für diesen Platz gibt es aktuell keine passende, unzugewiesene Anmeldung."
											)}
										</p>
									</div>
								)}
							</div>
						);
					})()}
				</Modal>
			)}
		</>
	);
}
