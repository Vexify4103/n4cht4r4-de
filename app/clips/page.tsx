"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { Eye, Film, Play, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";

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
};

const sorts = [{ value: "views", label: "Beliebt" }, { value: "date", label: "Neu" }];
const periods = [
	{ value: "7d", label: "7 Tage" },
	{ value: "30d", label: "30 Tage" },
	{ value: "all", label: "Alle" },
];

export default function ClipsPage() {
	const [sort, setSort] = useState("views");
	const [period, setPeriod] = useState("30d");
	const { data, isLoading } = useSWR<{ clips: Clip[] }>(`/api/twitch/clips?sort=${sort}&period=${period}`, fetcher, {
		refreshInterval: 300_000,
	});
	const clips = data?.clips || [];

	return (
		<>
			<PageHero
				kicker="Aus dem Stream"
				title="Momente, die bleiben durften."
				copy="Chaos, Clutches und kleine Lieblingsmomente aus Nachtaras Streams, direkt aus Twitch gesammelt."
				icon={<Film size={44} strokeWidth={1.6} />}
				compact
			/>

			<section className="content-band">
				<div className="filter-bar" aria-label="Clips filtern">
					<div className="filter-group">
						{sorts.map((option) => (
							<button className={`filter-btn ${sort === option.value ? "active" : ""}`} key={option.value} onClick={() => setSort(option.value)}>
								{option.label}
							</button>
						))}
					</div>
					<div className="filter-group">
						{periods.map((option) => (
							<button className={`filter-btn ${period === option.value ? "active" : ""}`} key={option.value} onClick={() => setPeriod(option.value)}>
								{option.label}
							</button>
						))}
					</div>
				</div>

				{isLoading ? <div className="skeleton clip-skeleton" /> : clips.length === 0 ? (
					<div className="empty-state">
						<Sparkles size={38} />
						<h3>Gerade ist es hier ganz still</h3>
						<p>Sobald neue Twitch-Clips verfügbar sind, landen sie automatisch in dieser Sammlung.</p>
					</div>
				) : (
					<div className="clips-grid">
						{clips.map((clip) => (
							<a className="clip-card" href={clip.url} key={clip.id} target="_blank" rel="noreferrer">
								<div className="clip-image">
									<Image src={clip.thumbnail_url} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" />
									<span className="clip-play"><Play size={18} fill="currentColor" /></span>
									<span className="clip-duration">{Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, "0")}</span>
								</div>
								<div className="clip-copy">
									<small>{clip.game_name || "N4cht4r4"}</small>
									<h2>{clip.title}</h2>
									<span><Eye size={14} /> {clip.view_count.toLocaleString("de-DE")} Aufrufe</span>
								</div>
							</a>
						))}
					</div>
				)}
			</section>
		</>
	);
}
