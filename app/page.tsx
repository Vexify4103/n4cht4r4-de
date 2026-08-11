import Link from "next/link";
import { ArrowRight, BookHeart, Flower2, Gamepad2, HeartHandshake, Sparkles, Target, Trophy } from "lucide-react";
import { HomeLivePanel } from "@/components/HomeLivePanel";
import { DiscordMark } from "@/components/DiscordMark";
import { currentEngagement } from "@/lib/engagement";

const gardenPaths = [
	{
		icon: Trophy,
		eyebrow: "League Events",
		title: "Turniergarten",
		text: "Anmeldungen, Teams, Spielpläne, Playoffs und Ergebnisse an einem festen Ort.",
		href: "/tournaments",
		link: "Turniere öffnen",
	},
	{
		icon: Target,
		eyebrow: "Für dich & alle",
		title: "Community Challenges",
		text: "Riot-Fortschritt, Watchtime und gemeinsame Ziele, die automatisch mitwachsen.",
		href: "/challenges",
		link: "Challenges ansehen",
	},
	{
		icon: Gamepad2,
		eyebrow: "Gemeinsame Welten",
		title: "Community Projekte",
		text: "Minecraft, Palworld und kommende Server mit Status, Regeln und Bewerbungen an einem Ort.",
		href: "/projects",
		link: "Projekte entdecken",
	},
];

export default function Home() {
	return (
		<>
			<section className="home-hero">
				<div className="home-hero-copy">
					<span className="kicker">
						<Flower2 size={15} /> Willkommen in Nachtaras Community Garden
					</span>
					<h1>N4cht4r4</h1>
					<p className="home-tagline">Ein gemütlicher Platz für Streams, League-Abende, Kirschblüten und ein bisschen kontrolliertes Chaos.</p>
					<div className="hero-actions">
						<Link className="button button-primary" href="/tournaments">
							<Trophy size={17} /> Zum Turnierhub
						</Link>
						<a className="button button-discord-link" href="https://discord.gg/g69uYP97Qh" target="_blank" rel="noopener noreferrer">
							<span className="discord-button-mark">
								<DiscordMark size={14} />
							</span>{" "}
							Community auf Discord
						</a>
					</div>
					<div className="home-notes" aria-label="Nachtaras Community">
						<span>
							<Sparkles size={14} /> deutschsprachig
						</span>
						<span>
							<HeartHandshake size={14} /> cozy & competitive
						</span>
						<span>
							<Flower2 size={14} /> seit 2026
						</span>
					</div>
				</div>
				<HomeLivePanel />
			</section>

			<section className="section-shell garden-intro">
				<div className="section-heading">
					<span className="kicker">Drei Wege durch den Garten</span>
					<h2>Finde direkt, was gerade wichtig ist.</h2>
					<p>Die Seite ist kein Schaufenster. Sie ist der Ort, an dem die Community ihre Projekte wirklich organisiert.</p>
				</div>
				<div className="garden-path-grid">
					{gardenPaths.map((item, index) => {
						const Icon = item.icon;
						return (
							<article className="garden-path" key={item.title}>
								<span className="path-number">0{index + 1}</span>
								<Icon size={24} />
								<small>{item.eyebrow}</small>
								<h3>{item.title}</h3>
								<p>{item.text}</p>
								<Link href={item.href}>
									{item.link} <ArrowRight size={15} />
								</Link>
							</article>
						);
					})}
				</div>
			</section>

			<section className="section-shell paper-strip">
				<div>
					<span className="kicker">Alles an einem Ort</span>
					<h2>Dein Community-Profil wächst mit.</h2>
					<p>Discord ist dein Hauptkonto. Twitch zeichnet Stream-Challenges auf, Riot bestätigt deinen League-Fortschritt. Du entscheidest selbst, was du verknüpfst.</p>
				</div>
				<div className="connection-steps">
					<span>
						<b>1</b>
						<DiscordMark className="discord-step-logo" size={15} variant="blurple" /> Discord Login
					</span>
					<span>
						<b>2</b>
						<BookHeart size={18} /> Konten verbinden
					</span>
					<span>
						<b>3</b>
						<Target size={18} /> Fortschritt sammeln
					</span>
				</div>
			</section>

			<section className="section-shell home-engagement-note">
				<div className="home-engagement-flower" aria-hidden="true">
					<HeartHandshake size={30} />
					<span>🌸</span>
				</div>
				<div>
					<span className="kicker">Was uns am Herzen liegt</span>
					<h2>{currentEngagement.title} · 2026 zum vierten Mal</h2>
					<p>Charity-Aktionen und Projekte, die Nachtara langfristig oder gemeinsam mit ihrer Community unterstützt.</p>
				</div>
				<Link href="/engagement">
					Engagement entdecken <ArrowRight size={15} />
				</Link>
			</section>
		</>
	);
}
