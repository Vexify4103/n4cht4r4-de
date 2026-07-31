"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Check, Clock3, Crown, Flower2, Pencil, Plus, ShieldAlert, Shuffle, Swords, Users, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(async (response) => {
	if (!response.ok) throw new Error(await response.text());
	return response.json();
});
const roles = ["Top", "Jungle", "Mid", "Bot", "Support"];
type Tab = "teams" | "matches";
type Tournament = { id: string; title: string; format: string; maxTeams: number; seriesBestOf?: number; status?: string };
type Member = { name: string; role?: string };
type Team = { id: string; name: string; seed: number; members: Member[]; discordManaged?: boolean };
type Match = {
	id: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	status?: string;
};

function matchLabel(match: Match) {
	if (match.placement === "third_place") return "Spiel um Platz 3";
	if (match.round === 1) return "Halbfinale";
	return "Finale";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<div className="roster-modal-backdrop" onMouseDown={onClose}>
			<section className="roster-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
				<header><div><Flower2 size={18} /><h2>{title}</h2></div><button className="icon-action" onClick={onClose} type="button" title="Schließen"><X size={18} /></button></header>
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
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data: tournamentData } = useSWR<{ tournament: Tournament }>(access ? `/api/admin/tournaments/${id}` : null, fetcher);
	const { data: teamsData, mutate: refreshTeams } = useSWR<{ teams: Team[] }>(access ? `/api/admin/tournaments/${id}/teams` : null, fetcher);
	const { data: matchesData, mutate: refreshMatches } = useSWR<{ matches: Match[] }>(access ? `/api/admin/tournaments/${id}/matches` : null, fetcher);
	const tournament = tournamentData?.tournament;
	const teams = teamsData?.teams || [];
	const matches = matchesData?.matches || [];
	const names = new Map(teams.map((team) => [team.id, team.name]));
	const winsNeeded = Math.ceil((tournament?.seriesBestOf || 3) / 2);

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
			setNotice(result.discordJobQueued ? "Team gespeichert. Discord-Rolle und Kanäle wurden in die Queue gelegt." : "Team gespeichert. Du kannst jetzt die Rollen besetzen.");
		} catch (error) { setNotice(error instanceof Error ? error.message : "Team konnte nicht angelegt werden."); }
	}

	async function editTeam(event: FormEvent<HTMLFormElement>, team: Team) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await request(`/api/admin/tournaments/${id}/teams`, "PATCH", { teamId: team.id, name: form.get("name"), seed: Number(form.get("seed")) });
			await refreshTeams();
			setDialog(null);
			setNotice(result.discordRenameJobsQueued ? "Team gespeichert. Die Discord-Umbenennungen laufen nacheinander über die Queue." : "Teamname und Seed wurden gespeichert.");
		} catch (error) { setNotice(error instanceof Error ? error.message : "Team konnte nicht gespeichert werden."); }
	}

	async function assignPlayer(event: FormEvent<HTMLFormElement>, team: Team, role: string) {
		event.preventDefault();
		const riotId = String(new FormData(event.currentTarget).get("riotId") || "").trim();
		const members = team.members.filter((member) => member.role?.toLowerCase() !== role.toLowerCase());
		members.push({ name: riotId, role });
		try {
			await request(`/api/admin/tournaments/${id}/teams`, "PATCH", { teamId: team.id, members });
			await refreshTeams();
			setDialog(null);
			setNotice(`${role} bei ${team.name} wurde gespeichert.`);
		} catch (error) { setNotice(error instanceof Error ? error.message : "Spieler konnte nicht gespeichert werden."); }
	}

	async function saveResult(event: FormEvent<HTMLFormElement>, match: Match) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await request(`/api/admin/tournaments/${id}/matches`, "PATCH", { matchId: match.id, scoreA: Number(form.get("scoreA")), scoreB: Number(form.get("scoreB")) });
			await refreshMatches();
			setNotice("Ergebnis gespeichert. Das Siegerteam wurde automatisch in die nächste Runde gesetzt.");
		} catch (error) { setNotice(error instanceof Error ? error.message : "Ergebnis konnte nicht gespeichert werden."); }
	}

	async function savePairings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const firstRoundMatches = matches.filter((match) => match.stage === "playoff" && match.round === 1 && !match.placement);
		const pairings = firstRoundMatches.map((match) => ({
			matchId: match.id,
			teamAId: String(form.get(`teamA-${match.id}`) || ""),
			teamBId: String(form.get(`teamB-${match.id}`) || ""),
		}));
		try {
			await request(`/api/admin/tournaments/${id}/matches`, "PATCH", { action: "pairings", pairings });
			await refreshMatches();
			setNotice("Die Paarungen wurden gespeichert. Finale und Spiel um Platz 3 werden aus den Ergebnissen neu aufgebaut.");
		} catch (error) { setNotice(error instanceof Error ? error.message : "Paarungen konnten nicht gespeichert werden."); }
	}

	if (accessError) return <section className="content-band"><div className="empty-state"><ShieldAlert size={40} /><h3>Kein Turnierzugriff</h3><p>Dein Discord-Konto ist nicht als Turnier-Team hinterlegt.</p></div></section>;
	if (!access || !tournament) return <section className="content-band"><div className="skeleton admin-workspace-skeleton" /></section>;

	return (
		<>
			<section className="admin-detail-hero">
				<Link className="admin-back-link" href="/admin/tournaments"><ArrowLeft size={15} /> Turnierakte</Link>
				<div><span className="kicker">Turnierleitung · {access.role}</span><h1>{tournament.title}</h1><p>{tournament.format} · {tournament.maxTeams} Teams · Best of {tournament.seriesBestOf || 3}</p></div>
				<span className="admin-hero-flower"><Crown size={28} /></span>
			</section>

			<section className="content-band admin-workbench">
				<div className="admin-workbench-bar">
					<div className="tab-nav">
						<button className={`tab-btn ${tab === "teams" ? "active" : ""}`} onClick={() => setTab("teams")}><Users size={16} /> Roster</button>
						<button className={`tab-btn ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}><Swords size={16} /> Ergebnisse</button>
					</div>
					{tab === "teams" && <button className="button button-primary" onClick={() => setDialog("team")}><Plus size={16} /> Team anlegen</button>}
				</div>
				{notice && <p className="admin-notice"><Flower2 size={15} /> {notice}</p>}

				{tab === "teams" && (
					<div className="admin-roster-grid">
						{teams.map((team) => (
							<article className="admin-team-sheet" key={team.id}>
								<header><div><small>Seed {team.seed}</small><h2>{team.name}</h2></div><button className="icon-action" onClick={() => setDialog({ edit: team })} title="Name und Seed bearbeiten"><Pencil size={16} /></button></header>
								<div className="admin-team-slots">
									{roles.map((role) => {
										const member = team.members.find((entry) => entry.role?.toLowerCase() === role.toLowerCase());
										return <button className={`admin-role-slot ${member ? "filled" : ""}`} key={role} onClick={() => setDialog({ team, role })}><span>{role}</span><strong>{member?.name || "Freien Platz besetzen"}</strong><Plus size={14} /></button>;
									})}
								</div>
								<footer><span className={`status-pill ${team.discordManaged ? "registration" : ""}`}>{team.discordManaged ? "Discord verwaltet" : "Nur Website"}</span></footer>
							</article>
						))}
						{teams.length === 0 && <div className="empty-state"><Users size={36} /><h3>Noch keine Teams</h3><p>Lege zuerst ein Team an. Danach werden Spieler einzeln über ihre Rolle zugewiesen.</p></div>}
					</div>
				)}

				{tab === "matches" && (
					<>
						<form className="admin-pairing-editor" onSubmit={savePairings}>
							<header>
								<div><Shuffle size={18} /><span><strong>Halbfinal-Paarungen</strong><small>Jedes Team genau einmal zuweisen</small></span></div>
								<button className="button button-secondary button-small" type="submit"><Check size={14} /> Paarungen speichern</button>
							</header>
							<div className="admin-pairing-grid">
								{matches.filter((match) => match.stage === "playoff" && match.round === 1 && !match.placement).map((match) => (
									<fieldset key={`${match.id}-${match.teamAId}-${match.teamBId}`}>
										<legend>Halbfinale {match.position}</legend>
										<select aria-label={`Erstes Team in Halbfinale ${match.position}`} defaultValue={match.teamAId || ""} name={`teamA-${match.id}`} required>
											<option value="" disabled>Team auswählen</option>
											{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
										</select>
										<span>gegen</span>
										<select aria-label={`Zweites Team in Halbfinale ${match.position}`} defaultValue={match.teamBId || ""} name={`teamB-${match.id}`} required>
											<option value="" disabled>Team auswählen</option>
											{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
										</select>
									</fieldset>
								))}
							</div>
						</form>
						<div className="admin-results">
							{matches.map((match) => {
								const ready = Boolean(match.teamAId && match.teamBId);
								return (
									<article className={`admin-match-sheet ${match.placement === "third_place" ? "is-placement" : ""}`} key={`${match.id}-${match.teamAId}-${match.teamBId}-${match.scoreA}-${match.scoreB}`}>
										<div><small>{matchLabel(match)}</small><strong>{match.teamAId ? names.get(match.teamAId) : "Noch offen"} <span>gegen</span> {match.teamBId ? names.get(match.teamBId) : "Noch offen"}</strong></div>
										<form onSubmit={(event) => saveResult(event, match)}>
											<input aria-label="Punkte Team A" defaultValue={match.scoreA} disabled={!ready} max={winsNeeded} min="0" name="scoreA" type="number" />
											<span>:</span>
											<input aria-label="Punkte Team B" defaultValue={match.scoreB} disabled={!ready} max={winsNeeded} min="0" name="scoreB" type="number" />
											<button className="button button-primary button-small" disabled={!ready} type="submit"><Check size={14} /> Speichern</button>
										</form>
									</article>
								);
							})}
							{matches.length === 0 && <div className="empty-state"><Clock3 size={36} /><h3>Der Turnierbaum wartet auf vier Teams</h3><p>Nach dem vierten Team werden Halbfinale und Finale automatisch angelegt.</p></div>}
						</div>
					</>
				)}
			</section>

			{dialog === "team" && <Modal title="Neues Team" onClose={() => setDialog(null)}><form className="roster-form" onSubmit={createTeam}><label>Teamname<input name="name" required autoFocus /></label><label>Seed<input name="seed" type="number" min="1" defaultValue={teams.length + 1} required /></label><label className="form-checkbox"><input name="createDiscordResources" type="checkbox" /><span>Discord-Rolle sowie private Text- und Voice-Kanäle über die Queue anlegen.</span></label><button className="button button-primary" type="submit">Team erstellen</button></form></Modal>}
			{dialog && typeof dialog === "object" && "edit" in dialog && <Modal title="Team bearbeiten" onClose={() => setDialog(null)}><form className="roster-form" onSubmit={(event) => editTeam(event, dialog.edit)}><label>Teamname<input name="name" defaultValue={dialog.edit.name} required autoFocus /></label><label>Seed<input name="seed" type="number" min="1" defaultValue={dialog.edit.seed} required /></label><p className="muted-note">Bei Discord-verwalteten Teams werden Rolle und Kanäle zeitversetzt über die Queue umbenannt.</p><button className="button button-primary" type="submit">Änderungen speichern</button></form></Modal>}
			{dialog && typeof dialog === "object" && "team" in dialog && <Modal title={`${dialog.role} besetzen`} onClose={() => setDialog(null)}><form className="roster-form" onSubmit={(event) => assignPlayer(event, dialog.team, dialog.role)}><label>Riot-ID mit Tag<input name="riotId" placeholder="Name#EUW" defaultValue={dialog.team.members.find((member) => member.role?.toLowerCase() === dialog.role.toLowerCase())?.name || ""} required autoFocus /></label><p className="muted-note">Später erscheint hier zusätzlich die gefilterte Liste der Bewerber für diese Rolle.</p><button className="button button-primary" type="submit">Spieler speichern</button></form></Modal>}
		</>
	);
}
