"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { CalendarDays, Eye, Film, Flower2, Play, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Clip = {
	id: string;
	title: string;
	view_count: number;
	created_at: string;
	duration: number;
	thumbnail_url: string;
	url: string;
	game_name: string;
	creator_name?: string;
};

const sorts = [
	{ value: "views", en: "Popular", de: "Beliebt" },
	{ value: "date", en: "New", de: "Neu" },
];
const periods = [
	{ value: "7d", en: "7 days", de: "7 Tage" },
	{ value: "30d", en: "30 days", de: "30 Tage" },
	{ value: "all", en: "All", de: "Alle" },
];

export default function ClipsPage() {
	const { locale, text } = useLocale();
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	const [sort, setSort] = useState("views");
	const [period, setPeriod] = useState("all");
	const [limit, setLimit] = useState(18);
	const { data, isLoading } = useSWR<{ clips: Clip[]; total: number; hasMore: boolean; error?: string }>(
		`/api/twitch/clips?sort=${sort}&period=${period}&limit=${limit}`,
		fetcher,
		{
			refreshInterval: 300_000,
			keepPreviousData: true,
		}
	);
	const clips = data?.clips || [];

	return (
		<>
			<PageHero
				kicker={text("From the stream", "Aus dem Stream")}
				title={text("Moments worth keeping.", "Momente, die bleiben durften.")}
				copy={text(
					"Chaos, clutch plays, and little favourite moments from Nachtara's streams, collected directly from Twitch.",
					"Chaos, Clutches und kleine Lieblingsmomente aus Nachtaras Streams, direkt aus Twitch gesammelt."
				)}
				icon={<Film size={44} strokeWidth={1.6} />}
				compact
			/>

			<section className="content-band clips-archive">
				<div className="clips-archive-toolbar">
					<div>
						<span className="kicker">{text("Clip archive", "Clip-Archiv")}</span>
						<h2>{data ? `${data.total} ${text("Twitch moments", "Twitch-Momente")}` : text("Collecting Twitch moments", "Twitch-Momente werden gesammelt")}</h2>
						<p>
							{text(
								"Loaded directly from the channel and gently refreshed every five minutes.",
								"Direkt vom Kanal geladen und alle fünf Minuten behutsam aktualisiert."
							)}
						</p>
					</div>
					<div className="filter-bar" aria-label={text("Filter clips", "Clips filtern")}>
						<div className="filter-group">
							{sorts.map((option) => (
								<button
									className={`filter-btn ${sort === option.value ? "active" : ""}`}
									key={option.value}
									onClick={() => {
										setSort(option.value);
										setLimit(18);
									}}
								>
									{option[locale]}
								</button>
							))}
						</div>
						<div className="filter-group">
							{periods.map((option) => (
								<button
									className={`filter-btn ${period === option.value ? "active" : ""}`}
									key={option.value}
									onClick={() => {
										setPeriod(option.value);
										setLimit(18);
									}}
								>
									{option[locale]}
								</button>
							))}
						</div>
					</div>
				</div>

				{data?.error && <p className="form-error">{data.error}</p>}
				{isLoading && clips.length === 0 ? (
					<div className="skeleton clip-skeleton" />
				) : clips.length === 0 ? (
					<div className="empty-state">
						<Sparkles size={38} />
						<h3>{text("It is quiet here right now", "Gerade ist es hier ganz still")}</h3>
						<p>
							{text(
								"New Twitch clips will automatically appear in this collection as soon as they are available.",
								"Sobald neue Twitch-Clips verfügbar sind, landen sie automatisch in dieser Sammlung."
							)}
						</p>
					</div>
				) : (
					<div className="clips-grid">
						{clips.map((clip) => (
							<a className="clip-card" href={clip.url} key={clip.id} target="_blank" rel="noreferrer">
								<div className="clip-image">
									<Image src={clip.thumbnail_url} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" />
									<span className="clip-play">
										<Play size={18} fill="currentColor" />
									</span>
									<span className="clip-duration">
										{Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, "0")}
									</span>
								</div>
								<div className="clip-copy">
									<small>{clip.game_name || "N4cht4r4"}</small>
									<h2>{clip.title}</h2>
									<div className="clip-meta-line">
										<span>
											<Eye size={14} /> {clip.view_count.toLocaleString(intlLocale)}
										</span>
										<span>
											<CalendarDays size={14} /> {new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(clip.created_at))}
										</span>
									</div>
								</div>
							</a>
						))}
					</div>
				)}
				{data?.hasMore && (
					<div className="clips-load-more">
						<span>
							{clips.length} {text("of", "von")} {data.total} {text("visible", "sichtbar")}
						</span>
						<button className="button button-secondary" type="button" onClick={() => setLimit((current) => current + 18)}>
							<Flower2 size={15} /> {text("Show more clips", "Mehr Clips zeigen")}
						</button>
					</div>
				)}
			</section>
		</>
	);
}
