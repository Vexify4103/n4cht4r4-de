"use client";

import Link from "next/link";
import useSWR from "swr";
import { Archive, ArrowRight, CalendarDays, Crown, ShieldCheck, Swords, Trophy } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Tournament = {
	id: string;
	title: string;
	game: string;
	format: string;
	status: "announcement" | "registration" | "live" | "completed";
	date: string | null;
	maxTeams: number | null;
	currentTeams: number;
	registrationOpen?: boolean;
};

const labels = {
	announcement: { en: "In planning", de: "In Planung" },
	registration: { en: "Registration open", de: "Anmeldung offen" },
	live: { en: "Live now", de: "Läuft gerade" },
	completed: { en: "Archived", de: "Im Archiv" },
};

function TournamentCard({ tournament }: { tournament: Tournament }) {
	const { locale, text } = useLocale();
	const date = tournament.date
		? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
				new Date(tournament.date)
			)
		: text("Date to be announced", "Termin folgt");

	return (
		<Link className="tournament-card" href={`/tournaments/${tournament.id}`}>
			<div className="tournament-card-meta">
				<span className={`status-pill ${tournament.status}`}>{labels[tournament.status][locale]}</span>
				<span>{date}</span>
			</div>
			<span className="tournament-game">{tournament.game}</span>
			<h3>{tournament.title}</h3>
			<p>{tournament.format}</p>
			<div className="tournament-card-footer">
				<span>{tournament.maxTeams ? `${tournament.currentTeams} / ${tournament.maxTeams} Teams` : text("Team limit to be announced", "Teamlimit folgt")}</span>
				<strong>
					{text("Open tournament", "Turnier öffnen")} <ArrowRight size={15} />
				</strong>
			</div>
		</Link>
	);
}

function TournamentCollection({ title, copy, tournaments, icon: Icon }: { title: string; copy: string; tournaments: Tournament[]; icon: typeof Trophy }) {
	const { text } = useLocale();
	return (
		<section className="content-band">
			<div className="section-heading with-icon">
				<Icon size={25} />
				<div>
					<h2>{title}</h2>
					<p>{copy}</p>
				</div>
			</div>
			{tournaments.length ? (
				<div className="tournament-hub-grid">
					{tournaments.map((tournament) => (
						<TournamentCard tournament={tournament} key={tournament.id} />
					))}
				</div>
			) : (
				<div className="empty-state compact-empty">
					<Icon size={30} />
					<h3>{text("There is still room here", "Gerade ist hier noch Platz")}</h3>
					<p>
						{text(
							"New tournaments appear automatically as soon as tournament staff publish them.",
							"Neue Turniere erscheinen automatisch, sobald die Turnierleitung sie veröffentlicht."
						)}
					</p>
				</div>
			)}
		</section>
	);
}

export default function TournamentsPage() {
	const { text } = useLocale();
	const { data, isLoading } = useSWR<{ tournaments: Tournament[] }>("/api/tournaments", fetcher);
	const tournaments = data?.tournaments || [];
	const current = tournaments.filter((item) => item.status === "live" || item.status === "registration");
	const upcoming = tournaments.filter((item) => item.status === "announcement");
	const archive = tournaments.filter((item) => item.status === "completed");

	return (
		<>
			<PageHero
				kicker={text("N4cht4r4 tournament hub", "N4cht4r4 Turnierhub")}
				title={text("From registration to the final.", "Von der Anmeldung bis zum Finale.")}
				copy={text(
					"Every League tournament has its own place here, with teams, schedule, playoff bracket, rules, results, and stream overlays.",
					"Alle League-Turniere erhalten hier ihren eigenen Platz: mit Teams, Spielplan, Playoff-Baum, Regeln, Ergebnissen und Stream-Overlays."
				)}
				icon={<Trophy size={44} strokeWidth={1.6} />}
			>
				<a className="button button-primary" href="#aktuell">
					<Swords size={17} /> {text("Discover tournaments", "Turniere entdecken")}
				</a>
			</PageHero>

			<section className="content-band tournament-principles">
				<div>
					<Crown size={20} />
					<strong>{text("One portal", "Ein Portal")}</strong>
					<span>{text("for all future formats", "für alle zukünftigen Formate")}</span>
				</div>
				<div>
					<ShieldCheck size={20} />
					<strong>{text("Fair participation", "Faire Teilnahme")}</strong>
					<span>{text("with Discord and Riot verification", "mit Discord und Riot-Verifizierung")}</span>
				</div>
				<div>
					<Swords size={20} />
					<strong>{text("Updated live", "Live gepflegt")}</strong>
					<span>{text("results and bracket in real time", "Ergebnisse und Bracket in Echtzeit")}</span>
				</div>
			</section>

			<div id="aktuell">
				{isLoading ? (
					<section className="content-band">
						<div className="skeleton portal-skeleton" />
					</section>
				) : (
					<>
						<TournamentCollection
							title={text("Current", "Aktuell")}
							copy={text("Open registrations and live events.", "Offene Anmeldungen und laufende Events.")}
							tournaments={current}
							icon={Trophy}
						/>
						<TournamentCollection
							title={text("Up next", "Als Nächstes")}
							copy={text("Announced tournaments whose details are currently being prepared.", "Angekündigte Turniere, deren Details gerade vorbereitet werden.")}
							tournaments={upcoming}
							icon={CalendarDays}
						/>
						<TournamentCollection
							title={text("Archive", "Archiv")}
							copy={text("Past tournaments with their teams, results, and paths to victory.", "Vergangene Turniere mit ihren Teams, Ergebnissen und Siegerwegen.")}
							tournaments={archive}
							icon={Archive}
						/>
					</>
				)}
			</div>
		</>
	);
}
