"use client";

import { useLocale } from "@/components/LocaleProvider";

const sections = {
	de: [
		{
			title: "1. Geltungsbereich",
			copy: "Diese Nutzungsbedingungen gelten für die Nutzung der Website n4cht4r4.de (nachfolgend „Website“). Durch die Nutzung der Website akzeptierst du diese Bedingungen.",
		},
		{
			title: "2. Nutzung der Website",
			items: [
				"Die Website dient der Informationsvermittlung und Community-Interaktion.",
				"Die Nutzung ist kostenlos, sofern nicht anders angegeben.",
				"Du bist für die Sicherheit deiner Zugangsdaten verantwortlich.",
			],
		},
		{
			title: "3. Registrierung und Konto",
			items: [
				"Für bestimmte Funktionen ist eine Registrierung über Discord oder Twitch erforderlich.",
				"Du bist verpflichtet, deine Zugangsdaten vertraulich zu behandeln.",
				"Missbrauch deines Kontos kann zur Sperrung führen.",
			],
		},
		{
			title: "4. Community-Regeln",
			items: [
				"Sei respektvoll und freundlich zu anderen Nutzern.",
				"Kein Spam, keine Beleidigungen und keine rechtswidrigen Inhalte.",
				"Das Team behält sich vor, Nutzer ohne Vorwarnung zu sperren.",
			],
		},
		{
			title: "5. Turniere und Challenges",
			items: [
				"Die Teilnahme an League-Turnieren erfordert eine verifizierte Riot-ID.",
				"Die Turnierleitung entscheidet nach dem jeweils veröffentlichten Regelwerk über Ablauf und Ergebnisse.",
				"Preise und Belohnungen sind nur verbindlich, wenn sie ausdrücklich zugesagt wurden.",
			],
		},
		{
			title: "6. Haftung",
			copy: "Die Betreiber haften nicht für Schäden, die durch die Nutzung der Website entstehen, es sei denn, es handelt sich um Vorsatz oder grobe Fahrlässigkeit.",
		},
		{
			title: "7. Änderungen",
			copy: "Das Team behält sich vor, diese Bedingungen jederzeit zu ändern. Über wesentliche Änderungen wird die Community informiert.",
		},
		{
			title: "8. Salvatorische Klausel",
			copy: "Sollte eine Bestimmung dieser Bedingungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
		},
	],
	en: [
		{
			title: "1. Scope",
			copy: 'These Terms of Use apply to n4cht4r4.de (the "Website"). By using the Website, you accept these terms.',
		},
		{
			title: "2. Use of the Website",
			items: [
				"The Website provides information and community interaction.",
				"Use is free unless stated otherwise.",
				"You are responsible for keeping your account credentials secure.",
			],
		},
		{
			title: "3. Registration and accounts",
			items: [
				"Some features require registration through Discord or Twitch.",
				"You must keep your account credentials confidential.",
				"Misuse of your account may lead to suspension.",
			],
		},
		{
			title: "4. Community rules",
			items: ["Be respectful and kind to other users.", "Spam, insults, and unlawful content are not permitted.", "The team may suspend users without prior notice."],
		},
		{
			title: "5. Tournaments and challenges",
			items: [
				"League tournament participation requires a verified Riot ID.",
				"Tournament staff decide on proceedings and results according to the rules published for each event.",
				"Prizes and rewards are binding only when explicitly promised.",
			],
		},
		{
			title: "6. Liability",
			copy: "The operators are not liable for damage arising from use of the Website except in cases of intent or gross negligence.",
		},
		{
			title: "7. Changes",
			copy: "The team may amend these terms at any time. The community will be informed of material changes.",
		},
		{
			title: "8. Severability",
			copy: "If any provision of these terms is invalid, the remaining provisions remain effective.",
		},
	],
} as const;

export default function AgbPage() {
	const { locale, text } = useLocale();
	return (
		<div className="legal-page">
			<h1>🌸 {text("Terms of Use", "Nutzungsbedingungen (AGB)")}</h1>
			{sections[locale].map((section) => (
				<section key={section.title}>
					<h2>{section.title}</h2>
					{"copy" in section && <p>{section.copy}</p>}
					{"items" in section && (
						<ul>
							{section.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</section>
			))}
		</div>
	);
}
