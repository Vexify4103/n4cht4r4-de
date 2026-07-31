"use client";

import useSWR from "swr";
import { CalendarHeart, Clock3, Coffee, ExternalLink, Gift, Radio, Star } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { site } from "@/lib/site";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Donation = { name: string; amountCents: number; currency: string };
type Segment = {
	id: string;
	start_time: string;
	end_time: string;
	title: string;
	canceled_until: string | null;
	category: { name: string } | null;
};
type Schedule = { segments: Segment[]; isLive: boolean };

function dateLabel(value: string) {
	return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function timeLabel(value: string) {
	return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function donationLabel(donation: Donation) {
	return new Intl.NumberFormat("de-DE", { style: "currency", currency: donation.currency || "EUR" }).format(donation.amountCents / 100);
}

export default function InfoPage() {
	const { data: schedule } = useSWR<Schedule>("/api/twitch/schedule", fetcher, { refreshInterval: 300_000 });
	const { data: donationData } = useSWR<{ donations: Donation[] }>("/api/donations/top", fetcher, { refreshInterval: 3_600_000 });
	const streams = (schedule?.segments || []).filter((segment) => !segment.canceled_until).slice(0, 6);
	const donations = donationData?.donations || [];

	return (
		<>
			<PageHero
				kicker="Nachtaras Streamzimmer"
				title="Termine, Support und alles Wichtige."
				copy="Der ruhige Überblick für die nächste Streamwoche, offizielle Support-Links und die Menschen, die Nachtaras Projekte besonders unterstützen."
				icon={<CalendarHeart size={44} strokeWidth={1.6} />}
			>
				<a className="button button-primary" href={site.twitchUrl} target="_blank" rel="noreferrer">
					<Radio size={17} /> {schedule?.isLive ? "Jetzt live ansehen" : "Zum Twitch-Kanal"}
				</a>
			</PageHero>

			<section className="content-band">
				<div className="section-heading">
					<span>Streamkalender</span>
					<h2>Die nächsten Abende mit Nachtara</h2>
					<p>Der Kalender wird automatisch aus Nachtaras Twitch-Zeitplan gelesen.</p>
				</div>
				<div className="schedule-grid">
					{streams.length > 0 ? streams.map((stream) => (
						<div className="schedule-item" key={stream.id}>
							<strong className="schedule-day">{dateLabel(stream.start_time)}</strong>
							<span className="schedule-time"><Clock3 size={15} /> {timeLabel(stream.start_time)} Uhr</span>
							<span className="schedule-game">{stream.category?.name || stream.title || "Stream"}</span>
						</div>
					)) : (
						<div className="empty-state compact-empty">
							<CalendarHeart size={29} />
							<h3>Noch nichts eingetragen</h3>
							<p>Neue Twitch-Termine erscheinen hier automatisch.</p>
						</div>
					)}
				</div>
			</section>

			<section className="content-band">
				<div className="feature-grid">
					<article className="feature-card">
						<Coffee size={27} />
						<h2>Ko-Fi</h2>
						<p>Ein direkter Weg, Nachtara und kommende Community-Projekte zu unterstützen.</p>
						<a className="text-link" href={site.koFiUrl} target="_blank" rel="noreferrer">Ko-Fi öffnen <ExternalLink size={15} /></a>
					</article>
					<article className="feature-card">
						<Gift size={27} />
						<h2>Wunschliste</h2>
						<p>Kleine und große Wünsche für Stream, Setup und gemütliche Community-Abende.</p>
						{site.amazonWishlistUrl ? (
							<a className="text-link" href={site.amazonWishlistUrl} target="_blank" rel="noreferrer">Wunschliste öffnen <ExternalLink size={15} /></a>
						) : <span className="muted-note">Wird bald ergänzt.</span>}
					</article>
					<article className="feature-card">
						<Star size={27} />
						<h2>Top Supporter</h2>
						<p>Die fünf größten öffentlich erfassten Unterstützungen.</p>
						<div className="donation-list">
							{donations.length > 0 ? donations.map((donation, index) => (
								<div className="donation-entry" key={`${donation.name}-${index}`}>
									<strong>{index + 1}. {donation.name}</strong>
									<span>{donationLabel(donation)}</span>
								</div>
							)) : <span className="donation-empty">Noch keine öffentlichen Einträge.</span>}
						</div>
					</article>
				</div>
			</section>
		</>
	);
}
