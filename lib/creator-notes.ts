export type CreatorNoteChapter = {
	id: "balance" | "boundaries" | "growth";
	eyebrow: { de: string; en: string };
	title: { de: string; en: string };
	intro: { de: string; en: string };
	quote: { de: string; en: string };
	points: Array<{
		title: { de: string; en: string };
		text: { de: string; en: string };
	}>;
};

export const creatorNoteChapters: CreatorNoteChapter[] = [
	{
		id: "balance",
		eyebrow: { de: "Mental Health & Streaming", en: "Mental health & streaming" },
		title: { de: "Mit Freude live, ohne Zahlendruck", en: "Going live with joy, without pressure from numbers" },
		intro: {
			de: "Gedanken, die mir helfen sollen, Zuschauerzahlen einzuordnen, Fehler nicht zu überbewerten und meine Energie ernst zu nehmen.",
			en: "Thoughts that help me put viewer numbers into perspective, avoid overthinking mistakes, and take my energy seriously.",
		},
		quote: { de: "Ich sehe keine Zahl. Ich sehe Menschen.", en: "I do not see a number. I see people." },
		points: [
			{
				title: { de: "Ohne Beweisdruck starten", en: "Start without needing to prove anything" },
				text: {
					de: "Vor einem Stream setze ich mir lieber ein inhaltliches Ziel als eine gewünschte Viewer- oder Follow-Zahl. Der Grund fürs Livegehen bleibt die Freude am Stream und an meiner Community.",
					en: "Before a stream, I prefer setting a content goal instead of a viewer or follower target. The reason for going live remains enjoying the stream and my community.",
				},
			},
			{
				title: { de: "Live-Zahlen dürfen ausbleiben", en: "Live numbers can stay hidden" },
				text: {
					de: "Während des Streams muss ich keine Statistiken kontrollieren oder mich mit anderen vergleichen. Zwei Menschen, die freiwillig Zeit mit mir verbringen, sind keine kleine Zahl.",
					en: "I do not need to monitor statistics or compare myself with others while live. Two people choosing to spend their time with me are not a small number.",
				},
			},
			{
				title: { de: "Mit Abstand auswerten", en: "Review with some distance" },
				text: {
					de: "Analytics sind hilfreicher als Entwicklung über mehrere Wochen. Nach einem Stream reichen ein schöner Moment und höchstens ein oder zwei Dinge, die ich beim nächsten Mal ausprobieren möchte.",
					en: "Analytics are more useful as a trend across several weeks. After a stream, one good moment and at most one or two things to try next time are enough.",
				},
			},
			{
				title: { de: "Fehler sind kein Urteil", en: "Mistakes are not a verdict" },
				text: {
					de: "Ein verlorenes Game, ein Versprecher oder ein ruhiger Moment machen keinen schlechten Stream. Oft entstehen gerade daraus ehrliche, lustige Erinnerungen.",
					en: "A lost game, a slip of the tongue, or a quiet moment does not make a bad stream. Those moments often create honest, funny memories.",
				},
			},
			{
				title: { de: "Offline sein gehört dazu", en: "Being offline is part of it" },
				text: {
					de: "Pausen, Urlaub, Freunde und schlechte Tage sind kein Rückschritt. Ich möchte langfristig Creatorin sein, ohne meinen eigenen Wert von Twitch-Statistiken abhängig zu machen.",
					en: "Breaks, holidays, friends, and difficult days are not setbacks. I want to be a creator for the long term without tying my self-worth to Twitch statistics.",
				},
			},
		],
	},
	{
		id: "boundaries",
		eyebrow: { de: "Privatsphäre & Verantwortung", en: "Privacy & responsibility" },
		title: { de: "Öffentlich sein, ohne alles öffentlich zu machen", en: "Being public without making everything public" },
		intro: {
			de: "Klare Grenzen schützen mich, andere Creator und die Atmosphäre, für die meine Community stehen soll.",
			en: "Clear boundaries protect me, other creators, and the atmosphere I want my community to represent.",
		},
		quote: { de: "Ich darf freundlich und offen sein und trotzdem Dinge für mich behalten.", en: "I can be kind and open while still keeping things to myself." },
		points: [
			{
				title: { de: "Privat bleibt eine bewusste Entscheidung", en: "Privacy stays a conscious choice" },
				text: {
					de: "Adresse, Arbeit, Familie, Termine und private Accounts gehören nicht automatisch ins Netz. Eine eigene Creator-Mail und ein kurzer Bildschirmcheck verhindern viele versehentliche Einblicke.",
					en: "My address, job, family, appointments, and private accounts do not automatically belong online. A separate creator email and a quick screen check prevent many accidental disclosures.",
				},
			},
			{
				title: { de: "Grenzen brauchen keine Rechtfertigung", en: "Boundaries need no justification" },
				text: {
					de: "Ich muss nicht privat antworten, immer erreichbar sein oder über jedes Thema sprechen. Ein freundliches „Das möchte ich privat halten“ ist eine vollständige Antwort.",
					en: "I do not have to reply privately, be available at all times, or discuss every topic. A kind 'I would like to keep that private' is a complete answer.",
				},
			},
			{
				title: { de: "Kritik bleibt bei der Sache", en: "Keep criticism focused on the issue" },
				text: {
					de: "Ich darf mich über ein Spiel oder einen Play ärgern, ohne einen Menschen anzugreifen. Private Chats, Gerüchte und Posts aus dem Affekt gehören für mich nicht in einen fairen Creator-Alltag.",
					en: "I can be frustrated with a game or a play without attacking a person. Private chats, rumours, and angry impulse posts have no place in a fair creator routine.",
				},
			},
			{
				title: { de: "Die Community ist keine Armee", en: "The community is not an army" },
				text: {
					de: "Mein Chat soll niemanden belästigen oder Streit für mich austragen. Wenn ich ein Problem mit jemandem habe, wird daraus kein Auftrag an meine Zuschauer.",
					en: "My chat should never harass someone or fight my disputes for me. If I have an issue with someone, it does not become an assignment for my viewers.",
				},
			},
			{
				title: { de: "Vertrauen vor schneller Gelegenheit", en: "Trust before a quick opportunity" },
				text: {
					de: "Kooperationen müssen zu mir passen und transparent sein. Ich möchte lieber eine Anfrage ablehnen, als das Vertrauen meiner Community für ein Produkt aufs Spiel zu setzen, hinter dem ich nicht stehe.",
					en: "Partnerships need to fit me and be transparent. I would rather decline an offer than risk my community's trust for a product I cannot stand behind.",
				},
			},
		],
	},
	{
		id: "growth",
		eyebrow: { de: "Für neue Creator", en: "For new creators" },
		title: { de: "Den eigenen Weg wachsen lassen", en: "Letting your own path grow" },
		intro: {
			de: "Was ich neuen Creatorn gerne mitgeben würde: anfangen, ausprobieren und eine Community nicht mit einer Statistik verwechseln.",
			en: "What I would like to share with new creators: start, experiment, and never mistake a community for a statistic.",
		},
		quote: { de: "Du musst nicht perfekt anfangen. Du darfst deinen Weg beim Gehen finden.", en: "You do not have to start perfectly. You can find your way as you go." },
		points: [
			{
				title: { de: "Anfangen schlägt Perfektion", en: "Starting beats perfection" },
				text: {
					de: "Das perfekte Overlay, dutzende Emotes und die beste Technik müssen nicht vor dem ersten Stream fertig sein. Das Wichtigste lernt man oft erst, wenn man wirklich live geht.",
					en: "The perfect overlay, dozens of emotes, and the best equipment do not need to be ready before the first stream. The most important lessons often begin once you actually go live.",
				},
			},
			{
				title: { de: "Menschen vor Reichweite", en: "People before reach" },
				text: {
					de: "Ich möchte lieber die Menschen wertschätzen, die schon da sind, als nur dem nächsten Follow hinterherzulaufen. Willkommen sein, gemeinsam lachen und wiederkommen: Daraus wächst Community.",
					en: "I would rather value the people already there than constantly chase the next follow. Feeling welcome, laughing together, and returning are how a community grows.",
				},
			},
			{
				title: { de: "Die eigene Art ist der Content", en: "Your own personality is the content" },
				text: {
					de: "Nicht jeder Creator muss laut, chaotisch oder kompetitiv sein. Spiele geben den Rahmen; Gedanken, Geschichten, Reaktionen und Persönlichkeit sorgen dafür, dass Menschen wegen mir wiederkommen.",
					en: "Not every creator needs to be loud, chaotic, or competitive. Games provide the setting; thoughts, stories, reactions, and personality give people a reason to return for me.",
				},
			},
			{
				title: { de: "Weniger Plattformen, sinnvoller Content", en: "Fewer platforms, more purposeful content" },
				text: {
					de: "Ich muss nicht sieben Plattformen täglich bedienen. Ein guter Stream-Moment kann als Clip, Short oder Reel weiterleben, ohne dass ich für jedes Netzwerk mein Leben neu produzieren muss.",
					en: "I do not need to feed seven platforms every day. A good stream moment can live on as a clip, Short, or Reel without reproducing my life separately for every network.",
				},
			},
			{
				title: { de: "Erinnerungen sind auch Wachstum", en: "Memories are growth too" },
				text: {
					de: "Community-Abende, Turniere und gemeinsame Challenges bleiben länger als eine einzelne Viewerzahl. Wachstum heißt für mich auch: sicherer werden, dazulernen und zusammen Geschichten sammeln.",
					en: "Community evenings, tournaments, and shared challenges last longer than a single viewer count. Growth also means gaining confidence, learning, and collecting stories together.",
				},
			},
		],
	},
];
