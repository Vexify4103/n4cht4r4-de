import {
	Coffee,
	ExternalLink,
	Instagram,
	MessageCircleHeart,
	Music2,
	Twitch,
	Twitter,
	Youtube,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import { site } from "@/lib/site";

const socials = [
	{ name: "Discord", detail: "Treffpunkt der Community", href: site.discordUrl, icon: null, tone: "discord" },
	{ name: "Twitch", detail: "Streams, Chaos und Cozy-Abende", href: site.twitchUrl, icon: Twitch, tone: "twitch" },
	{ name: "TikTok", detail: "Clips für zwischendurch", href: site.tiktokUrl, icon: Music2, tone: "tiktok" },
	{ name: "Instagram", detail: "Fotos und kleine Updates", href: site.instagramUrl, icon: Instagram, tone: "instagram" },
	{ name: "X / Twitter", detail: "Neuigkeiten und Gedanken", href: site.xUrl, icon: Twitter, tone: "x" },
	{ name: "YouTube", detail: "Videos und Stream-Momente", href: site.youtubeUrl, icon: Youtube, tone: "youtube" },
	{ name: "Ko-Fi", detail: "Nachtara direkt unterstützen", href: site.koFiUrl, icon: Coffee, tone: "kofi" },
];

export default function SocialsPage() {
	return (
		<>
			<PageHero
				kicker="Nachtaras Socials"
				title="Wo die Community zuhause ist."
				copy="Vom gemütlichen Discord-Abend bis zum nächsten Live-Moment: Hier findest du alle offiziellen Kanäle von N4cht4r4."
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
								<small>{detail}</small>
							</span>
							<ExternalLink className="social-arrow" size={17} aria-hidden="true" />
						</a>
					))}
				</div>
			</section>
		</>
	);
}
