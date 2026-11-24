"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Crown, Flower2, MessageCircleHeart, Plus, ShieldAlert, Sparkles, Trophy, Users } from "lucide-react";
import { Modal } from "@/components/AdminTournamentWorkspace";
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

// The archive grows with every test and past event; the newest few are enough at a glance.
const ARCHIVE_PREVIEW = 3;

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
	const router = useRouter();
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [showFullArchive, setShowFullArchive] = useState(false);
	const canCreate = access?.role === "owner" || access?.role === "tournament_admin";

	// New tournaments start hidden ("In Vorbereitung"); everything else is set on the tournament's own admin page.
	async function createTournament(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setBusy(true);
		setCreateError(null);
		const response = await fetch("/api/admin/tournaments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: form.get("title"), format: form.get("format"), maxTeams: form.get("maxTeams") || null }),
		});
		const result = await response.json().catch(() => ({}));
		setBusy(false);
		if (!response.ok) return setCreateError(result.error || text("The tournament could not be created.", "Das Turnier konnte nicht angelegt werden."));
		router.push(`/admin/tournaments/${result.tournament.id}`);
	}

	if (error)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} aria-hidden="true" />
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
	if (!access || !data)
		return (
			<section className="content-band">
				<div className="skeleton admin-workspace-skeleton" />
			</section>
		);

	const tournaments = data?.tournaments || [];
	const chapters = [
		{
			archive: false,
			title: text("Important now", "Gerade wichtig"),
			copy: text("Live tournaments and open application phases", "Laufende Turniere und geöffnete Bewerbungsphasen"),
			records: tournaments.filter((item) => item.status === "live" || item.registrationState === "open"),
		},
		{
			archive: false,
			title: text("In preparation", "In Vorbereitung"),
			copy: text("Announcements, dates, and upcoming application windows", "Ankündigungen, Termine und kommende Bewerbungsfenster"),
			records: tournaments.filter((item) => item.status !== "completed" && item.status !== "live" && item.registrationState !== "open"),
		},
		{
			archive: true,
			title: text("In the archive", "Im Archiv"),
			copy: text("Completed tournaments with results and full records", "Beendete Turniere mit Ergebnissen und vollständiger Turnierakte"),
			records: tournaments.filter((item) => item.status === "completed"),
		},
	].filter((chapter) => chapter.records.length > 0);
	return (
		<main className="admin-sanctuary">
			<section className="admin-welcome">
				<span className="admin-seal" aria-hidden="true">
					<Flower2 size={31} aria-hidden="true" />
				</span>
				<div>
					<span className="kicker">
						{text("Tournament staff", "Turnierleitung")} · {access.role}
					</span>
					<h1>{text("Tournament records", "Die Turnierakte")}</h1>
					<p>
						{text(
							"Rosters, pairings, and results in one place. Public pages update from the same data.",
							"Kader, Paarungen und Ergebnisse an einem Ort. Öffentliche Seiten aktualisieren sich aus denselben Daten."
						)}
					</p>
					<nav className="admin-area-links" aria-label={text("Other staff areas", "Weitere Bereiche")}>
						<Link href="/admin/content">
							<Flower2 size={16} aria-hidden="true" /> {text("News & applications", "News & Bewerbungen")}
						</Link>
						<Link href="/admin/community">
							<MessageCircleHeart size={16} aria-hidden="true" /> Community
						</Link>
						<Link href="/admin/challenges">
							<Sparkles size={16} aria-hidden="true" /> Challenges
						</Link>
					</nav>
				</div>
			</section>

			<section className="admin-ledger">
				<header className="admin-ledger-head">
					<div>
						<span className="kicker">{text("Your events", "Deine Events")}</span>
						<h2>{text("Published and planned tournaments", "Veröffentlichte und geplante Turniere")}</h2>
						<p className="admin-ledger-meta">
							{tournaments.length} {tournaments.length === 1 ? text("tournament", "Turnier") : text("tournaments", "Turniere")}
						</p>
					</div>
					{canCreate && (
						<button className="button button-primary" type="button" onClick={() => setCreating(true)}>
							<Plus size={16} aria-hidden="true" /> {text("New tournament", "Turnier anlegen")}
						</button>
					)}
				</header>
				<div className="admin-ledger-lines admin-tournament-chapters">
					{chapters.map((chapter) => (
						<section className="admin-event-chapter" key={chapter.title}>
							<header>
								<div>
									<span className="kicker">{chapter.title}</span>
									<p>{chapter.copy}</p>
								</div>
								<strong aria-label={`${chapter.records.length} ${text("tournaments", "Turniere")}`}>{chapter.records.length}</strong>
							</header>
							{(chapter.archive && !showFullArchive ? chapter.records.slice(0, ARCHIVE_PREVIEW) : chapter.records).map((tournament, index) => (
								<Link className="admin-ledger-entry" href={`/admin/tournaments/${tournament.id}`} key={tournament.id}>
									<span className="ledger-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
									<div className="ledger-title">
										<strong>{tournament.title}</strong>
										<small>
											<Trophy size={14} aria-hidden="true" /> {tournament.format}
										</small>
									</div>
									<div className="ledger-timing">
										<span>
											<CalendarDays size={14} aria-hidden="true" /> {formatDate(tournament.startsAt || tournament.date, locale)}
										</span>
										<small className={tournament.registrationState === "open" ? "is-open" : ""}>
											{registrationLabels[tournament.registrationState || "closed"][locale]}
										</small>
									</div>
									<span className="ledger-teams">
										<Users size={14} aria-hidden="true" />{" "}
										{tournament.maxTeams ? `${tournament.currentTeams} / ${tournament.maxTeams}` : `${tournament.currentTeams} / ${text("open", "offen")}`}
									</span>
									<span className="ledger-status">{labels[tournament.status as keyof typeof labels]?.[locale] || tournament.status}</span>
									<ArrowRight className="ledger-arrow" size={18} aria-hidden="true" />
								</Link>
							))}
							{chapter.archive && chapter.records.length > ARCHIVE_PREVIEW && (
								<button className="admin-archive-toggle" type="button" aria-expanded={showFullArchive} onClick={() => setShowFullArchive((value) => !value)}>
									{showFullArchive
										? text("Show fewer", "Weniger anzeigen")
										: text(`Show all ${chapter.records.length}`, `Alle ${chapter.records.length} anzeigen`)}
								</button>
							)}
						</section>
					))}
					{tournaments.length === 0 && (
						<div className="admin-ledger-empty">
							<Crown size={28} aria-hidden="true" />
							<h3>{text("No tournament records yet", "Noch keine Turnierakte")}</h3>
							<p>
								{text(
									"Create the first event with “New tournament”.",
									"Lege das erste Event über „Turnier anlegen“ an."
								)}
							</p>
						</div>
					)}
				</div>
			</section>
			{creating && (
				<Modal title={text("New tournament", "Turnier anlegen")} onClose={() => setCreating(false)}>
					<form className="roster-form" onSubmit={createTournament}>
						<label>
							{text("Title", "Titel")}
							<input name="title" required autoFocus maxLength={100} placeholder={text("e.g. ARAM Mayhem – Bloom in Chaos", "z. B. ARAM Mayhem – Bloom in Chaos")} autoComplete="off" />
						</label>
						<label>
							Format
							<input name="format" required maxLength={80} placeholder={text("e.g. 3v3 · Double Elimination", "z. B. 3v3 · Double Elimination")} autoComplete="off" />
						</label>
						<label>
							{text("Team limit (optional)", "Teamlimit (optional)")}
							<input name="maxTeams" type="number" inputMode="numeric" min={2} max={128} placeholder="8" autoComplete="off" />
						</label>
						<p className="muted-note">
							{text(
								"The tournament starts hidden in preparation. Date, bracket, team size, rules, and the application window are set on its admin page next.",
								"Das Turnier startet versteckt „In Vorbereitung“. Termin, Turnierbaum, Teamgröße, Regeln und Bewerbungszeitraum stellst du danach auf seiner Admin-Seite ein."
							)}
						</p>
						{createError && <p className="form-error">{createError}</p>}
						<button className="button button-primary" type="submit" disabled={busy}>
							{busy ? text("Creating…", "Wird angelegt…") : text("Create tournament", "Turnier anlegen")}
						</button>
					</form>
				</Modal>
			)}
		</main>
	);
}
