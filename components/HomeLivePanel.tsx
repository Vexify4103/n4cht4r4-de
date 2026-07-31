"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Radio, Twitch } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Segment = {
	id: string;
	start_time: string;
	title: string;
	category: { name: string } | null;
};

type LiveStream = {
	title: string;
	category: string;
	viewerCount: number;
	startedAt: string | null;
};

export function HomeLivePanel() {
	const [embedParent, setEmbedParent] = useState("");
	const [canEmbed, setCanEmbed] = useState(false);
	const { data } = useSWR<{ segments: Segment[]; isLive: boolean; live: LiveStream | null }>("/api/twitch/schedule", fetcher, {
		refreshInterval: 60_000,
	});
	const next = data?.segments?.find((segment) => new Date(segment.start_time).getTime() > Date.now());

	useEffect(() => {
		setEmbedParent(window.location.hostname);
		const media = window.matchMedia("(min-width: 440px)");
		const updateEmbedSupport = () => setCanEmbed(media.matches);
		updateEmbedSupport();
		media.addEventListener("change", updateEmbedSupport);
		return () => media.removeEventListener("change", updateEmbedSupport);
	}, []);

	const live = data?.live;
	const embedUrl = embedParent
		? `https://player.twitch.tv/?channel=n4cht4r4&parent=${encodeURIComponent(embedParent)}&muted=true&autoplay=true`
		: "";

	return (
		<aside className={`live-panel ${data?.isLive ? "is-live" : ""}`}>
			<div className="live-panel-top">
				<span className={data?.isLive ? "live-state is-live" : "live-state"}>
					<Radio size={14} />
					{!data ? "Status wird geladen" : data.isLive ? "Jetzt live" : "Gerade offline"}
				</span>
				<span className="live-panel-channel"><Twitch size={19} aria-hidden="true" /> n4cht4r4</span>
			</div>

			{data?.isLive ? (
				<>
					{canEmbed && embedUrl ? (
						<div className="live-panel-player">
							<iframe
								src={embedUrl}
								title="N4cht4r4 live auf Twitch"
								allow="autoplay; fullscreen; picture-in-picture"
								allowFullScreen
							/>
							<span className="live-player-bloom" aria-hidden="true">✿</span>
						</div>
					) : (
						<div className="live-panel-mobile-live">
							<Radio size={30} />
							<strong>Der Stream läuft gerade.</strong>
							<a className="button button-primary" href="https://www.twitch.tv/n4cht4r4" target="_blank" rel="noopener noreferrer">Auf Twitch ansehen <ExternalLink size={15} /></a>
						</div>
					)}
					<div className="live-panel-stream-copy">
						<span>Gerade im Stream</span>
						<h2>{live?.title || "Komm ins pinke Zimmer."}</h2>
						<p>{live?.category || "Live mit der Community"}{live?.viewerCount ? ` · ${live.viewerCount.toLocaleString("de-DE")} schauen zu` : ""}</p>
					</div>
				</>
			) : (
				<div className="live-panel-copy">
					<span>Nächster Stream</span>
					<h2>{next?.title || "Der nächste Abend wird noch geplant."}</h2>
					<p>{next
						? `${new Date(next.start_time).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })} · ${new Date(next.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
						: "Auf Discord erfährst du zuerst, wann es weitergeht."}</p>
				</div>
			)}

			<div className="live-panel-bottom">
				<span><CalendarDays size={15} /> {data?.isLive ? live?.category || "Live" : next?.category?.name || "Just Chatting · League · Minecraft"}</span>
				<a href="https://www.twitch.tv/n4cht4r4" target="_blank" rel="noopener noreferrer">
					{data?.isLive ? "Im neuen Tab öffnen" : "Zu Twitch"} <ExternalLink size={14} />
				</a>
			</div>
		</aside>
	);
}
