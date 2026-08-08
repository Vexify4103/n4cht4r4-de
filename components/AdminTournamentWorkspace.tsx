"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
	ArrowLeft,
	BellRing,
	Check,
	ClipboardList,
	Clock3,
	Crown,
	Flower2,
	Pencil,
	Plus,
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
	registrationNote?: string;
	bracketType?: "single_elimination" | "double_elimination" | "groups";
	teamSize?: number;
	collectRoles?: boolean;
	gameMode?: string;
	rosterPublishedAt?: string | null;
	rosterDirty?: boolean;
};
type Member = { applicationId?: string; userId?: string; name: string; role?: string; discordId?: string };
type Team = { id: string; name: string; seed: number; members: Member[]; discordManaged?: boolean; published?: boolean };
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
	twitchId?: string | null;
	role?: string;
	note: string;
	discordDmOptIn?: boolean;
	teamId?: string | null;
	status: "pending" | "accepted" | "waitlisted" | "rejected";
	createdAt: string;
};
type WishGroup = {
	id: string;
	name: string;
	inviteCode: string;
	ownerUserId: string;
	memberUserIds: string[];
};

function matchLabel(match: Match) {
	if (match.placement === "third_place") return "Spiel um Platz 3";
	if (match.matchType === "grand_final") return "Grand Final";
	if (match.matchType === "bracket_reset") return "Grand Final Reset";
	if (match.bracket === "lower") return `Loser Bracket · Runde ${match.round}`;
	if (match.bracket === "upper") return `Winner Bracket · Runde ${match.round}`;
	if (match.round === 1) return "Halbfinale";
	return "Finale";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<div className="roster-modal-backdrop" onMouseDown={onClose}>
			<section className="roster-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
				<header>
					<div>
						<Flower2 size={18} />
						<h2>{title}</h2>
					</div>
					<button className="icon-action" onClick={onClose} type="button" title="Schließen">
						<X size={18} />
					</button>
				</header>
				{children}
			</section>
		</div>
	);
}

export function AdminTournamentWorkspace() {
	const { id } = useParams<{ id: string }>();
	const [tab, setTab] = useState<Tab>("teams");
	const [notice, setNotice] = useState("");
	const [dialog, setDialog] = useState<"team" | { edit: Team } | { team: Team; role: string } | null>(null);
	const [publishing, setPublishing] = useState(false);
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data: tournamentData, mutate: refreshTournament } = useSWR<{ tournament: Tournament }>(access ? `/api/admin/tournaments/${id}` : null, fetcher);
	const { data: teamsData, mutate: refreshTeams } = useSWR<{ teams: Team[] }>(access ? `/api/admin/tournaments/${id}/teams` : null, fetcher);
	const { data: matchesData, mutate: refreshMatches } = useSWR<{ matches: Match[] }>(access ? `/api/admin/tournaments/${id}/matches` : null, fetcher);
	const { data: applicationData, mutate: refreshApplications } = useSWR<{ applications: Application[]; wishGroups: WishGroup[] }>(
		access ? `/api/admin/tournaments/${id}/applications` : null,
		fetcher
	);
	const tournament = tournamentData?.tournament;
	const teams = teamsData?.teams || [];
	const matches = matchesData?.matches || [];
	const applications = applicationData?.applications || [];
	const wishGroups = applicationData?.wishGroups || [];
	const assignedApplicationIds = new Set(teams.flatMap((team) => team.members.map((member) => member.applicationId).filter(Boolean)));
	const availableApplications = applications.filter((application) => application.status !== "rejected" && !assignedApplicationIds.has(application.id));
	const groupByUserId = new Map(wishGroups.flatMap((group) => group.memberUserIds.map((userId) => [userId, group] as const)));
	const teamSize = tournament?.teamSize || 5;
	const slots =
		tournament?.collectRoles === false || tournament?.gameMode?.toLowerCase().includes("aram")
			? Array.from({ length: teamSize }, (_, index) => `Spieler ${index + 1}`)
			: ["Top", "Jungle", "Mid", "Bot", "Support"].slice(0, teamSize);
	const names = new Map(teams.map((team) => [team.id, team.name]));
	const winsNeeded = Math.ceil((tournament?.seriesBestOf || 1) / 2);
	const firstRoundMatches = matches.filter(
		(match) => match.stage === "playoff" && match.round === 1 && !match.placement && match.bracket !== "lower" && match.bracket !== "finals"
	);

	async function request(path: string, method: string, body: unknown) {
		const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Die Änderung konnte nicht gespeichert werden.");
		return result;
	}

	async function createTeam(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await request(`/api/admin/tournaments/${id}/teams`, "POST", {
				name: form.get("name"),
				seed: Number(form.get("seed")),
				members: [],
				createDiscordResources: form.get("createDiscordResources") === "on",
			});
			await Promise.all([refreshTeams(), refreshMatches()]);
			setDialog(null);
			setNotice(
				result.discordJobQueued ? "Team gespeichert. Discord-Rolle und Kanäle wurden in die Queue gelegt." : "Team gespeichert. Du kannst jetzt die Rollen besetzen."
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Team konnte nicht angelegt werden.");
		}
	}

	async function editTeam(event: FormEvent<HTMLFormElement>, team: Team) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await request(`/api/admin/tournaments/${id}/teams`, "PATCH", { teamId: team.id, name: form.get("name"), seed: Number(form.get("seed")) });
			await refreshTeams();
			setDialog(null);
			setNotice(result.discordRenameJobsQueued ? "Team gespeichert. Die Discord-Umbenennungen laufen nacheinander über die Queue." : "Teamname und Seed wurden gespeichert.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Team konnte nicht gespeichert werden.");
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
			setNotice(`${application.riotId} wurde ${team.name} zugewiesen. Die Änderung erscheint erst nach der Veröffentlichung.`);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Spieler konnte nicht gespeichert werden.");
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
			setNotice(`${member.name} ist wieder im Bewerber-Pool.`);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Die Zuweisung konnte nicht entfernt werden.");
		}
	}

	async function publishRoster(action: "publish" | "renotify") {
		setPublishing(true);
		try {
			const result = await request(`/api/admin/tournaments/${id}/roster`, "POST", { action });
			await Promise.all([refreshTeams(), refreshTournament()]);
			setNotice(
				action === "publish"
					? `Roster veröffentlicht. ${result.playerCount} Spieler sehen jetzt ihre Einteilung; ${result.notificationCount} Benachrichtigungen wurden erstellt.`
					: `${result.notificationCount} Spieler wurden erneut benachrichtigt.`
			);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Der Roster konnte nicht veröffentlicht werden.");
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
			setNotice("Ergebnis gespeichert. Das Siegerteam wurde automatisch in die nächste Runde gesetzt.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Ergebnis konnte nicht gespeichert werden.");
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
			setNotice("Die Paarungen wurden gespeichert. Finale und Spiel um Platz 3 werden aus den Ergebnissen neu aufgebaut.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Paarungen konnten nicht gespeichert werden.");
		}
	}

	async function generateBracket() {
		try {
			await request(`/api/admin/tournaments/${id}/bracket`, "POST", { stage: "playoffs" });
			await refreshMatches();
			setNotice("Winner Bracket, Loser Bracket und Grand Final wurden aus den bestätigten Teams erstellt.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Der Turnierbaum konnte nicht erstellt werden.");
		}
	}

	async function reviewApplication(applicationId: string, status: Application["status"]) {
		try {
			await request(`/api/admin/tournaments/${id}/applications`, "PATCH", { applicationId, status });
			await refreshApplications();
			setNotice("Der Bewerbungsstatus wurde gespeichert.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Die Bewerbung konnte nicht aktualisiert werden.");
		}
	}

	async function saveSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const maxTeams = String(form.get("maxTeams") || "").trim();
		const seriesBestOf = String(form.get("seriesBestOf") || "").trim();
		try {
			await request(`/api/admin/tournaments/${id}`, "PATCH", {
				status: form.get("status"),
				registrationOpen: form.get("registrationOpen") === "on",
				registrationNote: form.get("registrationNote"),
				maxTeams: maxTeams ? Number(maxTeams) : null,
				seriesBestOf: seriesBestOf ? Number(seriesBestOf) : null,
			});
			await refreshTournament();
			setNotice("Turnierstatus und Anmeldung wurden gespeichert.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Die Einstellungen konnten nicht gespeichert werden.");
		}
	}

	if (accessError)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>Kein Turnierzugriff</h3>
					<p>Dein Discord-Konto ist nicht als Turnier-Team hinterlegt.</p>
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
					<ArrowLeft size={15} /> Turnierakte
				</Link>
				<div>
					<span className="kicker">Turnierleitung · {access.role}</span>
					<h1>{tournament.title}</h1>
					<p>
						{tournament.format} · {tournament.maxTeams ? `${tournament.maxTeams} Teams` : "Teamlimit offen"} ·{" "}
						{tournament.seriesBestOf ? `Best of ${tournament.seriesBestOf}` : "Serienformat folgt"}
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
							<ClipboardList size={16} /> Anmeldungen ({applications.length})
						</button>
						<button className={`tab-btn ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
							<Swords size={16} /> Ergebnisse
						</button>
						<button className={`tab-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
							<Settings size={16} /> Einstellungen
						</button>
					</div>
					{tab === "teams" && (
						<div className="admin-roster-actions">
							<button className="button button-secondary" onClick={() => setDialog("team")}>
								<Plus size={16} /> Team anlegen
							</button>
							{tournament.rosterPublishedAt && (
								<button className="button button-secondary" disabled={publishing} onClick={() => publishRoster("renotify")}>
									<BellRing size={16} /> Erneut informieren
								</button>
							)}
							<button className="button button-primary" disabled={publishing || !teams.length} onClick={() => publishRoster("publish")}>
								<Send size={16} /> {tournament.rosterPublishedAt ? "Änderungen veröffentlichen" : "Roster veröffentlichen"}
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
									<UsersRound size={17} /> Bewerber-Pool
								</span>
								<strong>{availableApplications.length}</strong>
							</header>
							<p>Freie Plätze werden aus diesen verifizierten Solo-Anmeldungen besetzt.</p>
							<div className="admin-applicant-stack">
								{availableApplications.map((application) => {
									const group = groupByUserId.get(application.userId);
									return (
										<div className="admin-applicant-chip" key={application.id}>
											<strong>{application.riotId}</strong>
											<span>{application.role || "Rolle frei"}</span>
											{group && (
												<small title={group.inviteCode}>
													<Flower2 size={12} /> {group.name}
												</small>
											)}
										</div>
									);
								})}
								{!availableApplications.length && <span className="admin-pool-empty">Alle aktiven Bewerber sind zugewiesen.</span>}
							</div>
							<div className="admin-pool-disclosure">
								<Flower2 size={15} />
								<span>Wunschgruppen sind ein Einteilungswunsch. Ausgeglichene Teamstärke hat Vorrang.</span>
							</div>
						</aside>
						<div className="admin-roster-main">
							<div className="admin-roster-statusline">
								<span>
									{teams.length} Teams · {teams.reduce((sum, team) => sum + team.members.length, 0)} zugewiesen
								</span>
								<strong>
									{tournament.rosterPublishedAt
										? tournament.rosterDirty
											? "Unveröffentlichte Änderungen"
											: "Roster veröffentlicht"
										: "Entwurf, öffentlich noch unsichtbar"}
								</strong>
							</div>
							<div className="admin-roster-grid">
								{teams.map((team) => (
									<article className="admin-team-sheet" key={team.id}>
										<header>
											<div>
												<small>
													Seed {team.seed} · {team.members.length}/{teamSize}
												</small>
												<h2>{team.name}</h2>
											</div>
											<button className="icon-action" onClick={() => setDialog({ edit: team })} title="Name und Seed bearbeiten">
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
														<strong>{member?.name || "Freien Platz besetzen"}</strong>
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
											<span className={`status-pill ${team.discordManaged ? "registration" : ""}`}>
												{team.discordManaged ? "Discord verwaltet" : "Nur Website"}
											</span>
											<span>{team.published ? "Öffentlich" : "Entwurf"}</span>
										</footer>
									</article>
								))}
								{teams.length === 0 && (
									<div className="empty-state">
										<Users size={36} />
										<h3>Noch keine Teams</h3>
										<p>Lege zuerst ein Team an. Danach werden Spieler einzeln über ihre Rolle zugewiesen.</p>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{tab === "applications" && (
					<div className="admin-application-list">
						{applications.map((application) => (
							<article className="admin-application-sheet" key={application.id}>
								<header>
									<div>
										<small>Solo-Anmeldung{groupByUserId.get(application.userId) ? ` · Wunschgruppe ${groupByUserId.get(application.userId)?.name}` : ""}</small>
										<h2>{application.riotId}</h2>
									</div>
									<span
										className={`status-pill ${application.status === "accepted" ? "registration" : application.status === "rejected" ? "completed" : "announcement"}`}
									>
										{application.status}
									</span>
								</header>
								<div className="admin-application-connections">
									<span>Discord: {application.discordId || "fehlt"}</span>
									<span>Twitch: {application.twitchId || "fehlt"}</span>
									{application.role && <span>Rolle: {application.role}</span>}
									<span>Bot-DMs: {application.discordDmOptIn ? "aktiv" : "aus"}</span>
									{application.teamId && <span>Bereits zugewiesen</span>}
								</div>
								<p>{application.note}</p>
								<footer>
									<button className="button button-secondary button-small" onClick={() => reviewApplication(application.id, "waitlisted")}>
										Warteliste
									</button>
									<button className="button button-secondary button-small" onClick={() => reviewApplication(application.id, "rejected")}>
										Ablehnen
									</button>
									<button className="button button-primary button-small" onClick={() => reviewApplication(application.id, "accepted")}>
										<Check size={14} /> Annehmen
									</button>
								</footer>
							</article>
						))}
						{applications.length === 0 && (
							<div className="empty-state">
								<ClipboardList size={36} />
								<h3>Noch keine Anmeldungen</h3>
								<p>Neue Einzel- und Teambewerbungen erscheinen nach dem Öffnen der Anmeldung hier.</p>
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
											<strong>Paarungen der ersten Runde</strong>
											<small>Jedes Team genau einmal zuweisen</small>
										</span>
									</div>
									<button className="button button-secondary button-small" type="submit">
										<Check size={14} /> Paarungen speichern
									</button>
								</header>
								<div className="admin-pairing-grid">
									{firstRoundMatches.map((match) => (
										<fieldset key={`${match.id}-${match.teamAId}-${match.teamBId}`}>
											<legend>Match {match.position}</legend>
											<select aria-label={`Erstes Team in Match ${match.position}`} defaultValue={match.teamAId || ""} name={`teamA-${match.id}`} required>
												<option value="" disabled>
													Team auswählen
												</option>
												{teams.map((team) => (
													<option value={team.id} key={team.id}>
														{team.name}
													</option>
												))}
											</select>
											<span>gegen</span>
											<select aria-label={`Zweites Team in Match ${match.position}`} defaultValue={match.teamBId || ""} name={`teamB-${match.id}`} required>
												<option value="" disabled>
													Team auswählen
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
											<small>{matchLabel(match)}</small>
											<strong>
												{match.teamAId ? names.get(match.teamAId) : "Noch offen"} <span>gegen</span>{" "}
												{match.teamBId ? names.get(match.teamBId) : "Noch offen"}
											</strong>
										</div>
										<form onSubmit={(event) => saveResult(event, match)}>
											<input aria-label="Punkte Team A" defaultValue={match.scoreA} disabled={!ready} max={winsNeeded} min="0" name="scoreA" type="number" />
											<span>:</span>
											<input aria-label="Punkte Team B" defaultValue={match.scoreB} disabled={!ready} max={winsNeeded} min="0" name="scoreB" type="number" />
											<button className="button button-primary button-small" disabled={!ready} type="submit">
												<Check size={14} /> Speichern
											</button>
										</form>
									</article>
								);
							})}
							{matches.length === 0 && (
								<div className="empty-state">
									<Clock3 size={36} />
									<h3>Der Turnierbaum wartet auf die finalen Teams</h3>
									<p>
										{tournament.bracketType === "double_elimination"
											? "Sobald 4, 8, 16 oder 32 Teams bestätigt sind, kann der vollständige Double-Elimination-Baum erstellt werden."
											: "Sobald alle Teams feststehen, werden die Paarungen hier vorbereitet."}
									</p>
									{tournament.bracketType === "double_elimination" && (
										<button className="button button-primary" onClick={generateBracket} type="button">
											<Swords size={15} /> Turnierbaum aus {teams.length} Teams erstellen
										</button>
									)}
								</div>
							)}
						</div>
					</>
				)}

				{tab === "settings" && (
					<form className="admin-tournament-settings" onSubmit={saveSettings}>
						<div>
							<span className="kicker">Turnierstatus</span>
							<h2>Anmeldung und Format freigeben</h2>
							<p>Teamlimit und Serienformat können offen bleiben, bis die Anmeldezahlen feststehen.</p>
						</div>
						<label>
							Status
							<select name="status" defaultValue={tournament.status || "announcement"}>
								<option value="announcement">Ankündigung</option>
								<option value="registration">Anmeldung</option>
								<option value="live">Läuft</option>
								<option value="completed">Abgeschlossen</option>
							</select>
						</label>
						<label>
							Maximale Teams
							<input name="maxTeams" type="number" min="2" max="128" defaultValue={tournament.maxTeams || ""} placeholder="Noch offen" />
						</label>
						<label>
							Serienformat
							<select name="seriesBestOf" defaultValue={tournament.seriesBestOf || ""}>
								<option value="">Noch offen</option>
								<option value="1">Best of 1</option>
								<option value="3">Best of 3</option>
								<option value="5">Best of 5</option>
							</select>
						</label>
						<label className="settings-note">
							Hinweis zur Anmeldung
							<textarea name="registrationNote" defaultValue={tournament.registrationNote || ""} />
						</label>
						<label className="form-checkbox settings-open">
							<input name="registrationOpen" type="checkbox" defaultChecked={tournament.registrationOpen} />
							<span>Anmeldung öffentlich öffnen</span>
						</label>
						<button className="button button-primary" type="submit">
							<Check size={15} /> Einstellungen speichern
						</button>
					</form>
				)}
			</section>

			{dialog === "team" && (
				<Modal title="Neues Team" onClose={() => setDialog(null)}>
					<form className="roster-form" onSubmit={createTeam}>
						<label>
							Teamname
							<input name="name" required autoFocus />
						</label>
						<label>
							Seed
							<input name="seed" type="number" min="1" defaultValue={teams.length + 1} required />
						</label>
						<label className="form-checkbox">
							<input name="createDiscordResources" type="checkbox" />
							<span>Discord-Rolle sowie private Text- und Voice-Kanäle über die Queue anlegen.</span>
						</label>
						<button className="button button-primary" type="submit">
							Team erstellen
						</button>
					</form>
				</Modal>
			)}
			{dialog && typeof dialog === "object" && "edit" in dialog && (
				<Modal title="Team bearbeiten" onClose={() => setDialog(null)}>
					<form className="roster-form" onSubmit={(event) => editTeam(event, dialog.edit)}>
						<label>
							Teamname
							<input name="name" defaultValue={dialog.edit.name} required autoFocus />
						</label>
						<label>
							Seed
							<input name="seed" type="number" min="1" defaultValue={dialog.edit.seed} required />
						</label>
						<p className="muted-note">Bei Discord-verwalteten Teams werden Rolle und Kanäle zeitversetzt über die Queue umbenannt.</p>
						<button className="button button-primary" type="submit">
							Änderungen speichern
						</button>
					</form>
				</Modal>
			)}
			{dialog && typeof dialog === "object" && "team" in dialog && (
				<Modal title={`${dialog.role} besetzen`} onClose={() => setDialog(null)}>
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
										<span className="kicker">Aktuelle Zuweisung</span>
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
										<UserMinus size={15} /> Aus Team entfernen
									</button>
								</div>
							);
						return (
							<div className="roster-candidate-list">
								<p>Wähle eine Solo-Anmeldung für diesen freien Platz aus.</p>
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
													{application.role || "Rolle frei"}
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
										<h3>Niemand verfügbar</h3>
										<p>Für diesen Platz gibt es aktuell keine passende, unzugewiesene Anmeldung.</p>
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
