"use client";

import Link from "next/link";
import { ArrowRight, CalendarHeart, Droplets, ExternalLink, Flower2, HeartHandshake, PawPrint } from "lucide-react";
import { engagementEntries } from "@/lib/engagement";
import { useLocale } from "@/components/LocaleProvider";

const categoryLabels = {
	ongoing: { en: "Long-term support", de: "Langfristig unterstützt" },
	recurring: { en: "Recurring campaign", de: "Wiederkehrende Aktion" },
	past: { en: "Past campaign", de: "Vergangenes" },
};

const categoryIcons = {
	ongoing: Droplets,
	recurring: PawPrint,
	past: CalendarHeart,
};

export default function EngagementPage() {
	const { locale, text } = useLocale();
	return (
		<>
			<section className="engagement-hero">
				<div className="engagement-hero-copy">
					<span className="kicker">
						<HeartHandshake size={15} /> {text("Quiet support, shared impact", "Leise helfen, gemeinsam wirken")}
					</span>
					<h1>{text("Causes close to my heart.", "Was mir am Herzen liegt.")}</h1>
					<p>
						{text(
							"Helping does not have to be loud. Here you will find projects and campaigns that matter to me personally. Perhaps one of them will inspire you to do a little good in your own community, too.",
							"Helfen muss nicht laut sein. Hier findest du Projekte und Aktionen, die mir persönlich wichtig sind. Vielleicht ist etwas dabei, das auch dich dazu bewegt, in deinem eigenen Umfeld ein kleines bisschen Gutes weiterzugeben."
						)}
					</p>
					<a className="button button-primary" href="https://www.raid4aid.de/" target="_blank" rel="noopener noreferrer">
						<PawPrint size={17} /> {text("Discover Raid4Aid", "Raid4Aid entdecken")}
					</a>
				</div>
				<div className="engagement-hero-mark" aria-hidden="true">
					<span>🌸</span>
					<HeartHandshake size={64} strokeWidth={1.2} />
					<small>{text("from the heart", "von Herzen")}</small>
				</div>
			</section>

			<section className="content-band engagement-intro-line">
				<span>{text("Not a showcase of good deeds", "Kein Schaukasten für gute Taten")}</span>
				<p>
					{text(
						"This page is not a tally. It gives good projects visibility and shows the direct path to the people working on them every day.",
						"Diese Seite ist keine Bilanz. Sie soll gute Projekte sichtbar machen und den direkten Weg zu den Menschen zeigen, die jeden Tag daran arbeiten."
					)}
				</p>
			</section>

			<section className="content-band engagement-journal" aria-labelledby="engagement-journal-title">
				<header className="engagement-journal-heading">
					<div>
						<span className="kicker">{text("Nachtara's heartfelt causes", "Nachtaras Herzenssachen")}</span>
						<h2 id="engagement-journal-title">{text("What is growing now and what deserves to remain.", "Was gerade wächst und was bleiben darf.")}</h2>
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
										<span>{categoryLabels[entry.category][locale]}</span>
										<time>{locale === "en" ? entry.periodEn : entry.period}</time>
									</header>
									<h3>{locale === "en" ? entry.titleEn : entry.title}</h3>
									<strong>{locale === "en" ? entry.organisationEn : entry.organisation}</strong>
									<p>{locale === "en" ? entry.descriptionEn : entry.description}</p>
									{entry.href && (
										<a href={entry.href} target="_blank" rel="noopener noreferrer">
											{locale === "en" ? entry.linkLabelEn : entry.linkLabel} <ExternalLink size={14} />
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
					<span>{text("Help directly", "Direkt helfen")}</span>
					<h2>{text("Your contribution does not pass through this website.", "Dein Beitrag geht nicht über diese Website.")}</h2>
					<p>
						{text(
							"All donation links lead directly to the organisers, organisations, or a recognised donation platform.",
							"Alle Spendenlinks führen direkt zu den Veranstaltern, den Organisationen oder einer anerkannten Spendenplattform."
						)}
					</p>
				</div>
				<Link href="/" className="engagement-home-link">
					{text("Back to the Community Garden", "Zurück in den Community Garden")} <ArrowRight size={15} />
				</Link>
			</section>
		</>
	);
}
