"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { CalendarDays, Swords, Users } from "lucide-react";
import { TournamentHeader } from "@/components/TournamentHeader";
import { PublicTeam, TournamentTeamCard } from "@/components/TournamentTeamCard";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type View = "schedule" | "groups" | "playoffs" | "teams" | "rules";
type Match = {
	id: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	groupId?: string;
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId?: string | null;
	scoreA: number;
	scoreB: number;
	status: string;
	scheduledAt: string | null;
};
type Standing = { groupId?: string; rank: number; teamId: string; teamName: string; wins: number; losses: number; points: number };

function matchLabel(match: Match) {
	if (match.placement === "third_place") return "Spiel um Platz 3";
	if (match.stage === "group") return `Runde ${match.round}`;
	if (match.round === 1) return "Halbfinale";
	return "Finale";
}

const viewMeta = {
	schedule: { kicker: "Spielplan", title: "Alle Paarungen und Termine", copy: "Ansetzungen, Startzeiten und Ergebnisse werden hier von der Turnierleitung aktualisiert." },
	groups: { kicker: "Gruppenphase", title: "Tabellen und Gruppen", copy: "Alle Gruppen, Siege und Platzierungen auf einen Blick." },
	playoffs: { kicker: "Playoffs", title: "Der Weg bis ins Finale", copy: "Ein visueller Turnierbaum zeigt Paarungen, Ergebnisse und das Weiterkommen." },
	teams: { kicker: "Teilnehmerfeld", title: "Teams und ihre Kader", copy: "Riot-IDs, op.gg-Profile, Team-Multisearch und kopierbare OBS-Karten für Streamer." },
	rules: { kicker: "Regelwerk", title: "Fair spielen, gemeinsam Spaß haben", copy: "Das vollständige Regelwerk für Teilnehmer, Streamer und Zuschauer." },
};

function MatchSchedule({ matches, names }: { matches: Match[]; names: Map<string, string> }) {
	if (!matches.length) return <Empty icon={CalendarDays} title="Noch keine Matches angesetzt" copy="Die Turnierleitung veröffentlicht den Spielplan, sobald alle Paarungen feststehen." />;
	return (
		<div className="match-list">
			{matches.map((match) => (
				<article className="match-row" key={match.id}>
					<div><small>{matchLabel(match)}</small><time>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "Termin folgt"}</time></div>
					<strong>{match.teamAId ? names.get(match.teamAId) || "Team A" : "Noch offen"}</strong>
					<b>{match.status === "completed" ? `${match.scoreA} : ${match.scoreB}` : "vs."}</b>
					<strong>{match.teamBId ? names.get(match.teamBId) || "Team B" : "Noch offen"}</strong>
					<span className={`status-pill ${match.status === "completed" ? "completed" : ""}`}>{match.status === "completed" ? "Beendet" : "Geplant"}</span>
				</article>
			))}
		</div>
	);
}

function Bracket({ matches, names }: { matches: Match[]; names: Map<string, string> }) {
	if (!matches.length) return <Empty icon={Swords} title="Der Turnierbaum wird vorbereitet" copy="Sobald die Paarungen gesetzt sind, erscheinen Halbfinale und Finale hier automatisch." />;
	const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
	return (
		<div className="visual-bracket">
			{rounds.map((round, roundIndex) => (
				<section className="bracket-column" key={round}>
					<header><span>Runde {round}</span><h2>{roundIndex === rounds.length - 1 ? "Finale" : rounds.length === 2 ? "Halbfinale" : `Runde ${round}`}</h2></header>
					<div className="bracket-column-matches">
						{matches.filter((match) => match.round === round).map((match) => (
							<article className={`bracket-match ${match.placement === "third_place" ? "is-placement" : ""}`} key={match.id}>
								<small className="bracket-match-label">{matchLabel(match)}</small>
								<div className={match.winnerTeamId && match.winnerTeamId === match.teamAId ? "winner" : ""}>
									<span>{match.teamAId ? names.get(match.teamAId) || "Team A" : "Noch offen"}</span><b>{match.status === "completed" ? match.scoreA : "–"}</b>
								</div>
								<div className={match.winnerTeamId && match.winnerTeamId === match.teamBId ? "winner" : ""}>
									<span>{match.teamBId ? names.get(match.teamBId) || "Team B" : "Noch offen"}</span><b>{match.status === "completed" ? match.scoreB : "–"}</b>
								</div>
							</article>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

function Empty({ icon: Icon, title, copy }: { icon: typeof Swords; title: string; copy: string }) {
	return <div className="empty-state"><Icon size={36} /><h3>{title}</h3><p>{copy}</p></div>;
}

export function TournamentPublicView({ view }: { view: View }) {
	const { id } = useParams<{ id: string }>();
	const { data: tournamentData } = useSWR<{ tournament: { title: string; rules: string[]; game: string } }>(`/api/tournaments/${id}`, fetcher);
	const { data: teamsData } = useSWR<{ teams: PublicTeam[] }>(`/api/tournaments/${id}/teams`, fetcher);
	const { data: matchesData } = useSWR<{ matches: Match[] }>(`/api/tournaments/${id}/matches`, fetcher);
	const { data: groupsData } = useSWR<{ groups: { id: string; name: string }[]; standings: Standing[] }>(`/api/tournaments/${id}/groups`, fetcher);
	const teams = teamsData?.teams || [];
	const matches = matchesData?.matches || [];
	const names = new Map(teams.map((team) => [team.id, team.name]));
	const meta = viewMeta[view];

	return (
		<>
			<TournamentHeader
				id={id}
				active={view}
				kicker={`${tournamentData?.tournament.title || "Turnier"} · ${meta.kicker}`}
				title={meta.title}
				copy={meta.copy}
			/>
			<section className="content-band tournament-view">
				{view === "schedule" && <MatchSchedule matches={matches} names={names} />}
				{view === "playoffs" && <Bracket matches={matches.filter((match) => match.stage === "playoff")} names={names} />}
				{view === "teams" && (teams.length
					? <div className="tournament-team-grid">{teams.map((team) => <TournamentTeamCard tournamentId={id} team={team} key={team.id} />)}</div>
					: <Empty icon={Users} title="Noch keine Teams veröffentlicht" copy="Bestätigte Kader erscheinen nach der Freigabe durch die Turnierleitung." />)}
				{view === "groups" && ((groupsData?.groups || []).length
					? <div className="groups-grid">{groupsData?.groups.map((group) => (
						<article className="group-table" key={group.id}>
							<h2>{group.name}</h2>
							{(groupsData.standings || []).filter((standing) => standing.groupId === group.id).map((standing) => (
								<div className="standings-row" key={standing.teamId}><span>#{standing.rank}</span><strong>{standing.teamName}</strong><span>{standing.wins} S</span><span>{standing.points} P</span></div>
							))}
						</article>
					))}</div>
					: <Empty icon={Users} title="Dieses Turnier hat keine Gruppen" copy="Bei einem reinen Playoff-Format führt der Weg direkt in den Turnierbaum." />)}
				{view === "rules" && (
					<div className="tournament-rules">
						{(tournamentData?.tournament.rules || []).map((rule, index) => rule.startsWith("## ")
							? <h2 key={`${rule}-${index}`}>{rule.slice(3)}</h2>
							: <div className="rule-item" key={`${rule}-${index}`}><span className="rule-number">{String(index + 1).padStart(2, "0")}</span><span className="rule-text">{rule}</span></div>)}
					</div>
				)}
			</section>
		</>
	);
}
