import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarHeart, Droplets, ExternalLink, Flower2, HeartHandshake, PawPrint } from "lucide-react";
import { engagementEntries } from "@/lib/engagement";

export const metadata: Metadata = {
	title: "Engagement & Charity",
	description: "Charity-Aktionen und Projekte, die Nachtara langfristig oder gemeinsam mit ihrer Community unterstützt.",
};

const categoryLabels = {
	ongoing: "Langfristig unterstützt",
	recurring: "Wiederkehrende Aktion",
	past: "Vergangenes",
};

const categoryIcons = {
	ongoing: Droplets,
	recurring: PawPrint,
	past: CalendarHeart,
};

export default function EngagementPage() {
	return (
		<>
			<section className="engagement-hero">
				<div className="engagement-hero-copy">
					<span className="kicker">
						<HeartHandshake size={15} /> Leise helfen, gemeinsam wirken
					</span>
					<h1>Was mir am Herzen liegt.</h1>
					<p>
						Helfen muss nicht laut sein. Hier findest du Projekte und Aktionen, die mir persönlich wichtig sind. Vielleicht ist etwas dabei, das auch dich dazu bewegt,
						in deinem eigenen Umfeld ein kleines bisschen Gutes weiterzugeben.
					</p>
					<a className="button button-primary" href="https://www.raid4aid.de/" target="_blank" rel="noopener noreferrer">
						<PawPrint size={17} /> Raid4Aid entdecken
					</a>
				</div>
				<div className="engagement-hero-mark" aria-hidden="true">
					<span>🌸</span>
					<HeartHandshake size={64} strokeWidth={1.2} />
					<small>von Herzen</small>
				</div>
			</section>

			<section className="content-band engagement-intro-line">
				<span>Kein Schaukasten für gute Taten</span>
				<p>Diese Seite ist keine Bilanz. Sie soll gute Projekte sichtbar machen und den direkten Weg zu den Menschen zeigen, die jeden Tag daran arbeiten.</p>
			</section>

			<section className="content-band engagement-journal" aria-labelledby="engagement-journal-title">
				<header className="engagement-journal-heading">
					<div>
						<span className="kicker">Nachtaras Herzenssachen</span>
						<h2 id="engagement-journal-title">Was gerade wächst und was bleiben darf.</h2>
					</div>
					<Flower2 size={31} strokeWidth={1.4} />
				</header>

				<div className="engagement-timeline">
					{engagementEntries.map((entry, index) => {
						const Icon = categoryIcons[entry.category];
						return (
							<article className={`engagement-entry ${entry.category}`} key={entry.id}>
								<div className="engagement-entry-marker">
									<span>{String(index + 1).padStart(2, "0")}</span>
									<Icon size={22} />
								</div>
								<div className="engagement-entry-body">
									<header>
										<span>{categoryLabels[entry.category]}</span>
										<time>{entry.period}</time>
									</header>
									<h3>{entry.title}</h3>
									<strong>{entry.organisation}</strong>
									<p>{entry.description}</p>
									{entry.href && (
										<a href={entry.href} target="_blank" rel="noopener noreferrer">
											{entry.linkLabel} <ExternalLink size={14} />
										</a>
									)}
								</div>
							</article>
						);
					})}
				</div>
			</section>

			<section className="content-band engagement-transparency">
				<Flower2 size={25} />
				<div>
					<span>Direkt helfen</span>
					<h2>Dein Beitrag geht nicht über diese Website.</h2>
					<p>Alle Spendenlinks führen direkt zu den Veranstaltern, den Organisationen oder einer anerkannten Spendenplattform.</p>
				</div>
				<Link href="/" className="engagement-home-link">
					Zurück in den Community Garden <ArrowRight size={15} />
				</Link>
			</section>
		</>
	);
}
