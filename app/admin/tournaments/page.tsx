"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Crown, Flower2, ShieldAlert, Sparkles, Trophy, Users } from "lucide-react";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	});
type Tournament = { id: string; title: string; status: string; format: string; currentTeams: number; maxTeams: number | null; date?: string | null };
const labels: Record<string, string> = { announcement: "In Vorbereitung", registration: "Anmeldung", live: "Läuft", completed: "Archiv" };

export default function AdminTournamentsPage() {
	const { data: access, error } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data } = useSWR<{ tournaments: Tournament[] }>(access ? "/api/admin/tournaments" : null, fetcher);

	if (error)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>Kein Turnierzugriff</h3>
					<p>Dein verbundenes Discord-Konto ist nicht für die Turnierleitung hinterlegt.</p>
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
	return (
		<main className="admin-sanctuary">
			<section className="admin-welcome">
				<span className="admin-seal">
					<Flower2 size={31} />
				</span>
				<div>
					<span className="kicker">Turnierleitung · {access.role}</span>
					<h1>Die Turnierakte</h1>
					<p>Ein ruhiger Arbeitsbereich für Kader, Paarungen und Ergebnisse. Öffentliche Seiten aktualisieren sich aus denselben Daten.</p>
				</div>
			</section>

			<section className="admin-ledger">
				<header>
					<div>
						<span className="kicker">Deine Events</span>
						<h2>Veröffentlichte und geplante Turniere</h2>
					</div>
					<div className="admin-ledger-tools">
						<Link className="button button-secondary button-small" href="/admin/challenges">
							<Sparkles size={14} /> Challenges
						</Link>
						<span className="admin-ledger-count">{tournaments.length} Einträge</span>
					</div>
				</header>
				<div className="admin-ledger-lines">
					{tournaments.map((tournament, index) => (
						<Link className="admin-ledger-entry" href={`/admin/tournaments/${tournament.id}`} key={tournament.id}>
							<span className="ledger-index">{String(index + 1).padStart(2, "0")}</span>
							<div className="ledger-title">
								<strong>{tournament.title}</strong>
								<small>
									<Trophy size={13} /> {tournament.format}
								</small>
							</div>
							<span className="ledger-teams">
								<Users size={14} /> {tournament.maxTeams ? `${tournament.currentTeams} / ${tournament.maxTeams}` : `${tournament.currentTeams} / offen`}
							</span>
							<span className="ledger-status">
								<CalendarDays size={14} /> {labels[tournament.status] || tournament.status}
							</span>
							<ArrowRight className="ledger-arrow" size={18} />
						</Link>
					))}
					{tournaments.length === 0 && (
						<div className="admin-ledger-empty">
							<Crown size={28} />
							<h3>Noch keine Turnierakte</h3>
							<p>Das erste Event erscheint hier, sobald es in der Datenbank angelegt ist.</p>
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
