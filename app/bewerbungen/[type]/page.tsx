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

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export default function ApplicationTypePage() {
	const { type: rawType } = useParams<{ type: string }>();
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
		const response = await fetch("/api/applications", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...values, type, accepted: values.accepted === "on" }),
		});
		const result = await response.json();
		setSubmitting(false);
		setNotice(response.ok ? { type: "success", text: "Deine Bewerbung ist angekommen." } : { type: "error", text: result.error || "Die Bewerbung konnte nicht gesendet werden." });
	}

	if (!definition) return <section className="content-band"><div className="skeleton form-skeleton" /></section>;

	return (
		<>
			<PageHero kicker="Community-Bewerbung" title={definition.label} copy={definition.description} icon={<ClipboardList size={44} strokeWidth={1.6} />} compact />
			<section className="content-band application-layout">
				<aside className="application-requirements">
					<span className="kicker">Voraussetzungen</span>
					<h2>Vor dem Formular</h2>
					<div className={`requirement-row ${hasDiscord ? "done" : ""}`}><span className="discord-requirement-mark"><DiscordMark size={13} /></span><div><strong>Discord</strong><span>Für jede Bewerbung erforderlich</span></div>{hasDiscord && <CheckCircle2 size={18} />}</div>
					{definition.requires.includes("riot") && <div className={`requirement-row ${profile?.riotVerified ? "done" : ""}`}><ShieldCheck size={19} /><div><strong>Riot-ID</strong><span>Für League-Projekte erforderlich</span></div>{profile?.riotVerified && <CheckCircle2 size={18} />}</div>}
					{session && !ready && <Link className="button button-secondary" href="/me">Verbindungen einrichten</Link>}
				</aside>

				{!definition.open ? (
					<div className="empty-state"><ClipboardList size={36} /><h3>Diese Bewerbung ist geschlossen</h3><p>Die nächste Ausschreibung wird auf Discord und hier angekündigt.</p><Link className="text-link" href="/bewerbungen">Zur Übersicht</Link></div>
				) : !session ? (
					<div className="empty-state"><span className="discord-empty-mark"><DiscordMark size={27} variant="blurple" /></span><h3>Mit Discord anmelden</h3><p>Discord ist dein Hauptkonto für die Bewerbung.</p><button className="login-btn discord compact-login" onClick={() => signIn("discord")}><DiscordMark size={17} /> Mit Discord anmelden</button></div>
				) : (
					<form className="app-form" onSubmit={submit}>
						<div><span className="kicker">{definition.label}</span><h2>Deine Bewerbung</h2></div>
						{notice && <p className={`form-${notice.type}`}>{notice.text}</p>}
						<div className="form-group"><label htmlFor="discord">Discord-Name</label><input id="discord" name="discord" placeholder="Dein Discord-Name" required /></div>
						{(type === "jobs" || type === "game-team") && <div className="form-group"><label htmlFor="role">Gewünschte Rolle</label><input id="role" name="role" placeholder={type === "jobs" ? "Moderation, Cutter, Discord-Team..." : "Top, Jungle, Mid, Bot, Support"} required /></div>}
						{type === "minecraft" && <div className="form-group"><label htmlFor="minecraftName">Minecraft-Name</label><input id="minecraftName" name="minecraftName" required /></div>}
						{definition.requires.includes("riot") && <><div className="form-group"><label htmlFor="riotName">Riot-Name</label><input id="riotName" name="riotName" required /></div><div className="form-group"><label htmlFor="riotTag">Riot-Tag</label><input id="riotTag" name="riotTag" placeholder="EUW" required /></div></>}
						<div className="form-group"><label htmlFor="reason">Warum möchtest du mitmachen?</label><textarea id="reason" name="reason" minLength={20} required /></div>
						<div className="form-group"><label htmlFor="experience">Erfahrung und Verfügbarkeit</label><textarea id="experience" name="experience" required /></div>
						<label className="form-checkbox"><input name="accepted" type="checkbox" required /><span>Ich akzeptiere die <Link href="/agb">Bedingungen</Link> und <Link href="/datenschutz">Datenschutzhinweise</Link>.</span></label>
						<button className="button button-primary" disabled={!ready || submitting} type="submit">{submitting ? "Wird gesendet..." : "Bewerbung absenden"} <ExternalLink size={15} /></button>
					</form>
				)}
			</section>
		</>
	);
}
