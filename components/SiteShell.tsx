"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	BookOpenText,
	Copyright,
	Film,
	Flower2,
	Gamepad2,
	HeartHandshake,
	Home,
	Info,
	MessageCircleHeart,
	Menu,
	Sparkles,
	Target,
	Trophy,
	Twitch,
	UsersRound,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SakuraAtmosphere } from "@/components/SakuraAtmosphere";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { DiscordMark } from "@/components/DiscordMark";
import { site } from "@/lib/site";

const navItems = [
	{ href: "/", en: "Home", de: "Start", icon: Home },
	{ href: "/info", en: "Nachtara", de: "Nachtara", icon: Info },
	{ href: "/tournaments", en: "Tournaments", de: "Turniere", icon: Trophy },
	{ href: "/challenges", en: "Challenges", de: "Challenges", icon: Target },
	{ href: "/projects", en: "Projects", de: "Projekte", icon: Gamepad2 },
	{ href: "/community", en: "Community", de: "Pinnwand", icon: MessageCircleHeart },
	{ href: "/clips", en: "Clips", de: "Clips", icon: Film },
	{ href: "/socials", en: "Socials", de: "Socials", icon: UsersRound },
];

export function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
	const pathname = usePathname();
	const { text } = useLocale();
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => setMenuOpen(false), [pathname]);

	return (
		<body>
			<div className="site-backdrop" aria-hidden="true" />
			<SakuraAtmosphere />
			<header className="site-header">
				<div className="header-inner">
					<Link className="brand-mark" href="/" aria-label={text("N4cht4r4 home page", "N4cht4r4 Startseite")}>
						<span className="brand-sigil">
							<Flower2 size={21} />
						</span>
						<span className="brand-copy">
							<strong>N4cht4r4</strong>
							<small>Community Garden</small>
						</span>
					</Link>

					<nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label={text("Main navigation", "Hauptnavigation")}>
						<div className="mobile-nav-head">
							<span>{text("Where would you like to go?", "Wohin möchtest du?")}</span>
							<button type="button" onClick={() => setMenuOpen(false)} aria-label={text("Close navigation", "Navigation schließen")}>
								<X size={20} />
							</button>
						</div>
						{navItems.map((item) => {
							const Icon = item.icon;
							const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
							return (
								<Link href={item.href} key={item.href} className={`nav-link ${active ? "is-active" : ""}`}>
									<Icon size={16} />
									<span>{text(item.en, item.de)}</span>
								</Link>
							);
						})}
					</nav>

					<div className="header-actions">
						<LanguageToggle />
						<ThemeToggle />
						<UserMenu />
						<button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={text("Open navigation", "Navigation öffnen")}>
							<Menu size={21} />
						</button>
					</div>
				</div>
			</header>

			<main>{children}</main>

			<footer className="site-footer">
				<div className="footer-main">
					<div className="footer-brand">
						<span className="brand-sigil">
							<Flower2 size={20} />
						</span>
						<div>
							<strong>N4cht4r4</strong>
							<p>{text("Streams, events, and a cozy place for the community.", "Streams, Events und ein gemütlicher Platz für die Community.")}</p>
						</div>
					</div>
					<div className="footer-links">
						<span>{text("Explore", "Entdecken")}</span>
						<Link href="/tournaments">
							<Trophy size={14} /> {text("Tournaments", "Turniere")}
						</Link>
						<Link href="/challenges">
							<Target size={14} /> Challenges
						</Link>
						<Link href="/bewerbungen">
							<BookOpenText size={14} /> {text("Applications", "Bewerbungen")}
						</Link>
						<Link href="/projects">
							<Gamepad2 size={14} /> {text("Community projects", "Community-Projekte")}
						</Link>
					</div>
					<div className="footer-links">
						<span>Community</span>
						<a href={site.discordUrl} target="_blank" rel="noopener noreferrer">
							<span className="discord-footer-mark">
								<DiscordMark size={10} variant="white" />
							</span>{" "}
							Discord
						</a>
						<a href={site.twitchUrl} target="_blank" rel="noopener noreferrer">
							<Twitch size={14} /> Twitch
						</a>
						<Link href="/socials">
							<Sparkles size={14} /> {text("All socials", "Alle Socials")}
						</Link>
						<Link href="/community">
							<MessageCircleHeart size={14} /> {text("Community wall & fan art", "Pinnwand & Fanart")}
						</Link>
						<Link href="/engagement">
							<HeartHandshake size={14} /> {text("Causes & charity", "Engagement & Charity")}
						</Link>
					</div>
				</div>
				<div className="footer-bottom">
					<span>
						<Copyright size={13} /> 2026 N4cht4r4
					</span>
					<span className="footer-credit">
						{text("Website by", "Website von")} {site.creator.name}
						<a
							href={site.creator.discordUrl}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={text(`${site.creator.name} on Discord`, `${site.creator.name} auf Discord`)}
						>
							<span className="discord-footer-mark">
								<DiscordMark size={9} variant="white" />
							</span>{" "}
							Discord
						</a>
						{site.creator.twitchUrl && (
							<a
								href={site.creator.twitchUrl}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={text(`${site.creator.name} on Twitch`, `${site.creator.name} auf Twitch`)}
							>
								<Twitch size={13} /> Twitch
							</a>
						)}
					</span>
					<div>
						<Link href="/datenschutz">{text("Privacy", "Datenschutz")}</Link>
						<Link href="/agb">{text("Terms of use", "Nutzungsbedingungen")}</Link>
					</div>
				</div>
			</footer>
		</body>
	);
}
