export type StreamSetupItem = {
	id: string;
	title: { de: string; en: string };
	description: { de: string; en: string };
	href?: string;
	shopOnly?: boolean;
};

export type StreamSetupGroup = {
	id: "hardware" | "widgets" | "design" | "seasonal";
	title: { de: string; en: string };
	description: { de: string; en: string };
	items: StreamSetupItem[];
};

export const streamSetupGroups: StreamSetupGroup[] = [
	{
		id: "hardware",
		title: { de: "Desk & Technik", en: "Desk & technology" },
		description: {
			de: "Die Technik hinter Stream, Games und Nachtaras unverkennbar rosafarbenem Arbeitsplatz.",
			en: "The technology behind the stream, games, and Nachtara's unmistakably pink desk.",
		},
		items: [
			{ id: "graphics-card", title: { de: "Grafikkarte", en: "Graphics card" }, description: { de: "NVIDIA GeForce RTX 4070 Ti", en: "NVIDIA GeForce RTX 4070 Ti" } },
			{
				id: "processor",
				title: { de: "Prozessor", en: "Processor" },
				description: { de: "Intel Core i7-11700KF · 11. Generation", en: "Intel Core i7-11700KF · 11th generation" },
			},
			{
				id: "stream-headset",
				title: { de: "Streaming-Headset", en: "Streaming headset" },
				description: { de: "Razer Kraken · Quartz Pink", en: "Razer Kraken · Quartz Pink" },
			},
			{
				id: "bluetooth-headset",
				title: { de: "Bluetooth-Headset", en: "Bluetooth headset" },
				description: { de: "Razer Kraken Kitty · Quartz Pink", en: "Razer Kraken Kitty · Quartz Pink" },
			},
			{
				id: "headset-holder",
				title: { de: "Headset-Halter", en: "Headset stand" },
				description: { de: "Razer Base Station Chroma · Quartz", en: "Razer Base Station Chroma · Quartz" },
			},
			{ id: "keyboard", title: { de: "Tastatur", en: "Keyboard" }, description: { de: "Razer BlackWidow V3 · Quartz", en: "Razer BlackWidow V3 · Quartz" } },
			{ id: "mouse", title: { de: "Maus", en: "Mouse" }, description: { de: "Razer Viper · Quartz", en: "Razer Viper · Quartz" } },
			{ id: "microphone", title: { de: "Mikrofon", en: "Microphone" }, description: { de: "Razer Seiren Mini · Quartz", en: "Razer Seiren Mini · Quartz" } },
			{ id: "capture-card", title: { de: "Capture Card", en: "Capture card" }, description: { de: "Papeaso 4K Capture Card", en: "Papeaso 4K capture card" } },
			{ id: "stream-deck", title: { de: "Stream Deck", en: "Stream Deck" }, description: { de: "Elgato Stream Deck Neo · Weiß", en: "Elgato Stream Deck Neo · White" } },
		],
	},
	{
		id: "widgets",
		title: { de: "Interaktive Widgets", en: "Interactive widgets" },
		description: {
			de: "Kleine Stream-Helfer für Kanalpunkte, Homeoffice-Tage und besondere Events.",
			en: "Small stream helpers for channel points, home-office days, and special events.",
		},
		items: [
			{
				id: "loyalty-check-in",
				title: { de: "Check-in mit Kanalpunkten", en: "Channel point check-in" },
				description: { de: "Treuekarten-Widget für den Check-in im Stream.", en: "Loyalty-card widget for checking in during the stream." },
				href: "https://www.etsy.com/de/listing/4366991684/treuekarten-widget-twitch-youtube?ref=yr_purchases",
			},
			{
				id: "homeoffice-tasks",
				title: { de: "Homeoffice-Tasklist", en: "Home-office task list" },
				description: { de: "Aufgaben- und Pomodoro-Widget für gemeinsame produktive Streams.", en: "Task and Pomodoro widget for productive streams together." },
				href: "https://www.etsy.com/de/listing/1747571473/aufgabe-widget-o-pomodoro-timer-o?ref=yr_purchases",
			},
			{
				id: "cat-gacha",
				title: { de: "Katzen-Gacha", en: "Cat gacha" },
				description: { de: "Verspieltes Gacha-Widget, das über Kanalpunkte ausgelöst wird.", en: "Playful gacha widget triggered through channel points." },
				href: "https://www.etsy.com/de/listing/4356748364/katzen-gacha-widget-o-channel-point?ref=yr_purchases",
			},
			{
				id: "event-countdown",
				title: { de: "Event-Countdown", en: "Event countdown" },
				description: {
					de: "Kirschblüten-Timer für 24-Stunden-Streams, Subathons und andere Events.",
					en: "Cherry-blossom timer for 24-hour streams, subathons, and other events.",
				},
				href: "https://www.etsy.com/de/listing/1769118952/p2u-countdown-timer-widget-pink-cherry?ref=yr_purchases",
			},
			{
				id: "sakura-goal",
				title: { de: "Kirschblüten-Goal", en: "Cherry-blossom goal" },
				description: { de: "Rosa Goal-Widget für Ziele und besondere Community-Meilensteine.", en: "Pink goal widget for targets and special community milestones." },
				href: "https://www.etsy.com/de/listing/1761871940/p2u-rosa-kirschbluten-blumen-goal-widget?ref=yr_purchases",
			},
		],
	},
	{
		id: "design",
		title: { de: "Stream-Look & Charakter", en: "Stream look & character" },
		description: {
			de: "Die kleinen Details, aus denen Nachtaras Sakura-Streamzimmer entstanden ist.",
			en: "The small details that shaped Nachtara's sakura stream room.",
		},
		items: [
			{
				id: "channel-point-icons",
				title: { de: "Kanalpunkte-Icons", en: "Channel point icons" },
				description: {
					de: "Das verwendete Set ist aktuell nicht mehr gelistet; verlinkt ist der Shop Ariixiu.",
					en: "The set used is no longer listed; the link leads to the Ariixiu shop.",
				},
				href: "https://www.etsy.com/de/shop/Ariixiu?ref=yr_purchases&section_id=47716374",
				shopOnly: true,
			},
			{
				id: "nachtara-pet",
				title: { de: "Nachtara Stream-Pet", en: "Nachtara stream pet" },
				description: {
					de: "Das Stream-Pet ist aktuell nicht mehr gelistet; verlinkt ist der Shop vryhoth.",
					en: "The stream pet is no longer listed; the link leads to the vryhoth shop.",
				},
				href: "https://www.etsy.com/de/shop/vryhoth?ref=yr_purchases",
				shopOnly: true,
			},
			{
				id: "chat-widget",
				title: { de: "Kirschblüten-Chat", en: "Cherry-blossom chat" },
				description: { de: "Anpassbares Chat-Widget im rosa Sakura-Look.", en: "Customisable chat widget in a pink sakura look." },
				href: "https://www.etsy.com/de/listing/1670910233/p2u-anpassbares-chat-widget-kirschblute?ref=yr_purchases",
			},
			{
				id: "bit-badges",
				title: { de: "Rainbow-Sakura Bit-Badges", en: "Rainbow sakura bit badges" },
				description: { de: "Kirschblüten-Badges für die verschiedenen Twitch-Bit-Stufen.", en: "Cherry-blossom badges for the different Twitch Bits tiers." },
				href: "https://www.etsy.com/de/listing/1649498848/30x-rainbow-sakura-twitch-bit-badges?ref=yr_purchases",
			},
			{
				id: "alerts",
				title: { de: "Sakura-Alerts", en: "Sakura alerts" },
				description: { de: "Animierte Kirschblüten-Alerts für StreamElements.", en: "Animated cherry-blossom alerts for StreamElements." },
				href: "https://www.etsy.com/de/listing/1009811104/pink-sakura-cherry-blossom-animierte?ref=yr_purchases",
			},
			{
				id: "pngtuber",
				title: { de: "Katzenmädchen-PNGTuber", en: "Catgirl PNGTuber" },
				description: { de: "Rosa PNGTuber-Modell mit mehreren Ausdrücken für den Stream.", en: "Pink PNGTuber model with several expressions for the stream." },
				href: "https://www.etsy.com/de/listing/1553034581/rosa-katzenmadchen-pngtuber-modell-6?ref=yr_purchases",
			},
			{
				id: "scene-transition",
				title: { de: "Sakura-Szenenübergang", en: "Sakura scene transition" },
				description: { de: "Animierter OBS-Übergang zwischen den Stream-Szenen.", en: "Animated OBS transition between stream scenes." },
				href: "https://www.etsy.com/de/listing/1009783312/pink-sakura-kirschblute-ubergang-o-obs?ref=yr_purchases",
			},
		],
	},
	{
		id: "seasonal",
		title: { de: "Saisonales Archiv", en: "Seasonal archive" },
		description: {
			de: "Besondere Looks, die nur zu bestimmten Jahreszeiten aus der Schublade kommen.",
			en: "Special looks that only come out at certain times of the year.",
		},
		items: [
			{
				id: "frozen-transition",
				title: { de: "Gefrorener Szenenübergang", en: "Frozen scene transition" },
				description: {
					de: "Der winterliche Übergang ist aktuell nicht mehr gelistet; verlinkt ist der Shop DexPixel.",
					en: "The winter transition is no longer listed; the link leads to the DexPixel shop.",
				},
				href: "https://www.etsy.com/de/shop/DexPixel?ref=yr_purchases",
				shopOnly: true,
			},
			{
				id: "halloween-confetti",
				title: { de: "Halloween-Konfetti", en: "Halloween confetti" },
				description: { de: "Animiertes Konfetti-Overlay für Halloween-Streams.", en: "Animated confetti overlay for Halloween streams." },
				href: "https://www.etsy.com/de/listing/1697159338/animierte-halloween-konfetti-stream?ref=yr_purchases",
			},
			{
				id: "ghost-lights",
				title: { de: "Halloween-Geisterlichter", en: "Halloween ghost lights" },
				description: { de: "Leuchtende Geister-Girlande als saisonales Stream-Overlay.", en: "Glowing ghost garland used as a seasonal stream overlay." },
				href: "https://www.etsy.com/de/listing/1781617300/halloween-geist-lichter-overlay?ref=yr_purchases",
			},
		],
	},
];
