"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarHeart, Clock3, Coffee, ExternalLink, Gift, HeartHandshake, Radio, Star } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { useLocale } from "@/components/LocaleProvider";
import { site } from "@/lib/site";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type Donation = { name: string; amountCents: number; currency: string };
type Segment = { id: string; start_time: string; end_time: string; title: string; canceled_until: string | null; category: { name: string } | null };
type Schedule = { segments: Segment[]; isLive: boolean };

export default function InfoPage() {
	const { locale, text } = useLocale();
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	const { data: schedule } = useSWR<Schedule>("/api/twitch/schedule", fetcher, { refreshInterval: 300_000 });
	const { data: donationData } = useSWR<{ donations: Donation[] }>("/api/donations/top", fetcher, { refreshInterval: 3_600_000 });
	const streams = (schedule?.segments || []).filter((segment) => !segment.canceled_until).slice(0, 6);
	const donations = donationData?.donations || [];
	const dateLabel = (value: string) => new Intl.DateTimeFormat(intlLocale, { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(value));
	const timeLabel = (value: string) => new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
	const donationLabel = (donation: Donation) => new Intl.NumberFormat(intlLocale, { style: "currency", currency: donation.currency || "EUR" }).format(donation.amountCents / 100);

	return (
		<>
			<PageHero
				kicker={text("Nachtara's stream room", "Nachtaras Streamzimmer")}
				title={text("Dates, support, and everything important.", "Termine, Support und alles Wichtige.")}
				copy={text(
					"A calm overview of the next stream week, official support links, and the people who especially support Nachtara's projects.",
					"Der ruhige Überblick für die nächste Streamwoche, offizielle Support-Links und die Menschen, die Nachtaras Projekte besonders unterstützen."
				)}
				icon={<CalendarHeart size={44} strokeWidth={1.6} />}
			>
				<a className="button button-primary" href={site.twitchUrl} target="_blank" rel="noreferrer">
					<Radio size={17} /> {schedule?.isLive ? text("Watch live now", "Jetzt live ansehen") : text("Twitch channel", "Zum Twitch-Kanal")}
				</a>
			</PageHero>
			<section className="content-band">
				<div className="section-heading">
					<span>{text("Stream calendar", "Streamkalender")}</span>
					<h2>{text("The next evenings with Nachtara", "Die nächsten Abende mit Nachtara")}</h2>
					<p>{text("The calendar is read automatically from Nachtara's Twitch schedule.", "Der Kalender wird automatisch aus Nachtaras Twitch-Zeitplan gelesen.")}</p>
				</div>
				<div className="schedule-grid">
					{streams.length ? (
						streams.map((stream) => (
							<div className="schedule-item" key={stream.id}>
								<strong className="schedule-day">{dateLabel(stream.start_time)}</strong>
								<span className="schedule-time">
									<Clock3 size={15} /> {timeLabel(stream.start_time)} {locale === "de" ? "Uhr" : ""}
								</span>
								<span className="schedule-game">{stream.category?.name || stream.title || "Stream"}</span>
							</div>
						))
					) : (
						<div className="empty-state compact-empty">
							<CalendarHeart size={29} />
							<h3>{text("Nothing scheduled yet", "Noch nichts eingetragen")}</h3>
							<p>{text("New Twitch dates appear here automatically.", "Neue Twitch-Termine erscheinen hier automatisch.")}</p>
						</div>
					)}
				</div>
			</section>
			<section className="content-band">
				<div className="feature-grid">
					<article className="feature-card">
						<Coffee size={27} />
						<h2>Ko-Fi</h2>
						<p>
							{text(
								"A direct way to support Nachtara and upcoming community projects.",
								"Ein direkter Weg, Nachtara und kommende Community-Projekte zu unterstützen."
							)}
						</p>
						<a className="text-link" href={site.koFiUrl} target="_blank" rel="noreferrer">
							{text("Open Ko-Fi", "Ko-Fi öffnen")} <ExternalLink size={15} />
						</a>
					</article>
					<article className="feature-card">
						<Gift size={27} />
						<h2>{text("Wish list", "Wunschliste")}</h2>
						<p>
							{text(
								"Small and big wishes for streams, the setup, and cozy community evenings.",
								"Kleine und große Wünsche für Stream, Setup und gemütliche Community-Abende."
							)}
						</p>
						{site.amazonWishlistUrl ? (
							<a className="text-link" href={site.amazonWishlistUrl} target="_blank" rel="noreferrer">
								{text("Open wish list", "Wunschliste öffnen")} <ExternalLink size={15} />
							</a>
						) : (
							<span className="muted-note">{text("Coming soon.", "Wird bald ergänzt.")}</span>
						)}
					</article>
					<article className="feature-card">
						<Star size={27} />
						<h2>Top Supporters</h2>
						<p>{text("The five largest publicly recorded contributions.", "Die fünf größten öffentlich erfassten Unterstützungen.")}</p>
						<div className="donation-list">
							{donations.length ? (
								donations.map((donation, index) => (
									<div className="donation-entry" key={`${donation.name}-${index}`}>
										<strong>
											{index + 1}. {donation.name}
										</strong>
										<span>{donationLabel(donation)}</span>
									</div>
								))
							) : (
								<span className="donation-empty">{text("No public entries yet.", "Noch keine öffentlichen Einträge.")}</span>
							)}
						</div>
					</article>
				</div>
			</section>
			<section className="content-band info-engagement-note">
				<HeartHandshake size={34} strokeWidth={1.5} />
				<div>
					<span className="kicker">{text("More than streams & games", "Mehr als Stream & Spiel")}</span>
					<h2>{text("Projects close to Nachtara's heart.", "Projekte, die Nachtara am Herzen liegen.")}</h2>
					<p>
						{text(
							"From recurring charity streams to long-term personal support.",
							"Von wiederkehrenden Charity-Streams bis zu langfristiger persönlicher Unterstützung."
						)}
					</p>
				</div>
				<Link href="/engagement">
					{text("View causes", "Zum Engagement")} <ArrowRight size={15} />
				</Link>
			</section>
		</>
	);
}
