import Link from "next/link";
import { CalendarDays, ClipboardList, LayoutList, Swords, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { useLocale } from "@/components/LocaleProvider";

const links = [
	{ key: "overview", en: "Overview", de: "Übersicht", suffix: "", icon: LayoutList },
	{ key: "schedule", en: "Schedule", de: "Spielplan", suffix: "/schedule", icon: CalendarDays },
	{ key: "playoffs", en: "Playoffs", de: "Playoffs", suffix: "/playoffs", icon: Swords },
	{ key: "teams", en: "Teams", de: "Teams", suffix: "/teams", icon: Users },
	{ key: "rules", en: "Rules", de: "Regeln", suffix: "/rules", icon: ClipboardList },
];

export function TournamentHeader({ id, title, kicker, copy, active = "overview" }: { id: string; title: string; kicker: string; copy: string; active?: string }) {
	const { text } = useLocale();
	return (
		<PageHero kicker={kicker} title={title} copy={copy} icon={<Trophy size={44} strokeWidth={1.6} />} className="tournament-page-hero">
			<nav className="tournament-subnav tournament-hero-nav" aria-label={text("Tournament sections", "Turnierbereiche")}>
				{links.map(({ key, en, de, suffix, icon: Icon }) => (
					<Link className={active === key ? "active" : ""} href={`/tournaments/${id}${suffix}`} key={key}>
						<Icon size={15} /> {text(en, de)}
					</Link>
				))}
			</nav>
		</PageHero>
	);
}
