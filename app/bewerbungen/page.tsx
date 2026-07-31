"use client";

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ArrowRight, ClipboardList, Gamepad2, Hammer, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import type { ApplicationDefinition, ApplicationType } from "@/lib/applications";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
const icons: Record<ApplicationType, typeof Trophy> = { tournaments: Trophy, jobs: ShieldCheck, minecraft: Hammer, "game-team": Gamepad2 };

type Tournament = { id: string; title: string; registrationOpen?: boolean; status: string; date: string | null };

export default function ApplicationsPage() {
	const { data: session } = useSession();
	const { data: applicationData } = useSWR<{ applications: Record<ApplicationType, ApplicationDefinition> }>("/api/applications", fetcher);
	const { data: tournamentData } = useSWR<{ tournaments: Tournament[] }>("/api/tournaments", fetcher);
	const { data: myData } = useSWR<{ applications: { id: string; category: string; type?: string; title?: string; status: string; tournamentSlug?: string; createdAt: string }[] }>(session ? "/api/applications/my" : null, fetcher);
	const definitions = applicationData?.applications;
	const openTournaments = (tournamentData?.tournaments || []).filter((tournament) => tournament.registrationOpen);

	return (
		<>
			<PageHero
				kicker="Mitmachen bei N4cht4r4"
				title="Wo aus Interesse ein gemeinsames Projekt wird."
				copy="Offene Turniere, Minecraft-Projekte und Rollen im Community-Team werden an einem ruhigen Ort gesammelt."
				icon={<ClipboardList size={44} strokeWidth={1.6} />}
			/>

			<section className="content-band application-guide">
				<div><span className="discord-guide-mark"><DiscordMark size={14} /></span><strong>Discord zuerst</strong><span>Dein Hauptkonto und unser Kontaktweg</span></div>
				<div><ShieldCheck size={20} /><strong>Riot bei League</strong><span>Verifizierung ohne Passwort</span></div>
				<div><Sparkles size={20} /><strong>Klare Rückmeldung</strong><span>Status und Kontakt über dein Profil</span></div>
			</section>

			<section className="content-band">
				<div className="section-heading"><span>Turnierbewerbungen</span><h2>Aktuell offene Events</h2><p>Die Bewerbung gehört immer zu einem konkreten Turnier und übernimmt dessen Voraussetzungen.</p></div>
				{openTournaments.length ? <div className="application-grid">{openTournaments.map((tournament) => (
					<Link className="application-card open" href={`/tournaments/${tournament.id}/apply`} key={tournament.id}>
						<Trophy size={24} /><div><small>Anmeldung offen</small><h2>{tournament.title}</h2><p>Mit Discord und verifizierter Riot-ID bewerben.</p></div><ArrowRight size={18} />
					</Link>
				))}</div> : <div className="empty-state compact-empty"><Trophy size={30} /><h3>Gerade keine Turnierbewerbung offen</h3><p>Bereits geplante Turniere und ihre Teams findest du weiterhin im Turnierhub.</p><Link className="text-link" href="/tournaments">Zum Turnierhub <ArrowRight size={14} /></Link></div>}
			</section>

			{session && (myData?.applications.length || 0) > 0 && (
				<section className="content-band">
					<div className="section-heading"><span>Mein Verlauf</span><h2>Deine Bewerbungen</h2><p>Offene und bereits geprüfte Bewerbungen bleiben hier nachvollziehbar.</p></div>
					<div className="application-history">
						{myData?.applications.map((application) => (
							<Link href={application.category === "tournament" ? `/tournaments/${application.tournamentSlug}` : "/bewerbungen"} key={application.id}>
								<div><small>{application.category === "tournament" ? "Turnier" : "Community-Projekt"}</small><strong>{application.title || definitions?.[application.type as ApplicationType]?.label || application.type}</strong></div>
								<span className={`status-pill ${application.status === "accepted" ? "registration" : application.status === "rejected" ? "" : "announcement"}`}>{application.status === "pending" ? "In Prüfung" : application.status === "accepted" ? "Angenommen" : application.status === "waitlisted" ? "Warteliste" : "Abgelehnt"}</span>
							</Link>
						))}
					</div>
				</section>
			)}

			<section className="content-band">
				<div className="section-heading"><span>Weitere Projekte</span><h2>Community-Team, Minecraft und Flex-Team</h2></div>
				<div className="application-grid">
					{definitions && (Object.entries(definitions) as [ApplicationType, ApplicationDefinition][]).filter(([type]) => type !== "tournaments").map(([type, definition]) => {
						const Icon = icons[type];
						return (
							<article className={`application-card ${definition.open ? "open" : "closed"}`} key={type}>
								<Icon size={24} />
								<div><small>{definition.open ? "Bewerbung offen" : "Momentan geschlossen"}</small><h2>{definition.label}</h2><p>{definition.description}</p></div>
								{definition.open ? <Link className="icon-action" href={`/bewerbungen/${type}`} title="Bewerbung öffnen"><ArrowRight size={18} /></Link> : <span className="status-pill">Bald</span>}
							</article>
						);
					})}
				</div>
			</section>
		</>
	);
}
