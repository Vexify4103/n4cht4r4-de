"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Check, Clock3, Link2, ShieldCheck, Swords, Users } from "lucide-react";
import { DiscordMark } from "@/components/DiscordMark";
import { TournamentHeader } from "@/components/TournamentHeader";
import { PublicTeam, TournamentTeamCard } from "@/components/TournamentTeamCard";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
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
	maxTeams: number | null;
	currentTeams: number;
	registrationOpen?: boolean;
	rules: string[];
	description?: string;
	tagline?: string;
	registrationNote?: string;
	teamSize?: number;
	gameMode?: string;
	applicationModes?: ("solo" | "team")[];
	requiredConnections?: ("discord" | "riot")[];
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
	announcement: { en: "In planning", de: "In Planung" },
	registration: { en: "Registration open", de: "Anmeldung offen" },
	live: { en: "Live now", de: "Läuft gerade" },
	completed: { en: "Completed", de: "Abgeschlossen" },
};

export default function TournamentDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { locale, text } = useLocale();
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	const { data, error } = useSWR<{ tournament: Tournament }>(`/api/tournaments/${id}`, fetcher);
	const { data: teamData } = useSWR<{ teams: PublicTeam[] }>(`/api/tournaments/${id}/teams`, fetcher);
	const { data: matchData } = useSWR<{ matches: Match[] }>(`/api/tournaments/${id}/matches`, fetcher);

	if (error)
		return (
			<section className="content-band">
				<div className="empty-state">
					<Swords size={38} />
					<h3>{text("Tournament not found", "Turnier nicht gefunden")}</h3>
					<p>{text("It may not have been published yet.", "Vielleicht wurde es noch nicht veröffentlicht.")}</p>
					<Link className="text-link" href="/tournaments">
						{text("Tournament hub", "Zum Turnierhub")}
					</Link>
				</div>
			</section>
		);
	if (!data)
		return (
			<section className="content-band">
				<div className="skeleton portal-skeleton" />
			</section>
		);

	const tournament = data.tournament;
	const teams = teamData?.teams || [];
	const nextMatch = (matchData?.matches || []).find((match) => match.status !== "completed" && match.teamAId && match.teamBId);
	const teamNames = new Map(teams.map((team) => [team.id, team.name]));
	const date = tournament.date
		? new Intl.DateTimeFormat(intlLocale, { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
				new Date(tournament.date)
			) + (locale === "de" ? " Uhr" : "")
		: text("Date to be announced", "Termin folgt");
	const isAnnouncement = tournament.status === "announcement";
	const teamLimit = tournament.maxTeams ? `${tournament.currentTeams} ${text("of", "von")} ${tournament.maxTeams} Teams` : text("To be announced", "Wird noch bekannt gegeben");
	const requiredConnections = tournament.requiredConnections || ["discord", "riot"];

	return (
		<>
			<TournamentHeader id={id} kicker={`${statusLabel[tournament.status][locale]} · ${tournament.game}`} title={tournament.title} copy={`${tournament.format} · ${date}`} />

			<section className="content-band tournament-facts">
				<div>
					<CalendarDays size={20} />
					<span>{text("Date", "Termin")}</span>
					<strong>{date}</strong>
				</div>
				<div>
					<Users size={20} />
					<span>{text("Participants", "Teilnehmerfeld")}</span>
					<strong>{teamLimit}</strong>
				</div>
				<div>
					<Swords size={20} />
					<span>Format</span>
					<strong>{tournament.format}</strong>
				</div>
				<div>
					<ShieldCheck size={20} />
					<span>{text("Registration", "Anmeldung")}</span>
					<strong>{tournament.registrationOpen ? text("Open", "Geöffnet") : isAnnouncement ? text("Opens later", "Start folgt") : text("Closed", "Geschlossen")}</strong>
				</div>
			</section>

			<section className="content-band tournament-overview-grid">
				<article className="tournament-story">
					<span className="kicker">{text("Tournament status", "Turnierstand")}</span>
					<h2>
						{tournament.registrationOpen
							? text("Your place in the tournament is waiting.", "Dein Platz im Turnier wartet.")
							: isAnnouncement
								? text("Registration will bloom soon.", "Die Anmeldung blüht bald auf.")
								: text("The teams are set. Now the tournament is waiting to begin.", "Die Teams stehen. Jetzt wartet das Turnier auf seinen Start.")}
					</h2>
					<p>
						{tournament.registrationOpen
							? tournament.description ||
								text(
									"Connect the required accounts and apply on your own or with your team.",
									"Verbinde die benötigten Konten und bewirb dich allein oder gemeinsam mit deinem Team."
								)
							: isAnnouncement
								? tournament.description ||
									text(
										"The exact registration start and participant limit will be announced later.",
										"Der genaue Anmeldestart und das Teilnehmerlimit werden noch bekannt gegeben."
									)
								: text(
										"All rosters are confirmed. Tournament staff maintain pairings, results, and the path to the final here.",
										"Alle Kader wurden bestätigt. Die Turnierleitung pflegt hier Paarungen, Ergebnisse und den Weg bis ins Finale."
									)}
					</p>
					{tournament.tagline && <p className="tournament-tagline">{tournament.tagline}</p>}
					{isAnnouncement && (
						<div className="tournament-connection-list" aria-label={text("Required connections", "Benötigte Verbindungen")}>
							{requiredConnections.includes("discord") && (
								<span>
									<DiscordMark size={13} variant="blurple" /> Discord
								</span>
							)}
							{requiredConnections.includes("riot") && (
								<span>
									<ShieldCheck size={14} /> Riot-ID
								</span>
							)}
						</div>
					)}
					{tournament.registrationOpen ? (
						<Link className="button button-primary" href={`/tournaments/${id}/apply`}>
							<Check size={16} /> {text("Apply now", "Jetzt bewerben")}
						</Link>
					) : isAnnouncement ? (
						<Link className="button button-secondary" href={`/tournaments/${id}/apply`}>
							<Link2 size={16} /> {text("Prepare application", "Anmeldung vorbereiten")}
						</Link>
					) : (
						<Link className="button button-secondary" href={`/tournaments/${id}/playoffs`}>
							<Swords size={16} /> {text("View playoff bracket", "Playoff-Baum ansehen")}
						</Link>
					)}
				</article>

				<aside className="next-match-panel">
					<span className="kicker">{text("Up next", "Als Nächstes")}</span>
					{nextMatch ? (
						<>
							<small>
								{text("Round", "Runde")} {nextMatch.round}
							</small>
							<div className="next-match-teams">
								<strong>{teamNames.get(nextMatch.teamAId || "") || "Team A"}</strong>
								<span>{text("versus", "gegen")}</span>
								<strong>{teamNames.get(nextMatch.teamBId || "") || "Team B"}</strong>
							</div>
							<p>
								<Clock3 size={15} />{" "}
								{nextMatch.scheduledAt ? new Date(nextMatch.scheduledAt).toLocaleString(intlLocale) : text("Date to be announced", "Termin wird bekannt gegeben")}
							</p>
						</>
					) : (
						<div className="quiet-state">
							<Clock3 size={25} />
							<p>{text("Tournament staff will publish the next pairing.", "Die nächste Paarung wird von der Turnierleitung veröffentlicht.")}</p>
						</div>
					)}
					<Link className="text-link" href={`/tournaments/${id}/schedule`}>
						{text("Full schedule", "Ganzer Spielplan")} <ArrowRight size={14} />
					</Link>
				</aside>
			</section>

			<section className="content-band">
				<div className="section-heading section-heading-row">
					<div>
						<span>{text("Confirmed teams", "Bestätigte Teams")}</span>
						<h2>{text("Tournament rosters", "Die Kader im Turnier")}</h2>
					</div>
					<Link className="text-link" href={`/tournaments/${id}/teams`}>
						{text("All teams and stream links", "Alle Teams und Stream-Links")} <ArrowRight size={14} />
					</Link>
				</div>
				{teams.length ? (
					<div className="tournament-team-grid">
						{teams.slice(0, 4).map((team) => (
							<TournamentTeamCard tournamentId={id} team={team} key={team.id} />
						))}
					</div>
				) : (
					<div className="empty-state compact-empty">
						<Users size={30} />
						<h3>{text("No teams published yet", "Noch keine Teams veröffentlicht")}</h3>
						<p>{text("Confirmed rosters appear here automatically.", "Bestätigte Kader erscheinen hier automatisch.")}</p>
					</div>
				)}
			</section>

			<section className="callout-band">
				<ShieldCheck size={27} />
				<div>
					<h2>
						{tournament.rules.length
							? text("Read the rules before the first match", "Regeln vor dem ersten Match lesen")
							: text("The rules are being prepared", "Das Regelwerk wird vorbereitet")}
					</h2>
					<p>
						{tournament.rules.length
							? text(
									"Format, fair play, and tournament procedures are documented in the complete rules.",
									"Format, Fairplay und Turnierablauf sind im vollständigen Regelwerk festgehalten."
								)
							: tournament.registrationNote ||
								text("All binding rules will appear here before registration opens.", "Alle verbindlichen Regeln erscheinen hier vor dem Start der Anmeldung.")}
					</p>
				</div>
				<Link className="button button-secondary" href={`/tournaments/${id}/rules`}>
					{text("Open rules", "Regelwerk öffnen")}
				</Link>
			</section>
		</>
	);
}
