"use client";

import { Coffee, ExternalLink, Instagram, MessageCircleHeart, Music2, Twitch, Twitter, Youtube } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale } from "@/components/LocaleProvider";
import { site } from "@/lib/site";

const socials = [
	{ name: "Discord", detail: { en: "The community's meeting place", de: "Treffpunkt der Community" }, href: site.discordUrl, icon: null, tone: "discord" },
	{ name: "Twitch", detail: { en: "Streams, chaos, and cozy evenings", de: "Streams, Chaos und Cozy-Abende" }, href: site.twitchUrl, icon: Twitch, tone: "twitch" },
	{ name: "TikTok", detail: { en: "Clips for in between", de: "Clips für zwischendurch" }, href: site.tiktokUrl, icon: Music2, tone: "tiktok" },
	{ name: "Instagram", detail: { en: "Photos and small updates", de: "Fotos und kleine Updates" }, href: site.instagramUrl, icon: Instagram, tone: "instagram" },
	{ name: "X / Twitter", detail: { en: "News and thoughts", de: "Neuigkeiten und Gedanken" }, href: site.xUrl, icon: Twitter, tone: "x" },
	{ name: "YouTube", detail: { en: "Videos and stream moments", de: "Videos und Stream-Momente" }, href: site.youtubeUrl, icon: Youtube, tone: "youtube" },
	{ name: "Ko-Fi", detail: { en: "Support Nachtara directly", de: "Nachtara direkt unterstützen" }, href: site.koFiUrl, icon: Coffee, tone: "kofi" },
];

export default function SocialsPage() {
	const { locale, text } = useLocale();
	return (
		<>
			<PageHero
				kicker={text("Nachtara's socials", "Nachtaras Socials")}
				title={text("Where the community feels at home.", "Wo die Community zuhause ist.")}
				copy={text(
					"From a cozy evening on Discord to the next live moment: find all official N4cht4r4 channels here.",
					"Vom gemütlichen Discord-Abend bis zum nächsten Live-Moment: Hier findest du alle offiziellen Kanäle von N4cht4r4."
				)}
				icon={<MessageCircleHeart />}
				compact
			/>
			<section className="content-band">
				<div className="social-grid">
					{socials.map(({ name, detail, href, icon: Icon, tone }) => (
						<a className={`social-card ${tone}`} href={href} key={name} target="_blank" rel="noreferrer">
							<span className="social-icon">{name === "Discord" ? <DiscordMark size={18} /> : Icon ? <Icon size={24} /> : null}</span>
							<span>
								<strong>{name}</strong>
								<small>{detail[locale]}</small>
							</span>
							<ExternalLink className="social-arrow" size={17} aria-hidden="true" />
						</a>
					))}
				</div>
			</section>
		</>
	);
}
