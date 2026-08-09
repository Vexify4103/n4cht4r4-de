"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Copyright, Film, Flower2, Gamepad2, Home, Info, MessageCircleHeart, Menu, Sparkles, Target, Trophy, Twitch, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SakuraAtmosphere } from "@/components/SakuraAtmosphere";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DiscordMark } from "@/components/DiscordMark";
import { site } from "@/lib/site";

const navItems = [
	{ href: "/", label: "Start", icon: Home },
	{ href: "/info", label: "Nachtara", icon: Info },
	{ href: "/tournaments", label: "Turniere", icon: Trophy },
	{ href: "/challenges", label: "Challenges", icon: Target },
	{ href: "/projects", label: "Projekte", icon: Gamepad2 },
	{ href: "/community", label: "Pinnwand", icon: MessageCircleHeart },
	{ href: "/clips", label: "Clips", icon: Film },
	{ href: "/socials", label: "Socials", icon: UsersRound },
];

export function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
	const pathname = usePathname();
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => setMenuOpen(false), [pathname]);

	return (
		<body>
			<div className="site-backdrop" aria-hidden="true" />
			<SakuraAtmosphere />
			<header className="site-header">
				<div className="header-inner">
					<Link className="brand-mark" href="/" aria-label="N4cht4r4 Startseite">
						<span className="brand-sigil">
							<Flower2 size={21} />
						</span>
						<span className="brand-copy">
							<strong>N4cht4r4</strong>
							<small>Community Garden</small>
						</span>
					</Link>

					<nav className={`site-nav ${menuOpen ? "is-open" : ""}`} aria-label="Hauptnavigation">
						<div className="mobile-nav-head">
							<span>Wohin möchtest du?</span>
							<button type="button" onClick={() => setMenuOpen(false)} aria-label="Navigation schließen">
								<X size={20} />
							</button>
						</div>
						{navItems.map((item) => {
							const Icon = item.icon;
							const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
							return (
								<Link href={item.href} key={item.href} className={`nav-link ${active ? "is-active" : ""}`}>
									<Icon size={16} />
									<span>{item.label}</span>
								</Link>
							);
						})}
					</nav>

					<div className="header-actions">
						<ThemeToggle />
						<UserMenu />
						<button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Navigation öffnen">
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
							<p>Streams, Events und ein gemütlicher Platz für die Community.</p>
						</div>
					</div>
					<div className="footer-links">
						<span>Entdecken</span>
						<Link href="/tournaments">
							<Trophy size={14} /> Turniere
						</Link>
						<Link href="/challenges">
							<Target size={14} /> Challenges
						</Link>
						<Link href="/bewerbungen">
							<BookOpenText size={14} /> Bewerbungen
						</Link>
						<Link href="/projects">
							<Gamepad2 size={14} /> Community-Projekte
						</Link>
					</div>
					<div className="footer-links">
						<span>Community</span>
						<a href={site.discordUrl} target="_blank" rel="noopener noreferrer">
							<span className="discord-footer-mark">
								<DiscordMark size={10} />
							</span>{" "}
							Discord
						</a>
						<a href={site.twitchUrl} target="_blank" rel="noopener noreferrer">
							<Twitch size={14} /> Twitch
						</a>
						<Link href="/socials">
							<Sparkles size={14} /> Alle Socials
						</Link>
						<Link href="/community">
							<MessageCircleHeart size={14} /> Pinnwand & Fanart
						</Link>
					</div>
				</div>
				<div className="footer-bottom">
					<span>
						<Copyright size={13} /> 2026 N4cht4r4
					</span>
					<span className="footer-credit">
						Website von {site.creator.name}
						<a href={site.creator.discordUrl} target="_blank" rel="noopener noreferrer" aria-label={`${site.creator.name} auf Discord`}>
							<span className="discord-footer-mark">
								<DiscordMark size={9} />
							</span>{" "}
							Discord
						</a>
						{site.creator.twitchUrl && (
							<a href={site.creator.twitchUrl} target="_blank" rel="noopener noreferrer" aria-label={`${site.creator.name} auf Twitch`}>
								<Twitch size={13} /> Twitch
							</a>
						)}
					</span>
					<div>
						<Link href="/datenschutz">Datenschutz</Link>
						<Link href="/agb">Nutzungsbedingungen</Link>
					</div>
				</div>
			</footer>
		</body>
	);
}
