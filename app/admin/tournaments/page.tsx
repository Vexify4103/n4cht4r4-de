"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Crown, Flower2, MessageCircleHeart, ShieldAlert, Sparkles, Trophy, Users } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	});
type Tournament = {
	id: string;
	title: string;
	status: string;
	format: string;
	currentTeams: number;
	maxTeams: number | null;
	date?: string | null;
	startsAt?: string | null;
	registrationState?: "scheduled" | "open" | "closed" | "unavailable";
	registrationOpensAt?: string | null;
	registrationClosesAt?: string | null;
};
const labels = {
	announcement: { en: "In preparation", de: "In Vorbereitung" },
	registration: { en: "Registration", de: "Anmeldung" },
	live: { en: "Live", de: "Läuft" },
	completed: { en: "Archive", de: "Archiv" },
};
const registrationLabels = {
	scheduled: { en: "Application scheduled", de: "Bewerbung geplant" },
	open: { en: "Application open", de: "Bewerbung offen" },
	closed: { en: "Application closed", de: "Bewerbung geschlossen" },
	unavailable: { en: "No application", de: "Keine Bewerbung" },
};

function formatDate(value: string | null | undefined, locale: Locale) {
	if (!value) return locale === "en" ? "Date open" : "Termin offen";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return locale === "en" ? "Date open" : "Termin offen";
	return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", ...(value.includes("T") ? { timeStyle: "short" as const } : {}) }).format(date);
}

export default function AdminTournamentsPage() {
	const { locale, text } = useLocale();
	const { data: access, error } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data } = useSWR<{ tournaments: Tournament[] }>(access ? "/api/admin/tournaments" : null, fetcher);

	if (error)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>{text("No tournament access", "Kein Turnierzugriff")}</h3>
					<p>
						{text(
							"Your connected Discord account is not registered for tournament staff.",
							"Dein verbundenes Discord-Konto ist nicht für die Turnierleitung hinterlegt."
						)}
					</p>
				</div>
			</section>
		);
	if (!access)
		return (
			<section className="content-band">
				<div className="skeleton admin-workspace-skeleton" />
			</section>
		);

	const tournaments = data?.tournaments || [];
	const chapters = [
		{
			title: text("Important now", "Gerade wichtig"),
			copy: text("Live tournaments and open application phases", "Laufende Turniere und geöffnete Bewerbungsphasen"),
			records: tournaments.filter((item) => item.status === "live" || item.registrationState === "open"),
		},
		{
			title: text("In preparation", "In Vorbereitung"),
			copy: text("Announcements, dates, and upcoming application windows", "Ankündigungen, Termine und kommende Bewerbungsfenster"),
			records: tournaments.filter((item) => item.status !== "completed" && item.status !== "live" && item.registrationState !== "open"),
		},
		{
			title: text("In the archive", "Im Archiv"),
			copy: text("Completed tournaments with results and full records", "Beendete Turniere mit Ergebnissen und vollständiger Turnierakte"),
			records: tournaments.filter((item) => item.status === "completed"),
		},
	].filter((chapter) => chapter.records.length > 0);
	return (
		<main className="admin-sanctuary">
			<section className="admin-welcome">
				<span className="admin-seal">
					<Flower2 size={31} />
				</span>
				<div>
					<span className="kicker">
						{text("Tournament staff", "Turnierleitung")} · {access.role}
					</span>
					<h1>{text("Tournament records", "Die Turnierakte")}</h1>
					<p>
						{text(
							"A calm workspace for rosters, pairings, and results. Public pages update from the same data.",
							"Ein ruhiger Arbeitsbereich für Kader, Paarungen und Ergebnisse. Öffentliche Seiten aktualisieren sich aus denselben Daten."
						)}
					</p>
				</div>
			</section>

			<section className="admin-ledger">
				<header>
					<div>
						<span className="kicker">{text("Your events", "Deine Events")}</span>
						<h2>{text("Published and planned tournaments", "Veröffentlichte und geplante Turniere")}</h2>
					</div>
					<div className="admin-ledger-tools">
						<Link className="button button-secondary button-small" href="/admin/community">
							<MessageCircleHeart size={14} /> Community
						</Link>
						<Link className="button button-secondary button-small" href="/admin/challenges">
							<Sparkles size={14} /> Challenges
						</Link>
						<span className="admin-ledger-count">
							{tournaments.length} {text("entries", "Einträge")}
						</span>
					</div>
				</header>
				<div className="admin-ledger-lines admin-tournament-chapters">
					{chapters.map((chapter) => (
						<section className="admin-event-chapter" key={chapter.title}>
							<header>
								<div>
									<span className="kicker">{chapter.title}</span>
									<p>{chapter.copy}</p>
								</div>
								<strong>{chapter.records.length}</strong>
							</header>
							{chapter.records.map((tournament, index) => (
								<Link className="admin-ledger-entry" href={`/admin/tournaments/${tournament.id}`} key={tournament.id}>
									<span className="ledger-index">{String(index + 1).padStart(2, "0")}</span>
									<div className="ledger-title">
										<strong>{tournament.title}</strong>
										<small>
											<Trophy size={13} /> {tournament.format}
										</small>
									</div>
									<div className="ledger-timing">
										<span>
											<CalendarDays size={14} /> {formatDate(tournament.startsAt || tournament.date, locale)}
										</span>
										<small className={tournament.registrationState === "open" ? "is-open" : ""}>
											{registrationLabels[tournament.registrationState || "closed"][locale]}
										</small>
									</div>
									<span className="ledger-teams">
										<Users size={14} />{" "}
										{tournament.maxTeams ? `${tournament.currentTeams} / ${tournament.maxTeams}` : `${tournament.currentTeams} / ${text("open", "offen")}`}
									</span>
									<span className="ledger-status">{labels[tournament.status as keyof typeof labels]?.[locale] || tournament.status}</span>
									<ArrowRight className="ledger-arrow" size={18} />
								</Link>
							))}
						</section>
					))}
					{tournaments.length === 0 && (
						<div className="admin-ledger-empty">
							<Crown size={28} />
							<h3>{text("No tournament records yet", "Noch keine Turnierakte")}</h3>
							<p>
								{text(
									"The first event will appear here once it has been created in the database.",
									"Das erste Event erscheint hier, sobald es in der Datenbank angelegt ist."
								)}
							</p>
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
