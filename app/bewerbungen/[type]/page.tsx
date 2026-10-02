"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { CheckCircle2, ClipboardList, ExternalLink, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import type { ApplicationDefinition, ApplicationType } from "@/lib/applications";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function ApplicationTypePage() {
	const { type: rawType } = useParams<{ type: string }>();
	const { locale, text } = useLocale();
	const type = rawType as ApplicationType;
	const { data: session } = useSession();
	const { data } = useSWR<{ applications: Record<ApplicationType, ApplicationDefinition> }>("/api/applications", fetcher);
	const { data: profile } = useSWR<{ providers: string[]; riotVerified: boolean }>(session ? "/api/user/profile" : null, fetcher);
	const definition = data?.applications?.[type];
	const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const hasDiscord = profile?.providers.includes("discord");
	const ready = hasDiscord && (!definition?.requires.includes("riot") || profile?.riotVerified);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setNotice(null);
		const values = Object.fromEntries(new FormData(event.currentTarget));
		try {
			const response = await fetch("/api/applications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...values, type, accepted: values.accepted === "on" }),
			});
			const result = await response.json();
			setNotice(
				response.ok
					? {
							type: "success",
							text:
								type === "appeal"
									? text(
											"Your appeal has arrived. You can check the decision under your applications.",
											"Dein Antrag ist angekommen. Die Entscheidung findest du unter deinen Bewerbungen."
										)
									: text("Your application has arrived.", "Deine Bewerbung ist angekommen."),
						}
					: { type: "error", text: result.error || text("The application could not be sent.", "Die Bewerbung konnte nicht gesendet werden.") }
			);
		} catch {
			setNotice({ type: "error", text: text("Could not reach the server. Please try again.", "Der Server ist gerade nicht erreichbar. Bitte versuche es erneut.") });
		} finally {
			setSubmitting(false);
		}
	}

	if (!definition)
		return (
			<section className="content-band">
				<div className="skeleton form-skeleton" />
			</section>
		);

	return (
		<>
			<PageHero
				kicker={type === "appeal" ? text("A second look", "Ein zweiter Blick") : text("Community application", "Community-Bewerbung")}
				title={locale === "en" ? definition.labelEn : definition.label}
				copy={locale === "en" ? definition.descriptionEn : definition.description}
				icon={<ClipboardList size={44} strokeWidth={1.6} />}
				compact
			/>
			<section className="content-band application-layout">
				<aside className="application-requirements">
					<span className="kicker">{text("Requirements", "Voraussetzungen")}</span>
					<h2>{text("Before the form", "Vor dem Formular")}</h2>
					<div className={`requirement-row ${hasDiscord ? "done" : ""}`}>
						<span className="discord-requirement-mark">
							<DiscordMark size={13} variant="white" />
						</span>
						<div>
							<strong>Discord</strong>
							<span>{text("Required for every application", "Für jede Bewerbung erforderlich")}</span>
						</div>
						{hasDiscord && <CheckCircle2 size={18} />}
					</div>
					{definition.requires.includes("riot") && (
						<div className={`requirement-row ${profile?.riotVerified ? "done" : ""}`}>
							<ShieldCheck size={19} />
							<div>
								<strong>Riot-ID</strong>
								<span>{text("Required for League projects", "Für League-Projekte erforderlich")}</span>
							</div>
							{profile?.riotVerified && <CheckCircle2 size={18} />}
						</div>
					)}
					{session && !ready && (
						<Link className="button button-secondary" href="/me">
							{text("Set up connections", "Verbindungen einrichten")}
						</Link>
					)}
				</aside>

				{!definition.open ? (
					<div className="empty-state">
						<ClipboardList size={36} />
						<h3>{text("This application is closed", "Diese Bewerbung ist geschlossen")}</h3>
						<p>{text("The next opening will be announced on Discord and here.", "Die nächste Ausschreibung wird auf Discord und hier angekündigt.")}</p>
						<Link className="text-link" href="/bewerbungen">
							{text("Overview", "Zur Übersicht")}
						</Link>
					</div>
				) : !session ? (
					<div className="empty-state discord-auth-state">
						<span className="discord-empty-mark">
							<DiscordMark size={22} variant="white" />
						</span>
						<h3>{text("Sign in with Discord", "Mit Discord anmelden")}</h3>
						<p>{text("Discord is your main account for applications.", "Discord ist dein Hauptkonto für die Bewerbung.")}</p>
						<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
							<DiscordMark size={17} variant="white" /> {text("Sign in with Discord", "Mit Discord anmelden")}
						</button>
						<small className="discord-auth-disclaimer">
							{text(
								"Discord is used only for sign-in and application contact. This website is independently operated.",
								"Discord wird nur zur Anmeldung und für den Bewerbungskontakt genutzt. Diese Website wird unabhängig betrieben."
							)}
						</small>
					</div>
				) : (
					<form className="app-form" onSubmit={submit}>
						<div>
							<span className="kicker">{locale === "en" ? definition.labelEn : definition.label}</span>
							<h2>{type === "appeal" ? text("Your appeal", "Dein Entbannungsantrag") : text("Your application", "Deine Bewerbung")}</h2>
						</div>
						{notice && <p className={`form-${notice.type}`}>{notice.text}</p>}
						<p className="muted-note">{text("Fields marked * are required.", "Felder mit * sind Pflichtfelder.")}</p>
						{(type === "jobs" || type === "appeal") && (
							<div className="form-group">
								<label htmlFor="role">{type === "jobs" ? text("Position *", "Bereich *") : text("Where were you banned? *", "Wo wurdest du gebannt? *")}</label>
								<select id="role" name="role" defaultValue="" required>
									<option value="" disabled>
										{text("Please select", "Bitte auswählen")}
									</option>
									{type === "jobs" ? (
										<>
											<option value="moderation">{text("Moderation (stream / Discord)", "Moderation (Stream / Discord)")}</option>
											<option value="cutter">{text("Video editor", "Cutter / Videoschnitt")}</option>
										</>
									) : (
										<>
											<option value="discord">Discord</option>
											<option value="community">{text("Website / community", "Website / Community")}</option>
										</>
									)}
								</select>
							</div>
						)}
						<div className="form-group">
							<label htmlFor="discord">{text("Discord name *", "Discord-Name *")}</label>
							<input id="discord" name="discord" placeholder={text("Your Discord name", "Dein Discord-Name")} required />
						</div>
						{type === "game-team" && (
							<div className="form-group">
								<label htmlFor="role">{text("Preferred role", "Gewünschte Rolle")}</label>
								<input id="role" name="role" placeholder="Top, Jungle, Mid, Bot, Support" required />
							</div>
						)}
						{type === "minecraft" && (
							<div className="form-group">
								<label htmlFor="minecraftName">Minecraft-Name</label>
								<input id="minecraftName" name="minecraftName" required />
							</div>
						)}
						{definition.requires.includes("riot") && (
							<>
								<div className="form-group">
									<label htmlFor="riotName">Riot-Name</label>
									<input id="riotName" name="riotName" required />
								</div>
								<div className="form-group">
									<label htmlFor="riotTag">Riot-Tag</label>
									<input id="riotTag" name="riotTag" placeholder="EUW" required />
								</div>
							</>
						)}
						<div className="form-group">
							<label htmlFor="reason">
								{type === "appeal"
									? text("What happened, and why should we reconsider? *", "Was ist passiert und warum sollten wir den Bann prüfen? *")
									: text("Why would you like to join? *", "Warum möchtest du mitmachen? *")}
							</label>
							<textarea id="reason" name="reason" minLength={20} required />
						</div>
						<div className="form-group">
							<label htmlFor="experience">
								{type === "appeal"
									? text("Date, context, or evidence (optional)", "Datum, Kontext oder Belege (optional)")
									: text("Experience and availability *", "Erfahrung und Verfügbarkeit *")}
							</label>
							<textarea id="experience" name="experience" required={type !== "appeal"} />
						</div>
						<label className="form-checkbox">
							<input name="accepted" type="checkbox" required />
							<span>
								{text("I accept the", "Ich akzeptiere die")} <Link href="/agb">{text("terms", "Bedingungen")}</Link> {text("and", "und")}{" "}
								<Link href="/datenschutz">{text("privacy notice", "Datenschutzhinweise")}</Link>.
							</span>
						</label>
						<button className="button button-primary" disabled={!ready || submitting} type="submit">
							{submitting
								? text("Sending...", "Wird gesendet...")
								: type === "appeal"
									? text("Submit appeal", "Antrag absenden")
									: text("Submit application", "Bewerbung absenden")}{" "}
							<ExternalLink size={15} />
						</button>
					</form>
				)}
			</section>
		</>
	);
}
