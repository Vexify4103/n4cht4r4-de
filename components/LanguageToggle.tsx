"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export function LanguageToggle() {
	const { locale, setLocale } = useLocale();
	const next = locale === "de" ? "en" : "de";

	return (
		<button
			className="language-toggle"
			type="button"
			onClick={() => setLocale(next)}
			aria-label={next === "en" ? "Webseitensprache auf Englisch wechseln" : "Switch website language to German"}
			title={next === "en" ? "English" : "Deutsch"}
		>
			<Languages size={16} aria-hidden="true" />
			<span>{locale.toUpperCase()}</span>
		</button>
	);
}
