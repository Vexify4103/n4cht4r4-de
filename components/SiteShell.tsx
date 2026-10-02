"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Film, Flower2, Gamepad2, Home, Info, MessageCircleHeart, Menu, Target, Trophy, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SakuraAtmosphere } from "@/components/SakuraAtmosphere";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
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

			{!pathname.startsWith("/admin") && (
				<footer className="site-footer">
					<div className="footer-main">
						<div className="footer-intro">
							<span className="footer-mark">
								<Image src="/favicon.svg" alt="" width={52} height={52} />
							</span>
							<h2>
								{text("Soft at heart.", "Sanft im Herzen.")}
								<br />
								{text("Loud on stream.", "Laut im Stream.")}
							</h2>
						</div>
						<div className="footer-links">
							<strong>{text("Explore", "Entdecken")}</strong>
							<Link href="/tournaments">{text("Tournaments", "Turniere")}</Link>
							<Link href="/challenges">Challenges</Link>
							<Link href="/projects">{text("Community projects", "Community-Projekte")}</Link>
							<Link href="/community">{text("Community wall & fan art", "Pinnwand & Fanart")}</Link>
							<Link href="/engagement">{text("Causes & charity", "Engagement & Charity")}</Link>
						</div>
						<div className="footer-links">
							<strong>{text("More & legal", "Mehr & Rechtliches")}</strong>
							<Link href="/info">{text("About N4cht4r4", "Über N4cht4r4")}</Link>
							<Link href="/clips">Clips</Link>
							<Link href="/socials">Socials</Link>
							<Link href="/bewerbungen">{text("Team applications", "Team-Bewerbungen")}</Link>
							<Link href="/bewerbungen/appeal">{text("Ban appeal", "Entbannungsantrag")}</Link>
							<Link href="/datenschutz">{text("Privacy", "Datenschutz")}</Link>
							<Link href="/agb">{text("Terms of use", "Nutzungsbedingungen")}</Link>
						</div>
					</div>
					<div className="footer-bottom">
						<div className="footer-bottom-meta">
							<span>© 2026 N4cht4r4</span>
							<span className="footer-bottom-separator" aria-hidden="true">
								·
							</span>
							<a
								className="footer-signature"
								href={site.creator.twitchUrl || site.creator.discordUrl}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={text(`Website by ${site.creator.name} — visit on Twitch`, `Website von ${site.creator.name} — auf Twitch besuchen`)}
							>
								{text("Website by", "Website von")} {site.creator.name} <span aria-hidden="true">↗</span>
							</a>
						</div>
						<span>{text("For cozy streams and blooming communities.", "Für gemütliche Streams und eine Community, die gemeinsam aufblüht.")}</span>
					</div>
				</footer>
			)}
		</body>
	);
}
