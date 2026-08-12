"use client";

import { useLocale } from "@/components/LocaleProvider";

const sections = {
	de: [
		{ title: "1. Verantwortlicher", copy: "Verantwortlicher für die Datenverarbeitung auf dieser Website ist Nachtara." },
		{
			title: "2. Erhobene Daten",
			intro: "Bei der Nutzung dieser Website können folgende Daten erhoben werden:",
			items: [
				"Discord-Profilinformationen (Name, Avatar, E-Mail) über die OAuth-Anmeldung",
				"Twitch-Profilinformationen (Name, Avatar, E-Mail) über die OAuth-Anmeldung",
				"Riot-Games-Kontodaten (Riot-ID und PUUID) nach der Verifizierung",
				"Server-Log-Dateien (IP-Adresse, Browsertyp und Zugriffszeit)",
			],
		},
		{
			title: "3. Zweck der Datenverarbeitung",
			items: [
				"Bereitstellung der Website-Funktionen wie Login, Profile und Challenges",
				"Teilnahme an Turnieren und Challenges",
				"Bearbeitung von Bewerbungen und Community-Beiträgen",
				"Sicherheit und Missbrauchsprävention",
			],
		},
		{
			title: "4. Rechtsgrundlage",
			copy: "Die Datenverarbeitung erfolgt auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und, soweit erforderlich, zur Erfüllung vertraglicher Pflichten (Art. 6 Abs. 1 lit. b DSGVO).",
		},
		{
			title: "5. Speicherdauer",
			copy: "Deine Daten werden nur so lange gespeichert, wie es für den jeweiligen Verarbeitungszweck erforderlich ist. Du kannst jederzeit die Löschung deines Kontos anfordern.",
		},
		{
			title: "6. Deine Rechte",
			items: [
				"Auskunft über deine gespeicherten Daten",
				"Berichtigung unrichtiger Daten",
				"Löschung deiner Daten",
				"Widerspruch gegen die Datenverarbeitung",
				"Datenübertragbarkeit in einem maschinenlesbaren Format",
			],
		},
		{
			title: "7. Cookies",
			copy: "Diese Website verwendet ausschließlich technisch notwendige Cookies für die Authentifizierung. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.",
		},
		{ title: "8. Kontakt", copy: "Bei Fragen zum Datenschutz kontaktiere uns bitte über Discord." },
	],
	en: [
		{ title: "1. Controller", copy: "Nachtara is responsible for data processing on this Website." },
		{
			title: "2. Data collected",
			intro: "The following data may be collected when you use this Website:",
			items: [
				"Discord profile information (name, avatar, and email) through OAuth sign-in",
				"Twitch profile information (name, avatar, and email) through OAuth sign-in",
				"Riot Games account data (Riot ID and PUUID) after verification",
				"Server log files (IP address, browser type, and access time)",
			],
		},
		{
			title: "3. Purpose of processing",
			items: [
				"Providing Website features such as sign-in, profiles, and challenges",
				"Participation in tournaments and challenges",
				"Processing applications and community posts",
				"Security and prevention of misuse",
			],
		},
		{
			title: "4. Legal basis",
			copy: "Processing is based on your consent (Article 6(1)(a) GDPR) and, where necessary, performance of contractual obligations (Article 6(1)(b) GDPR).",
		},
		{
			title: "5. Retention",
			copy: "Your data is stored only for as long as required for its purpose. You may request deletion of your account at any time.",
		},
		{
			title: "6. Your rights",
			items: [
				"Access to your stored data",
				"Rectification of inaccurate data",
				"Deletion of your data",
				"Objection to data processing",
				"Data portability in a machine-readable format",
			],
		},
		{ title: "7. Cookies", copy: "This Website only uses technically necessary authentication cookies. No advertising or tracking cookies are used." },
		{ title: "8. Contact", copy: "Please contact us through Discord with privacy questions." },
	],
} as const;

export default function DatenschutzPage() {
	const { locale, text } = useLocale();
	return (
		<div className="legal-page">
			<h1>🌸 {text("Privacy Policy", "Datenschutzrichtlinie")}</h1>
			{sections[locale].map((section) => (
				<section key={section.title}>
					<h2>{section.title}</h2>
					{"intro" in section && <p>{section.intro}</p>}
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
