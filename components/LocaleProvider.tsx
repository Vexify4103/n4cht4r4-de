"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

export type Locale = "de" | "en";

type LocaleContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	text: (en: string, de: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "nachtara-locale";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
	const { data: session, status } = useSession();
	const [locale, setLocaleState] = useState<Locale>("de");
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		if (initialized || status === "loading") return;
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (saved === "de" || saved === "en") {
			setLocaleState(saved);
			setInitialized(true);
			return;
		}

		if (!session?.user?.id) {
			setInitialized(true);
			return;
		}

		let active = true;
		fetch("/api/user/preferences", { cache: "no-store" })
			.then((response) => (response.ok ? response.json() : null))
			.then((result) => {
				if (!active) return;
				if (result?.locale === "de" || result?.locale === "en") setLocaleState(result.locale);
			})
			.catch(() => undefined)
			.finally(() => {
				if (active) setInitialized(true);
			});

		return () => {
			active = false;
		};
	}, [initialized, session?.user?.id, status]);

	useEffect(() => {
		document.documentElement.lang = locale;
		if (initialized) window.localStorage.setItem(STORAGE_KEY, locale);
	}, [initialized, locale]);

	const setLocale = useCallback(
		(value: Locale) => {
			setLocaleState(value);
			window.localStorage.setItem(STORAGE_KEY, value);
			if (session?.user?.id) {
				void fetch("/api/user/preferences", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ locale: value }),
				});
			}
		},
		[session?.user?.id]
	);

	const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, text: (en, de) => (locale === "en" ? en : de) }), [locale, setLocale]);

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
	const value = useContext(LocaleContext);
	if (!value) throw new Error("useLocale must be used inside LocaleProvider");
	return value;
}
