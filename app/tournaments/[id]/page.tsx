"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Check, Clock3, ShieldCheck, Swords, Users } from "lucide-react";
import { TournamentHeader } from "@/components/TournamentHeader";
import { PublicTeam, TournamentTeamCard } from "@/components/TournamentTeamCard";

const fetcher = (url: string) => fetch(url).then(async (response) => {
	if (!response.ok) throw new Error("not found");
	return response.json();
});

type Tournament = {
	id: string;
	title: string;
	game: string;
	format: string;
	status: "announcement" | "registration" | "live" | "completed";
	date: string | null;
	maxTeams: number;
	currentTeams: number;
	registrationOpen?: boolean;
	rules: string[];
};

type Match = {
	id: string;
	stage: string;
	round: number;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	status: string;
	scheduledAt: string | null;
};

const statusLabel = {
	announcement: "In Planung",
	registration: "Anmeldung offen",
	live: "Läuft gerade",
	completed: "Abgeschlossen",
};

export default function TournamentDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { data, error } = useSWR<{ tournament: Tournament }>(`/api/tournaments/${id}`, fetcher);
	const { data: teamData } = useSWR<{ teams: PublicTeam[] }>(`/api/tournaments/${id}/teams`, fetcher);
	const { data: matchData } = useSWR<{ matches: Match[] }>(`/api/tournaments/${id}/matches`, fetcher);

	if (error) return <section className="content-band"><div className="empty-state"><Swords size={38} /><h3>Turnier nicht gefunden</h3><p>Vielleicht wurde es noch nicht veröffentlicht.</p><Link className="text-link" href="/tournaments">Zum Turnierhub</Link></div></section>;
	if (!data) return <section className="content-band"><div className="skeleton portal-skeleton" /></section>;

	const tournament = data.tournament;
	const teams = teamData?.teams || [];
	const nextMatch = (matchData?.matches || []).find((match) => match.status !== "completed" && match.teamAId && match.teamBId);
	const teamNames = new Map(teams.map((team) => [team.id, team.name]));
	const date = tournament.date
		? new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(tournament.date))
		: "Termin folgt";

	return (
		<>
			<TournamentHeader
				id={id}
				kicker={`${statusLabel[tournament.status]} · ${tournament.game}`}
				title={tournament.title}
				copy={`${tournament.format} · ${date}`}
			/>

			<section className="content-band tournament-facts">
				<div><CalendarDays size={20} /><span>Termin</span><strong>{date}</strong></div>
				<div><Users size={20} /><span>Teilnehmerfeld</span><strong>{tournament.currentTeams} von {tournament.maxTeams} Teams</strong></div>
				<div><Swords size={20} /><span>Format</span><strong>{tournament.format}</strong></div>
				<div><ShieldCheck size={20} /><span>Anmeldung</span><strong>{tournament.registrationOpen ? "Geöffnet" : "Geschlossen"}</strong></div>
			</section>

			<section className="content-band tournament-overview-grid">
				<article className="tournament-story">
					<span className="kicker">Turnierstand</span>
					<h2>{tournament.registrationOpen ? "Dein Platz im Turnier wartet." : "Die Teams stehen. Jetzt wartet das Turnier auf seinen Start."}</h2>
					<p>{tournament.registrationOpen
						? "Für deine Bewerbung brauchst du ein Discord-Konto und eine verifizierte Riot-ID. Beides kannst du direkt im Ablauf verbinden."
						: "Alle Kader wurden bestätigt. Die Turnierleitung pflegt hier Paarungen, Ergebnisse und den Weg bis ins Finale."}</p>
					{tournament.registrationOpen ? (
						<Link className="button button-primary" href={`/tournaments/${id}/apply`}><Check size={16} /> Jetzt bewerben</Link>
					) : (
						<Link className="button button-secondary" href={`/tournaments/${id}/playoffs`}><Swords size={16} /> Playoff-Baum ansehen</Link>
					)}
				</article>

				<aside className="next-match-panel">
					<span className="kicker">Als Nächstes</span>
					{nextMatch ? (
						<>
							<small>Runde {nextMatch.round}</small>
							<div className="next-match-teams">
								<strong>{teamNames.get(nextMatch.teamAId || "") || "Team A"}</strong>
								<span>gegen</span>
								<strong>{teamNames.get(nextMatch.teamBId || "") || "Team B"}</strong>
							</div>
							<p><Clock3 size={15} /> {nextMatch.scheduledAt ? new Date(nextMatch.scheduledAt).toLocaleString("de-DE") : "Termin wird bekannt gegeben"}</p>
						</>
					) : (
						<div className="quiet-state"><Clock3 size={25} /><p>Die nächste Paarung wird von der Turnierleitung veröffentlicht.</p></div>
					)}
					<Link className="text-link" href={`/tournaments/${id}/schedule`}>Ganzer Spielplan <ArrowRight size={14} /></Link>
				</aside>
			</section>

			<section className="content-band">
				<div className="section-heading section-heading-row">
					<div><span>Bestätigte Teams</span><h2>Die Kader im Turnier</h2></div>
					<Link className="text-link" href={`/tournaments/${id}/teams`}>Alle Teams und Stream-Links <ArrowRight size={14} /></Link>
				</div>
				{teams.length ? (
					<div className="tournament-team-grid">{teams.slice(0, 4).map((team) => <TournamentTeamCard tournamentId={id} team={team} key={team.id} />)}</div>
				) : <div className="empty-state compact-empty"><Users size={30} /><h3>Noch keine Teams veröffentlicht</h3><p>Bestätigte Kader erscheinen hier automatisch.</p></div>}
			</section>

			<section className="callout-band">
				<ShieldCheck size={27} />
				<div><h2>Regeln vor dem ersten Match lesen</h2><p>Fairplay, Stream-Verhalten und Fearless Draft sind im vollständigen Regelwerk festgehalten.</p></div>
				<Link className="button button-secondary" href={`/tournaments/${id}/rules`}>Regelwerk öffnen</Link>
			</section>
		</>
	);
}
