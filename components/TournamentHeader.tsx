import Link from "next/link";
import { CalendarDays, ClipboardList, LayoutList, Swords, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/PageHero";

const links = [
	{ key: "overview", label: "Übersicht", suffix: "", icon: LayoutList },
	{ key: "schedule", label: "Spielplan", suffix: "/schedule", icon: CalendarDays },
	{ key: "playoffs", label: "Playoffs", suffix: "/playoffs", icon: Swords },
	{ key: "teams", label: "Teams", suffix: "/teams", icon: Users },
	{ key: "rules", label: "Regeln", suffix: "/rules", icon: ClipboardList },
];

export function TournamentHeader({
	id,
	title,
	kicker,
	copy,
	active = "overview",
}: {
	id: string;
	title: string;
	kicker: string;
	copy: string;
	active?: string;
}) {
	return (
		<PageHero kicker={kicker} title={title} copy={copy} icon={<Trophy size={44} strokeWidth={1.6} />} className="tournament-page-hero">
			<nav className="tournament-subnav tournament-hero-nav" aria-label="Turnierbereiche">
				{links.map(({ key, label, suffix, icon: Icon }) => (
					<Link className={active === key ? "active" : ""} href={`/tournaments/${id}${suffix}`} key={key}>
						<Icon size={15} /> {label}
					</Link>
				))}
			</nav>
		</PageHero>
	);
}
