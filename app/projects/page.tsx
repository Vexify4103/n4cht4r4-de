"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, BookOpenCheck, Flower2, Gamepad2, HeartHandshake, Radio, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import type { CommunityProject } from "@/lib/community";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
const statusLabels = {
	online: { en: "Active now", de: "Gerade aktiv" },
	planning: { en: "In planning", de: "In Planung" },
	paused: { en: "Currently paused", de: "Macht gerade Pause" },
	ended: { en: "In the archive", de: "Im Archiv" },
};

export default function ProjectsPage() {
	const { locale, text } = useLocale();
	const { data, isLoading } = useSWR<{ projects: CommunityProject[] }>("/api/community/projects", fetcher, { revalidateOnFocus: false });
	const projects = data?.projects || [];

	return (
		<>
			<PageHero
				kicker={text("Together instead of alone", "Gemeinsam statt allein")}
				title={text("Nachtara's community worlds.", "Nachtaras Community-Welten.")}
				copy={text(
					"Minecraft seasons, Palworld servers, and everything the community builds, plays, or makes a little chaotic next.",
					"Minecraft-Saisons, Palworld-Server und alles, was die Community als Nächstes gemeinsam baut, spielt oder ein kleines bisschen chaotisch macht."
				)}
				icon={<Gamepad2 size={44} strokeWidth={1.6} />}
			>
				<Link className="button button-primary" href="/community">
					<HeartHandshake size={17} /> {text("Community wall", "Zur Community-Pinnwand")}
				</Link>
			</PageHero>

			<section className="content-band community-projects-band">
				<header className="community-projects-heading">
					<div>
						<span className="kicker">{text("Current & next", "Aktuell & als Nächstes")}</span>
						<h2>{text("Worlds with a place for you.", "Welten mit einem Platz für dich.")}</h2>
					</div>
					<p>
						{text(
							"Every project follows its own rhythm. Status, rules, and applications are updated here as soon as details are settled.",
							"Jedes Projekt bekommt seinen eigenen Rhythmus. Status, Regeln und Bewerbungen werden hier aktualisiert, sobald etwas feststeht."
						)}
					</p>
				</header>

				{isLoading ? (
					<div className="skeleton project-hub-skeleton" />
				) : (
					<div className="community-project-journal">
						{projects.map((project, index) => (
							<article className="community-project-story" key={project.id}>
								<div className="community-project-art">
									<Image
										src={project.imageUrl || "/images/hanami-light-v1.png"}
										alt={`${project.title} ${text("project preview", "Projektansicht")}`}
										fill
										sizes="(max-width: 820px) 100vw, 55vw"
										priority={index === 0}
									/>
									<span className={`community-project-status ${project.status}`}>
										<Radio size={12} /> {project.statusLabel || statusLabels[project.status][locale]}
									</span>
								</div>
								<div className="community-project-copy">
									<span className="project-game">
										{String(index + 1).padStart(2, "0")} · {project.game}
									</span>
									<h2>{project.title}</h2>
									<p className="project-summary">{project.summary}</p>
									<p>{project.details}</p>
									{project.rules.length > 0 && (
										<div className="project-rule-notes">
											<span>
												<BookOpenCheck size={15} /> {text("What matters to us", "Das ist uns wichtig")}
											</span>
											{project.rules.map((rule) => (
												<small key={rule}>
													<Flower2 size={10} /> {rule}
												</small>
											))}
										</div>
									)}
									{project.applicationHref ? (
										<Link className="text-link" href={project.applicationHref}>
											{text("Application and participation", "Bewerbung und Teilnahme")} <ArrowRight size={15} />
										</Link>
									) : (
										<span className="project-gentle-note">
											<Sparkles size={14} />{" "}
											{text("More information will follow once the server is ready.", "Weitere Infos folgen, sobald der Server bereit ist.")}
										</span>
									)}
								</div>
							</article>
						))}
						{projects.length === 0 && (
							<div className="empty-state">
								<Gamepad2 size={36} />
								<h3>{text("The next shared adventure is still being planned", "Der nächste gemeinsame Ausflug wird noch geplant")}</h3>
								<p>{text("As soon as a new world is confirmed, it will appear right here.", "Sobald eine neue Welt feststeht, erscheint sie genau hier.")}</p>
							</div>
						)}
					</div>
				)}
			</section>
		</>
	);
}
