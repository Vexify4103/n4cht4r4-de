export type EngagementEntry = {
	id: string;
	category: "ongoing" | "recurring" | "past";
	period: string;
	periodEn: string;
	title: string;
	titleEn: string;
	organisation: string;
	organisationEn: string;
	description: string;
	descriptionEn: string;
	href?: string;
	linkLabel?: string;
	linkLabelEn?: string;
};

export const engagementEntries: EngagementEntry[] = [
	{
		id: "clean-water",
		category: "ongoing",
		period: "Monatlich seit 2023",
		periodEn: "Monthly since 2023",
		title: "Zugang zu sauberem Trinkwasser",
		titleEn: "Access to clean drinking water",
		organisation: "Save the Children",
		organisationEn: "Save the Children",
		description:
			"Seit drei Jahren unterstützt Nachtara Save the Children monatlich. Die WASH-Programme der Organisation verbessern gemeinsam mit lokalen Partnern die Wasserqualität, sanitäre Versorgung und Hygienepraxis für Kinder und Familien.",
		descriptionEn:
			"For three years, Nachtara has supported Save the Children every month. Together with local partners, the organisation's WASH programmes improve water quality, sanitation, and hygiene practices for children and families.",
		href: "https://resourcecentre.savethechildren.net/topics/water-sanitation-and-hygiene-wash",
		linkLabel: "Mehr über die WASH-Arbeit erfahren",
		linkLabelEn: "Learn about their WASH work",
	},
	{
		id: "raid4aid",
		category: "recurring",
		period: "Seit 2023 · 2026 zum vierten Mal",
		periodEn: "Since 2023 · fourth year in 2026",
		title: "Raid4Aid",
		titleEn: "Raid4Aid",
		organisation: "Gemeinsamer Spendenstream für Tiere in Not",
		organisationEn: "A shared charity stream for animals in need",
		description:
			"Am ersten Advent kommen Streamerinnen, Streamer und ihre Communities auf Twitch zusammen. Die Spenden gehen transparent über Betterplace direkt an ausgewählte Tierschutzorganisationen.",
		descriptionEn:
			"On the first Advent, streamers and their communities come together on Twitch. Donations are transparently sent through Betterplace directly to selected animal welfare organisations.",
		href: "https://www.raid4aid.de/",
		linkLabel: "Raid4Aid kennenlernen",
		linkLabelEn: "Discover Raid4Aid",
	},
	{
		id: "herz-und-pfote-2025",
		category: "past",
		period: "29. November bis 7. Dezember 2025",
		periodEn: "29 November to 7 December 2025",
		title: "Charity mit Herz & Pfote",
		titleEn: "Charity with Heart & Paw",
		organisation: "Harotte · Hamburger Tierschutzverein von 1841 e. V.",
		organisationEn: "Harotte · Hamburg Animal Welfare Association of 1841",
		description: "Eine gemeinsame Charity-Woche mit täglichen Streams, Programmpunkten und Community-Aktionen. Nachtara war als teilnehmende Creatorin dabei.",
		descriptionEn: "A shared charity week with daily streams, activities, and community events. Nachtara took part as one of the creators.",
		href: "https://www.betterplace.org/de/fundraising-events/55263-charity-mit-herz-pfote-spendenaktion-von-harotte",
		linkLabel: "Vergangene Aktion ansehen",
		linkLabelEn: "View the past campaign",
	},
];

export const currentEngagement = engagementEntries.find((entry) => entry.id === "raid4aid")!;
