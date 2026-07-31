"use client";

import Link from "next/link";
import useSWR from "swr";
import { Archive, ArrowRight, CalendarDays, Crown, ShieldCheck, Swords, Trophy } from "lucide-react";
import { PageHero } from "@/components/PageHero";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

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
};

const labels = {
	announcement: "In Planung",
	registration: "Anmeldung offen",
	live: "Läuft gerade",
	completed: "Im Archiv",
};

function TournamentCard({ tournament }: { tournament: Tournament }) {
	const date = tournament.date
		? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(tournament.date))
		: "Termin folgt";

	return (
		<Link className="tournament-card" href={`/tournaments/${tournament.id}`}>
			<div className="tournament-card-meta">
				<span className={`status-pill ${tournament.status}`}>{labels[tournament.status]}</span>
				<span>{date}</span>
			</div>
			<span className="tournament-game">{tournament.game}</span>
			<h3>{tournament.title}</h3>
			<p>{tournament.format}</p>
			<div className="tournament-card-footer">
				<span>{tournament.currentTeams} / {tournament.maxTeams} Teams</span>
				<strong>Turnier öffnen <ArrowRight size={15} /></strong>
			</div>
		</Link>
	);
}

function TournamentCollection({ title, copy, tournaments, icon: Icon }: { title: string; copy: string; tournaments: Tournament[]; icon: typeof Trophy }) {
	return (
		<section className="content-band">
			<div className="section-heading with-icon">
				<Icon size={25} />
				<div><h2>{title}</h2><p>{copy}</p></div>
			</div>
			{tournaments.length ? (
				<div className="tournament-hub-grid">{tournaments.map((tournament) => <TournamentCard tournament={tournament} key={tournament.id} />)}</div>
			) : (
				<div className="empty-state compact-empty"><Icon size={30} /><h3>Gerade ist hier noch Platz</h3><p>Neue Turniere erscheinen automatisch, sobald die Turnierleitung sie veröffentlicht.</p></div>
			)}
		</section>
	);
}

export default function TournamentsPage() {
	const { data, isLoading } = useSWR<{ tournaments: Tournament[] }>("/api/tournaments", fetcher);
	const tournaments = data?.tournaments || [];
	const current = tournaments.filter((item) => item.status === "live" || item.status === "registration");
	const upcoming = tournaments.filter((item) => item.status === "announcement");
	const archive = tournaments.filter((item) => item.status === "completed");

	return (
		<>
			<PageHero
				kicker="N4cht4r4 Turnierhub"
				title="Von der Anmeldung bis zum Finale."
				copy="Alle League-Turniere erhalten hier ihren eigenen Platz: mit Teams, Spielplan, Playoff-Baum, Regeln, Ergebnissen und Stream-Overlays."
				icon={<Trophy size={44} strokeWidth={1.6} />}
			>
				<a className="button button-primary" href="#aktuell"><Swords size={17} /> Turniere entdecken</a>
			</PageHero>

			<section className="content-band tournament-principles">
				<div><Crown size={20} /><strong>Ein Portal</strong><span>für alle zukünftigen Formate</span></div>
				<div><ShieldCheck size={20} /><strong>Faire Teilnahme</strong><span>mit Discord und Riot-Verifizierung</span></div>
				<div><Swords size={20} /><strong>Live gepflegt</strong><span>Ergebnisse und Bracket in Echtzeit</span></div>
			</section>

			<div id="aktuell">
				{isLoading ? <section className="content-band"><div className="skeleton portal-skeleton" /></section> : (
					<>
						<TournamentCollection title="Aktuell" copy="Offene Anmeldungen und laufende Events." tournaments={current} icon={Trophy} />
						<TournamentCollection title="Als Nächstes" copy="Angekündigte Turniere, deren Details gerade vorbereitet werden." tournaments={upcoming} icon={CalendarDays} />
						<TournamentCollection title="Archiv" copy="Vergangene Turniere mit ihren Teams, Ergebnissen und Siegerwegen." tournaments={archive} icon={Archive} />
					</>
				)}
			</div>
		</>
	);
}
