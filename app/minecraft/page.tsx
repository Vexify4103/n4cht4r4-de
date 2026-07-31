import Link from "next/link";
import { BookOpenCheck, Castle, Flower2, Hammer, ShieldCheck, Timer } from "lucide-react";
import { PageHero } from "@/components/PageHero";

const rules = [
	"Behandle alle Spieler respektvoll und halte Konflikte aus dem öffentlichen Chat.",
	"Kein Griefing, kein Diebstahl und keine Veränderungen an fremden Bauten ohne Erlaubnis.",
	"Cheats, X-Ray, Exploits und unerlaubte Client-Modifikationen sind ausgeschlossen.",
	"Große Bauprojekte und Farmen werden vorab mit dem Team abgestimmt.",
	"Die Entscheidungen des Moderationsteams gelten für den Server.",
	"Gemeinschaft und Spaß stehen vor Fortschritt und Konkurrenz.",
];

const projects = [
	{ name: "Nachtara SMP", description: "Die gemeinsame Survival-Welt mit Whitelist, kleinen Geschichten und langfristigen Bauprojekten.", status: "Bewerbungen in Vorbereitung", icon: Castle },
	{ name: "Community-Bauwelt", description: "Eine kreative Welt für gemeinsame Builds, Themenabende und Community-Ideen.", status: "Coming Soon", icon: Hammer },
	{ name: "Saisonale Events", description: "Zeitlich begrenzte Abenteuer, Bauwettbewerbe und kleine Server-Challenges.", status: "Coming Soon", icon: Flower2 },
];

export default function MinecraftPage() {
	return (
		<>
			<PageHero
				kicker="Minecraft bei Nachtara"
				title="Eine Welt, die gemeinsam wächst."
				copy="Hier entstehen Nachtaras SMP-Projekte: mit klaren Regeln, liebevollen Builds und Platz für Menschen, die wirklich Teil der Community sein möchten."
				icon={<Castle />}
			>
				<Link className="button button-primary" href="/bewerbungen">Zu den Bewerbungen</Link>
			</PageHero>

			<section className="content-band">
				<div className="section-heading">
					<span>Unsere Welten</span>
					<h2>Aktuelle und kommende Projekte</h2>
					<p>Jedes Projekt erhält später seine eigene Seite mit Status, Mitspielern und allen wichtigen Terminen.</p>
				</div>
				<div className="project-grid">
					{projects.map(({ name, description, status, icon: Icon }) => (
						<article className="project-card" key={name}>
							<Icon size={25} />
							<h3>{name}</h3>
							<p>{description}</p>
							<span className="coming-soon"><Timer size={14} /> {status}</span>
						</article>
					))}
				</div>
			</section>

			<section className="content-band">
				<div className="section-heading">
					<span>Serverregeln</span>
					<h2>Damit es für alle gemütlich bleibt</h2>
				</div>
				<div className="rules-list">
					{rules.map((rule, index) => (
						<div className="rule-item" key={rule}>
							<span className="rule-number">{String(index + 1).padStart(2, "0")}</span>
							<span className="rule-text">{rule}</span>
						</div>
					))}
				</div>
			</section>

			<section className="callout-band">
				<BookOpenCheck size={27} />
				<div>
					<h2>Bewerbungen öffnen bald</h2>
					<p>Wenn ein Projekt Plätze anbietet, findest du hier das passende Formular und alle Voraussetzungen.</p>
				</div>
				<ShieldCheck size={24} />
			</section>
		</>
	);
}
