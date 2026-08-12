"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

type Theme = "sakura-night" | "hanami-light";

export function ThemeToggle() {
	const { text } = useLocale();
	const [theme, setTheme] = useState<Theme>("sakura-night");

	useEffect(() => {
		const saved = window.localStorage.getItem("nachtara-theme") as Theme | null;
		const initial = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "hanami-light" : "sakura-night");
		setTheme(initial);
		document.documentElement.dataset.theme = initial;
	}, []);

	function toggleTheme() {
		const next: Theme = theme === "sakura-night" ? "hanami-light" : "sakura-night";
		setTheme(next);
		document.documentElement.dataset.theme = next;
		window.localStorage.setItem("nachtara-theme", next);
	}

	const light = theme === "hanami-light";
	return (
		<button
			className="icon-button theme-toggle"
			type="button"
			onClick={toggleTheme}
			aria-label={light ? text("Activate Sakura Night", "Sakura Night aktivieren") : text("Activate Hanami Light", "Hanami Light aktivieren")}
			title={light ? "Sakura Night" : "Hanami Light"}
		>
			{light ? <Moon size={18} /> : <Sun size={18} />}
		</button>
	);
}
