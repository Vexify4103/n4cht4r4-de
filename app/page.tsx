"use client";

import Link from "next/link";
import { ArrowRight, BookHeart, Flower2, Gamepad2, HeartHandshake, Sparkles, Target, Trophy } from "lucide-react";
import { HomeLivePanel } from "@/components/HomeLivePanel";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale } from "@/components/LocaleProvider";
import { currentEngagement } from "@/lib/engagement";

const gardenPaths = [
	{
		icon: Trophy,
		eyebrow: { en: "League events", de: "League Events" },
		title: { en: "Tournament garden", de: "Turniergarten" },
		copy: { en: "Applications, teams, schedules, playoffs, and results in one place.", de: "Anmeldungen, Teams, Spielpläne, Playoffs und Ergebnisse an einem festen Ort." },
		href: "/tournaments",
		link: { en: "Open tournaments", de: "Turniere öffnen" },
	},
	{
		icon: Target,
		eyebrow: { en: "For you & everyone", de: "Für dich & alle" },
		title: { en: "Community challenges", de: "Community Challenges" },
		copy: { en: "Riot progress, watch time, and shared goals that update automatically.", de: "Riot-Fortschritt, Watchtime und gemeinsame Ziele, die automatisch mitwachsen." },
		href: "/challenges",
		link: { en: "View challenges", de: "Challenges ansehen" },
	},
	{
		icon: Gamepad2,
		eyebrow: { en: "Shared worlds", de: "Gemeinsame Welten" },
		title: { en: "Community projects", de: "Community Projekte" },
		copy: {
			en: "Minecraft, Palworld, and future servers with status, rules, and applications in one place.",
			de: "Minecraft, Palworld und kommende Server mit Status, Regeln und Bewerbungen an einem Ort.",
		},
		href: "/projects",
		link: { en: "Discover projects", de: "Projekte entdecken" },
	},
];

export default function Home() {
	const { locale, text } = useLocale();
	return (
		<>
			<section className="home-hero">
				<div className="home-hero-copy">
					<span className="kicker">
						<Flower2 size={15} /> {text("Welcome to Nachtara's Community Garden", "Willkommen in Nachtaras Community Garden")}
					</span>
					<h1>N4cht4r4</h1>
					<p className="home-tagline">
						{text(
							"A cozy place for streams, League nights, cherry blossoms, and a little controlled chaos.",
							"Ein gemütlicher Platz für Streams, League-Abende, Kirschblüten und ein bisschen kontrolliertes Chaos."
						)}
					</p>
					<div className="hero-actions">
						<Link className="button button-primary" href="/tournaments">
							<Trophy size={17} /> {text("Tournament hub", "Zum Turnierhub")}
						</Link>
						<a className="button button-discord-link" href="https://discord.gg/g69uYP97Qh" target="_blank" rel="noopener noreferrer">
							<span className="discord-button-mark">
								<DiscordMark size={14} />
							</span>{" "}
							{text("Community on Discord", "Community auf Discord")}
						</a>
					</div>
					<div className="home-notes" aria-label={text("Nachtara's community", "Nachtaras Community")}>
						<span>
							<Sparkles size={14} /> {text("German-speaking", "deutschsprachig")}
						</span>
						<span>
							<HeartHandshake size={14} /> cozy & competitive
						</span>
						<span>
							<Flower2 size={14} /> {text("since 2026", "seit 2026")}
						</span>
					</div>
				</div>
				<HomeLivePanel />
			</section>

			<section className="section-shell garden-intro">
				<div className="section-heading">
					<span className="kicker">{text("Three paths through the garden", "Drei Wege durch den Garten")}</span>
					<h2>{text("Find what matters right now.", "Finde direkt, was gerade wichtig ist.")}</h2>
					<p>
						{text(
							"This site is not a showcase. It is where the community actually organizes its projects.",
							"Die Seite ist kein Schaufenster. Sie ist der Ort, an dem die Community ihre Projekte wirklich organisiert."
						)}
					</p>
				</div>
				<div className="garden-path-grid">
					{gardenPaths.map((item, index) => {
						const Icon = item.icon;
						return (
							<article className="garden-path" key={item.href}>
								<span className="path-number">0{index + 1}</span>
								<Icon size={24} />
								<small>{item.eyebrow[locale]}</small>
								<h3>{item.title[locale]}</h3>
								<p>{item.copy[locale]}</p>
								<Link href={item.href}>
									{item.link[locale]} <ArrowRight size={15} />
								</Link>
							</article>
						);
					})}
				</div>
			</section>

			<section className="section-shell paper-strip">
				<div>
					<span className="kicker">{text("Everything in one place", "Alles an einem Ort")}</span>
					<h2>{text("Your community profile grows with you.", "Dein Community-Profil wächst mit.")}</h2>
					<p>
						{text(
							"Discord is your main account. Twitch tracks stream challenges, while Riot confirms your League progress. You decide what to connect.",
							"Discord ist dein Hauptkonto. Twitch zeichnet Stream-Challenges auf, Riot bestätigt deinen League-Fortschritt. Du entscheidest selbst, was du verknüpfst."
						)}
					</p>
				</div>
				<div className="connection-steps">
					<span>
						<b>1</b>
						<DiscordMark className="discord-step-logo" size={15} variant="blurple" /> Discord Login
					</span>
					<span>
						<b>2</b>
						<BookHeart size={18} /> {text("Connect accounts", "Konten verbinden")}
					</span>
					<span>
						<b>3</b>
						<Target size={18} /> {text("Collect progress", "Fortschritt sammeln")}
					</span>
				</div>
			</section>

			<section className="section-shell home-engagement-note">
				<div className="home-engagement-flower" aria-hidden="true">
					<HeartHandshake size={30} />
					<span>🌸</span>
				</div>
				<div>
					<span className="kicker">{text("Close to our hearts", "Was uns am Herzen liegt")}</span>
					<h2>
						{locale === "en" ? currentEngagement.titleEn : currentEngagement.title} · {text("fourth year in 2026", "2026 zum vierten Mal")}
					</h2>
					<p>
						{text(
							"Charity events and projects that Nachtara supports long-term or together with her community.",
							"Charity-Aktionen und Projekte, die Nachtara langfristig oder gemeinsam mit ihrer Community unterstützt."
						)}
					</p>
				</div>
				<Link href="/engagement">
					{text("Discover the causes", "Engagement entdecken")} <ArrowRight size={15} />
				</Link>
			</section>
		</>
	);
}
