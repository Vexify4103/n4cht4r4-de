"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { CalendarClock, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { TournamentHeader } from "@/components/TournamentHeader";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function TournamentApplyPage() {
	const { id } = useParams<{ id: string }>();
	const { locale, text } = useLocale();
	const { data: session } = useSession();
	const { data: tournamentData } = useSWR<{
		tournament: {
			title: string;
			status: string;
			registrationOpen?: boolean;
			registrationState?: "scheduled" | "open" | "closed" | "unavailable";
			registrationOpensAt?: string | null;
			registrationClosesAt?: string | null;
			applicationModes?: ("solo" | "team")[];
			requiredConnections?: ("discord" | "riot")[];
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
	const tournament = tournamentData?.tournament;
	const requiredConnections = tournament?.requiredConnections || ["discord", "riot"];
	const requiresDiscord = requiredConnections.includes("discord");
	const requiresRiot = requiredConnections.includes("riot");
	const connectionsReady = (!requiresDiscord || hasDiscord) && (!requiresRiot || profile?.riotVerified);

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
				? {
						type: "success",
						text: text(
							"Your application has arrived. Tournament staff will contact you through Discord.",
							"Deine Bewerbung ist angekommen. Die Turnierleitung meldet sich über Discord."
						),
					}
				: { type: "error", text: result.error || text("The application could not be saved.", "Die Bewerbung konnte nicht gespeichert werden.") }
		);
	}

	const title = tournament?.title || text("Tournament", "Turnier");
	const closed = tournamentData && tournament?.registrationOpen !== true;
	const registrationDate = (value?: string | null) => {
		if (!value) return null;
		return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
	};

	return (
		<>
			<TournamentHeader
				id={id}
				kicker={`${title} · ${text("Application", "Bewerbung")}`}
				title={text("Your place among the participants", "Dein Platz im Teilnehmerfeld")}
				copy={text(
					"Everyone applies individually. Afterwards, you can create a non-binding preferred group with friends on your profile.",
					"Alle melden sich einzeln an. Danach kannst du auf deinem Profil eine unverbindliche Wunschgruppe mit Freunden bilden."
				)}
			/>
			<section className="content-band application-layout">
				<aside className="application-requirements">
					<span className="kicker">{text("Before submitting", "Vor dem Absenden")}</span>
					<h2>
						{requiredConnections.length} {text("connections, one application", "Verbindungen, eine Bewerbung")}
					</h2>
					{requiresDiscord && (
						<div className={`requirement-row ${hasDiscord ? "done" : ""}`}>
							<span className="discord-requirement-mark">
								<DiscordMark size={13} variant="white" />
							</span>
							<div>
								<strong>Discord</strong>
								<span>{text("Contact and tournament organisation", "Kontakt und Turnierorganisation")}</span>
							</div>
							{hasDiscord && <CheckCircle2 size={18} />}
						</div>
					)}
					{requiresRiot && (
						<div className={`requirement-row ${profile?.riotVerified ? "done" : ""}`}>
							<ShieldCheck size={19} />
							<div>
								<strong>Riot-ID</strong>
								<span>{text("Confirm ownership through the profile icon", "Besitz über Profilbild bestätigen")}</span>
							</div>
							{profile?.riotVerified && <CheckCircle2 size={18} />}
						</div>
					)}
					{session && !connectionsReady && (
						<Link className="button button-secondary" href="/me">
							{text("Set up connections", "Verbindungen einrichten")}
						</Link>
					)}
				</aside>

				{closed ? (
					<div className="empty-state">
						{tournament?.registrationState === "scheduled" ? <CalendarClock size={38} /> : <ClipboardList size={38} />}
						<h3>
							{tournament?.registrationState === "scheduled"
								? text("Registration opens soon", "Die Anmeldung startet bald")
								: text("Registration is closed", "Die Anmeldung ist geschlossen")}
						</h3>
						<p>
							{tournament?.registrationNote ||
								(tournament?.registrationState === "scheduled"
									? `${text("You can submit your application here from", "Ab")} ${registrationDate(tournament.registrationOpensAt)}${locale === "de" ? "." : "."}`
									: text("The application phase for this tournament has ended.", "Die Bewerbungsphase für dieses Turnier ist beendet."))}
						</p>
						<Link className="text-link" href={`/tournaments/${id}`}>
							{text("Tournament overview", "Zur Turnierübersicht")}
						</Link>
					</div>
				) : !session ? (
					<div className="empty-state">
						<span className="discord-empty-mark">
							<DiscordMark size={27} variant="blurple" />
						</span>
						<h3>{text("Start with Discord", "Starte mit Discord")}</h3>
						<p>{text("You can then verify your Riot ID directly in your profile.", "Danach kannst du deine Riot-ID direkt im Profil verifizieren.")}</p>
						<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
							<DiscordMark size={17} variant="white" /> {text("Sign in with Discord", "Mit Discord anmelden")}
						</button>
					</div>
				) : (
					<form className="app-form" onSubmit={submit}>
						<div>
							<span className="kicker">{text("Player application", "Spielerbewerbung")}</span>
							<h2>{text("Tell us a little about yourself", "Erzähl uns kurz von dir")}</h2>
						</div>
						{notice && <p className={`form-${notice.type}`}>{notice.text}</p>}
						<div className="form-group">
							<label htmlFor="riotId">{text("Verified Riot ID", "Verifizierte Riot-ID")}</label>
							<input
								id="riotId"
								value={profile?.riotVerified ? `${profile.riotSummonerName}#${profile.riotTagLine}` : text("Not verified yet", "Noch nicht verifiziert")}
								readOnly
							/>
						</div>
						{tournament?.collectRoles !== false && (
							<div className="form-group">
								<label htmlFor="role">{text("Preferred role", "Bevorzugte Rolle")}</label>
								<select id="role" name="role" required>
									<option value="">{text("Please choose", "Bitte wählen")}</option>
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
							<label htmlFor="note">{text("Short introduction", "Kurzvorstellung")}</label>
							<textarea
								id="note"
								name="note"
								placeholder={text(
									"Availability, experience, and anything tournament staff should know.",
									"Verfügbarkeit, Erfahrung und alles, was die Turnierleitung wissen sollte."
								)}
								required
							/>
						</div>
						<div className="wish-group-disclosure">
							<strong>{text("Preferred groups are not fixed teams.", "Wunschgruppen sind keine festen Teams.")}</strong>
							<span>
								{text("After your solo application, you can create a group on", "Nach deiner Solo-Anmeldung kannst du auf")} <Link href="/me">/me</Link>{" "}
								{text(
									"or join one with a code. Tournament staff will try to honour preferences, but cannot guarantee them when skill differences would prevent fair teams.",
									"eine Gruppe erstellen oder per Code beitreten. Die Turnierleitung versucht Wünsche zu berücksichtigen, kann sie bei zu großen Skill-Unterschieden für faire Teams aber nicht garantieren."
								)}
							</span>
						</div>
						<label className="form-checkbox">
							<input name="discordDmOptIn" type="checkbox" />
							<span>
								{text(
									"The N4cht4r4 Discord bot may send me messages about team assignment and important tournament changes. I can change this later on",
									"Der N4cht4r4 Discord-Bot darf mir Nachrichten zu Team-Zuteilung und wichtigen Änderungen dieses Turniers senden. Das kann ich später auf"
								)}{" "}
								<Link href="/me">/me</Link>
								{text(".", "ändern.")}
							</span>
						</label>
						<label className="form-checkbox">
							<input name="accepted" type="checkbox" required />
							<span>
								{text("I accept the", "Ich akzeptiere die")} <Link href="/agb">{text("terms of participation", "Teilnahmebedingungen")}</Link>{" "}
								{text("and have read the", "und habe die")} <Link href="/datenschutz">{text("privacy notice", "Datenschutzhinweise")}</Link> {text(".", "gelesen.")}
							</span>
						</label>
						<button className="button button-primary" disabled={submitting || !connectionsReady} type="submit">
							{submitting ? text("Sending...", "Wird gesendet...") : text("Submit application", "Bewerbung absenden")}
						</button>
					</form>
				)}
			</section>
		</>
	);
}
