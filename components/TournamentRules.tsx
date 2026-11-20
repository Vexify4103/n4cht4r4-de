"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Rules are stored as lines: "## Title" starts a section, every other line is one rule.
// Layout ideas (table of contents with scroll spy, direct rule links) come from the Lauchgruen rulebook.

type RuleLine = { id: string; number: number; text: string };
type RuleSection = { id: string; title: string; rules: RuleLine[] };

function slugify(value: string) {
	return (
		value
			.toLowerCase()
			.replace(/ß/g, "ss")
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/^\s*\d+[.)]\s*/, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "abschnitt"
	);
}

export function parseRuleSections(lines: string[], introTitle: string): RuleSection[] {
	const sections: RuleSection[] = [];
	const used = new Set<string>();
	const uniqueId = (base: string) => {
		let id = base;
		for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
		used.add(id);
		return id;
	};
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("## ")) {
			const title = line.slice(3).trim();
			sections.push({ id: uniqueId(slugify(title.replace(/[^\p{L}\p{N}\s.)-]/gu, ""))), title, rules: [] });
			continue;
		}
		if (!sections.length) sections.push({ id: uniqueId("einleitung"), title: introTitle, rules: [] });
		const section = sections[sections.length - 1];
		const number = section.rules.length + 1;
		section.rules.push({ id: `${section.id}-${number}`, number, text: line });
	}
	return sections;
}

/** Minimal inline Markdown: **bold**, *italic* and [text](https://link). Everything else stays plain text. */
function renderInline(text: string): ReactNode[] {
	const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
	return text.split(pattern).map((part, index) => {
		if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
		if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
		const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
		if (link)
			return (
				<a key={index} href={link[2]} target="_blank" rel="noreferrer">
					{link[1]}
				</a>
			);
		return <Fragment key={index}>{part}</Fragment>;
	});
}

function CopyLink({ id, title }: { id: string; title: string }) {
	const { text } = useLocale();
	const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
	useEffect(() => {
		if (status === "idle") return;
		const timer = window.setTimeout(() => setStatus("idle"), 2500);
		return () => window.clearTimeout(timer);
	}, [status]);
	async function copy() {
		try {
			const url = new URL(window.location.href);
			url.hash = id;
			await navigator.clipboard.writeText(url.toString());
			setStatus("copied");
		} catch {
			setStatus("error");
		}
	}
	return (
		<span className="rules-copy">
			<button type="button" onClick={copy} aria-label={`${text("Copy link", "Link kopieren")}: ${title}`} title={text("Copy link", "Link kopieren")}>
				{status === "copied" ? <Check size={14} /> : <Link2 size={14} />}
			</button>
			<span className="rules-copy-status" role="status">
				{status === "copied" ? text("Link copied.", "Link kopiert.") : status === "error" ? <a href={`#${id}`}>{text("Open direct link", "Direktlink öffnen")}</a> : ""}
			</span>
		</span>
	);
}

export function TournamentRules({ rules }: { rules: string[] }) {
	const { locale, text } = useLocale();
	const sections = useMemo(() => parseRuleSections(rules, locale === "en" ? "Introduction" : "Einleitung"), [rules, locale]);
	const [jumpedToHash, setJumpedToHash] = useState(false);
	const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
	const ruleCount = sections.reduce((sum, section) => sum + section.rules.length, 0);

	useEffect(() => {
		const ids = sections.map((section) => section.id);
		let frame = 0;
		function update() {
			frame = 0;
			const offset = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 110) + 24;
			let current = ids[0] ?? "";
			for (const id of ids) {
				const element = document.getElementById(id);
				if (element && element.getBoundingClientRect().top <= offset) current = id;
			}
			setActiveId(current);
		}
		function schedule() {
			if (!frame) frame = requestAnimationFrame(update);
		}
		schedule();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		window.addEventListener("hashchange", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			window.removeEventListener("hashchange", schedule);
		};
	}, [sections]);

	// Jump to a shared rule link once the rules have rendered (they load client-side).
	useEffect(() => {
		if (jumpedToHash || !sections.length) return;
		setJumpedToHash(true);
		const hash = decodeURIComponent(window.location.hash.slice(1));
		if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
	}, [sections, jumpedToHash]);

	const links = sections.map((section) => (
		<a key={section.id} href={`#${section.id}`} aria-current={activeId === section.id ? "location" : undefined}>
			{section.title}
		</a>
	));

	return (
		<div className="rules-layout">
			<aside className="rules-sidebar">
				<nav className="rules-toc" aria-label={text("Rule sections", "Regelabschnitte")}>
					<p className="rules-toc-label">{text("Contents", "Inhaltsverzeichnis")}</p>
					{links}
					<span className="rules-toc-meta">
						{sections.length} {text("sections", "Abschnitte")} · {ruleCount} {text("rules", "Regeln")}
					</span>
				</nav>
				<details className="rules-toc-mobile">
					<summary>
						{text("Contents", "Inhaltsverzeichnis")} <span>{sections.length}</span>
					</summary>
					<nav aria-label={text("Rule sections", "Regelabschnitte")}>{links}</nav>
				</details>
			</aside>
			<div className="tournament-rules rules-content">
				{sections.map((section) => (
					<section className="rules-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
						<header className="rules-section-header">
							<h2 id={`${section.id}-title`}>{section.title}</h2>
							<CopyLink id={section.id} title={section.title} />
						</header>
						{section.rules.map((rule) => (
							<div className="rule-item" id={rule.id} key={rule.id}>
								<span className="rule-number">{String(rule.number).padStart(2, "0")}</span>
								<span className="rule-text">{renderInline(rule.text)}</span>
								<CopyLink id={rule.id} title={`${section.title} · ${rule.number}`} />
							</div>
						))}
					</section>
				))}
			</div>
		</div>
	);
}
