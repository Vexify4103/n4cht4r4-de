"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { CheckCircle2, ClipboardList, ShieldCheck, Twitch } from "lucide-react";
import { TournamentHeader } from "@/components/TournamentHeader";
import { DiscordMark } from "@/components/DiscordMark";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function TournamentApplyPage() {
	const { id } = useParams<{ id: string }>();
	const { data: session } = useSession();
	const { data: tournamentData } = useSWR<{
		tournament: {
			title: string;
			status: string;
			registrationOpen?: boolean;
			applicationModes?: ("solo" | "team")[];
			requiredConnections?: ("discord" | "twitch" | "riot")[];
			collectRoles?: boolean;
			registrationNote?: string;
		};
	}>(`/api/tournaments/${id}`, fetcher);
	const { data: profile } = useSWR<{ providers: string[]; riotVerified: boolean; riotSummonerName?: string; riotTagLine?: string }>(
		session ? "/api/user/profile" : null,
		fetcher
	);
	const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const hasDiscord = profile?.providers.includes("discord");
	const hasTwitch = profile?.providers.includes("twitch");
	const tournament = tournamentData?.tournament;
	const requiredConnections = tournament?.requiredConnections || ["discord", "riot"];
	const requiresDiscord = requiredConnections.includes("discord");
	const requiresTwitch = requiredConnections.includes("twitch");
	const requiresRiot = requiredConnections.includes("riot");
	const connectionsReady = (!requiresDiscord || hasDiscord) && (!requiresTwitch || hasTwitch) && (!requiresRiot || profile?.riotVerified);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setNotice(null);
		const form = new FormData(event.currentTarget);
		const response = await fetch(`/api/tournaments/${id}/applications`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				role: form.get("role"),
				discordDmOptIn: form.get("discordDmOptIn") === "on",
				note: form.get("note"),
				accepted: form.get("accepted") === "on",
			}),
		});
		const result = await response.json();
		setSubmitting(false);
		setNotice(
			response.ok
				? { type: "success", text: "Deine Bewerbung ist angekommen. Die Turnierleitung meldet sich über Discord." }
				: { type: "error", text: result.error || "Die Bewerbung konnte nicht gespeichert werden." }
		);
	}

	const title = tournament?.title || "Turnier";
	const closed = tournamentData && tournament?.registrationOpen !== true;

	return (
		<>
			<TournamentHeader
				id={id}
				kicker={`${title} · Bewerbung`}
				title="Dein Platz im Teilnehmerfeld"
				copy="Alle melden sich einzeln an. Danach kannst du auf deinem Profil eine unverbindliche Wunschgruppe mit Freunden bilden."
			/>
			<section className="content-band application-layout">
				<aside className="application-requirements">
					<span className="kicker">Vor dem Absenden</span>
					<h2>{requiredConnections.length} Verbindungen, eine Bewerbung</h2>
					{requiresDiscord && (
						<div className={`requirement-row ${hasDiscord ? "done" : ""}`}>
							<span className="discord-requirement-mark">
								<DiscordMark size={13} />
							</span>
							<div>
								<strong>Discord</strong>
								<span>Kontakt und Turnierorganisation</span>
							</div>
							{hasDiscord && <CheckCircle2 size={18} />}
						</div>
					)}
					{requiresTwitch && (
						<div className={`requirement-row ${hasTwitch ? "done" : ""}`}>
							<Twitch size={19} />
							<div>
								<strong>Twitch</strong>
								<span>Streamkonto und Community-Zuordnung</span>
							</div>
							{hasTwitch && <CheckCircle2 size={18} />}
						</div>
					)}
					{requiresRiot && (
						<div className={`requirement-row ${profile?.riotVerified ? "done" : ""}`}>
							<ShieldCheck size={19} />
							<div>
								<strong>Riot-ID</strong>
								<span>Besitz über Profilbild bestätigen</span>
							</div>
							{profile?.riotVerified && <CheckCircle2 size={18} />}
						</div>
					)}
					{session && !connectionsReady && (
						<Link className="button button-secondary" href="/me">
							Verbindungen einrichten
						</Link>
					)}
				</aside>

				{closed ? (
					<div className="empty-state">
						<ClipboardList size={38} />
						<h3>{tournament?.status === "announcement" ? "Die Anmeldung startet bald" : "Die Anmeldung ist geschlossen"}</h3>
						<p>
							{tournament?.registrationNote ||
								(tournament?.status === "announcement"
									? "Start und Teilnehmerlimit werden noch bekannt gegeben."
									: "Die Bewerbungsphase für dieses Turnier ist beendet.")}
						</p>
						<Link className="text-link" href={`/tournaments/${id}`}>
							Zur Turnierübersicht
						</Link>
					</div>
				) : !session ? (
					<div className="empty-state">
						<span className="discord-empty-mark">
							<DiscordMark size={27} variant="blurple" />
						</span>
						<h3>Starte mit Discord</h3>
						<p>Danach kannst du deine Riot-ID direkt im Profil verifizieren.</p>
						<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
							<DiscordMark size={17} /> Mit Discord anmelden
						</button>
					</div>
				) : (
					<form className="app-form" onSubmit={submit}>
						<div>
							<span className="kicker">Spielerbewerbung</span>
							<h2>Erzähl uns kurz von dir</h2>
						</div>
						{notice && <p className={`form-${notice.type}`}>{notice.text}</p>}
						<div className="form-group">
							<label htmlFor="riotId">Verifizierte Riot-ID</label>
							<input id="riotId" value={profile?.riotVerified ? `${profile.riotSummonerName}#${profile.riotTagLine}` : "Noch nicht verifiziert"} readOnly />
						</div>
						{tournament?.collectRoles !== false && (
							<div className="form-group">
								<label htmlFor="role">Bevorzugte Rolle</label>
								<select id="role" name="role" required>
									<option value="">Bitte wählen</option>
									<option>Top</option>
									<option>Jungle</option>
									<option>Mid</option>
									<option>Bot</option>
									<option>Support</option>
									<option>Fill</option>
								</select>
							</div>
						)}
						<div className="form-group">
							<label htmlFor="note">Kurzvorstellung</label>
							<textarea id="note" name="note" placeholder="Verfügbarkeit, Erfahrung und alles, was die Turnierleitung wissen sollte." required />
						</div>
						<div className="wish-group-disclosure">
							<strong>Wunschgruppen sind keine festen Teams.</strong>
							<span>
								Nach deiner Solo-Anmeldung kannst du auf <Link href="/me">/me</Link> eine Gruppe erstellen oder per Code beitreten. Die Turnierleitung versucht
								Wünsche zu berücksichtigen, kann sie bei zu großen Skill-Unterschieden für faire Teams aber nicht garantieren.
							</span>
						</div>
						<label className="form-checkbox">
							<input name="discordDmOptIn" type="checkbox" />
							<span>
								Der N4cht4r4 Discord-Bot darf mir Nachrichten zu Team-Zuteilung und wichtigen Änderungen dieses Turniers senden. Das kann ich später auf{" "}
								<Link href="/me">/me</Link>
								ändern.
							</span>
						</label>
						<label className="form-checkbox">
							<input name="accepted" type="checkbox" required />
							<span>
								Ich akzeptiere die <Link href="/agb">Teilnahmebedingungen</Link> und habe die <Link href="/datenschutz">Datenschutzhinweise</Link> gelesen.
							</span>
						</label>
						<button className="button button-primary" disabled={submitting || !connectionsReady} type="submit">
							{submitting ? "Wird gesendet..." : "Bewerbung absenden"}
						</button>
					</form>
				)}
			</section>
		</>
	);
}
