"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight, Flower2, Megaphone, Trophy, Youtube, Heart, Users } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { NewsItem } from "@/lib/news";

const icons = { youtube: Youtube, tournament: Trophy, applications: Users, kofi: Heart, community: Flower2 };
const labels = {
	youtube: ["YouTube", "YouTube"],
	tournament: ["Tournament", "Turnier"],
	applications: ["Applications", "Bewerbungen"],
	kofi: ["Ko-fi", "Ko-fi"],
	community: ["Community", "Community"],
};
export function HomeNews() {
	const { locale, text } = useLocale();
	const { data } = useSWR<{ news: NewsItem[] }>("/api/news", (url: string) => fetch(url).then((r) => r.json()), { revalidateOnFocus: false });
	if (!data?.news?.length) return null;
	return (
		<section className="section-shell home-news" aria-labelledby="news-title">
			<div className="section-heading">
				<span className="kicker">
					<Megaphone size={16} /> {text("Fresh from the garden", "Frisch aus dem Garten")}
				</span>
				<h2 id="news-title">
					{text("What's blooming?", "Was blüht gerade auf?")} <span aria-hidden="true">🌸</span>
				</h2>
			</div>
			<div className="news-grid">
				{data.news.map((item) => {
					const Icon = icons[item.category] || Flower2;
					return (
						<article className="news-note" key={item.id}>
							<div className="news-meta">
								<span>
									<Icon size={17} /> {labels[item.category]?.[locale === "en" ? 0 : 1]}
								</span>
								<time dateTime={item.createdAt}>
									{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "short" }).format(new Date(item.createdAt))}
								</time>
							</div>
							<h3>{locale === "en" && item.titleEn ? item.titleEn : item.title}</h3>
							<p>{locale === "en" && item.bodyEn ? item.bodyEn : item.body}</p>
							{item.href &&
								(item.href.startsWith("/") ? (
									<Link className="text-link" href={item.href}>
										{text("Take a look", "Reinschauen")} <ArrowUpRight size={16} />
									</Link>
								) : (
									<a className="text-link" href={item.href} target="_blank" rel="noopener noreferrer">
										{text("Take a look", "Reinschauen")} <ArrowUpRight size={16} />
									</a>
								))}
						</article>
					);
				})}
			</div>
		</section>
	);
}
