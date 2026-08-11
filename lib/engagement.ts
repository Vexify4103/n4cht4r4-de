export type EngagementEntry = {
	id: string;
	category: "ongoing" | "recurring" | "past";
	period: string;
	title: string;
	organisation: string;
	description: string;
	href?: string;
	linkLabel?: string;
};

export const engagementEntries: EngagementEntry[] = [
	{
		id: "clean-water",
		category: "ongoing",
		period: "Monatlich seit 2023",
		title: "Zugang zu sauberem Trinkwasser",
		organisation: "Save the Children",
		description:
			"Seit drei Jahren unterstützt Nachtara Save the Children monatlich. Die WASH-Programme der Organisation verbessern gemeinsam mit lokalen Partnern die Wasserqualität, sanitäre Versorgung und Hygienepraxis für Kinder und Familien.",
		href: "https://resourcecentre.savethechildren.net/topics/water-sanitation-and-hygiene-wash",
		linkLabel: "Mehr über die WASH-Arbeit erfahren",
	},
	{
		id: "raid4aid",
		category: "recurring",
		period: "Seit 2023 · 2026 zum vierten Mal",
		title: "Raid4Aid",
		organisation: "Gemeinsamer Spendenstream für Tiere in Not",
		description:
			"Am ersten Advent kommen Streamerinnen, Streamer und ihre Communities auf Twitch zusammen. Die Spenden gehen transparent über Betterplace direkt an ausgewählte Tierschutzorganisationen.",
		href: "https://www.raid4aid.de/",
		linkLabel: "Raid4Aid kennenlernen",
	},
	{
		id: "herz-und-pfote-2025",
		category: "past",
		period: "29. November bis 7. Dezember 2025",
		title: "Charity mit Herz & Pfote",
		organisation: "Harotte · Hamburger Tierschutzverein von 1841 e. V.",
		description: "Eine gemeinsame Charity-Woche mit täglichen Streams, Programmpunkten und Community-Aktionen. Nachtara war als teilnehmende Creatorin dabei.",
		href: "https://www.betterplace.org/de/fundraising-events/55263-charity-mit-herz-pfote-spendenaktion-von-harotte",
		linkLabel: "Vergangene Aktion ansehen",
	},
];

export const currentEngagement = engagementEntries.find((entry) => entry.id === "raid4aid")!;
