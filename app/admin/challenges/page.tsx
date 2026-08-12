"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Check, Flower2, Gauge, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Die Challenge-Verwaltung konnte nicht geladen werden.");
		return result;
	});

type Challenge = {
	id: string;
	title: string;
	titleEn?: string;
	description: string;
	descriptionEn?: string;
	type: string;
	target: number;
	icon: string;
	seasonId: string;
	startsAt: string;
	endsAt: string;
	enabled?: boolean;
	sortOrder?: number;
	reward?: string;
	rewardEn?: string;
	discordRoleId?: string;
	discordRoleName?: string;
	gameMode?: string;
	queueId?: number;
	requirement?: string;
	prerequisiteIds?: string[];
	badge?: { id: string; name: string; nameEn?: string; description: string; descriptionEn?: string; icon: string; rarity: string };
};

function localDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AdminChallengesPage() {
	const { text } = useLocale();
	const { data, error, mutate } = useSWR<{ challenges: Challenge[]; queues: { riot: number; discord: number } }>("/api/admin/challenges", fetcher);
	const [notice, setNotice] = useState("");
	const [creating, setCreating] = useState(false);

	async function save(event: FormEvent<HTMLFormElement>, id?: string) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const payload = Object.fromEntries(form.entries());
		const response = await fetch("/api/admin/challenges", {
			method: id ? "PATCH" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...payload, id, enabled: form.get("enabled") === "on", target: Number(form.get("target")), sortOrder: Number(form.get("sortOrder")) }),
		});
		const result = await response.json();
		setNotice(
			response.ok
				? id
					? text("Challenge saved.", "Challenge gespeichert.")
					: text("Challenge created.", "Challenge angelegt.")
				: result.error || text("Saving failed.", "Speichern fehlgeschlagen.")
		);
		if (response.ok) {
			setCreating(false);
			await mutate();
		}
	}

	if (error)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={38} />
					<h3>{text("No challenge access", "Kein Challenge-Zugriff")}</h3>
					<p>{error.message}</p>
				</div>
			</section>
		);
	if (!data)
		return (
			<section className="content-band">
				<div className="skeleton admin-workspace-skeleton" />
			</section>
		);

	return (
		<main className="admin-sanctuary challenge-admin">
			<section className="admin-welcome">
				<Link className="admin-back-link" href="/admin/tournaments">
					<ArrowLeft size={15} /> {text("Tournament records", "Turnierakte")}
				</Link>
				<span className="admin-seal">
					<Sparkles size={31} />
				</span>
				<div>
					<span className="kicker">{text("Community system", "Community-System")}</span>
					<h1>{text("Challenge garden", "Challenge-Garten")}</h1>
					<p>{text("Manage seasons, goals, badges, and Discord rewards in one place.", "Saisons, Ziele, Badges und Discord-Belohnungen an einem Ort pflegen.")}</p>
				</div>
				<div className="challenge-queue-health">
					<span>
						<Gauge size={14} /> Riot Queue: {data.queues.riot}
					</span>
					<span>
						<Gauge size={14} /> Discord Queue: {data.queues.discord}
					</span>
				</div>
			</section>
			<section className="challenge-admin-ledger">
				<header>
					<div>
						<span className="kicker">{text("Active and archived goals", "Aktive und archivierte Ziele")}</span>
						<h2>{data.challenges.length} Challenges</h2>
					</div>
					<button className="button button-primary" onClick={() => setCreating((value) => !value)}>
						<Plus size={15} /> {text("New challenge", "Neue Challenge")}
					</button>
				</header>
				{notice && (
					<p className="admin-notice">
						<Flower2 size={15} /> {notice}
					</p>
				)}
				{creating && <ChallengeForm onSubmit={(event) => save(event)} />}
				<div className="challenge-admin-list">
					{data.challenges.map((challenge) => (
						<ChallengeForm challenge={challenge} key={challenge.id} onSubmit={(event) => save(event, challenge.id)} />
					))}
				</div>
			</section>
		</main>
	);
}

function ChallengeForm({ challenge, onSubmit }: { challenge?: Challenge; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
	const { text } = useLocale();
	return (
		<form className={`challenge-admin-form ${challenge?.enabled === false ? "disabled" : ""}`} onSubmit={onSubmit}>
			<header>
				<div>
					<span>{challenge?.icon || "🌸"}</span>
					<div>
						<small>{challenge?.seasonId || text("New season", "Neue Saison")}</small>
						<h3>{challenge?.title || text("New challenge", "Neue Challenge")}</h3>
					</div>
				</div>
				<label className="switch-control">
					<input name="enabled" type="checkbox" defaultChecked={challenge?.enabled !== false} />
					<span />
				</label>
			</header>
			<div className="challenge-admin-fields">
				<label>
					{text("Title (German)", "Titel")}
					<input name="title" defaultValue={challenge?.title} required />
				</label>
				<label>
					{text("Title (English)", "Titel (Englisch)")}
					<input name="titleEn" defaultValue={challenge?.titleEn} />
				</label>
				<label>
					{text("Type", "Typ")}
					<select name="type" defaultValue={challenge?.type || "matches"}>
						<option value="matches">Matches</option>
						<option value="wins">{text("Wins", "Siege")}</option>
						<option value="kills">Kills</option>
						<option value="watchtime">Watchtime</option>
						<option value="community">Community</option>
						<option value="meta">Meta</option>
					</select>
				</label>
				<label>
					{text("Target", "Ziel")}
					<input name="target" type="number" min="1" defaultValue={challenge?.target || 1} required />
				</label>
				<label>
					{text("Sort order", "Sortierung")}
					<input name="sortOrder" type="number" defaultValue={challenge?.sortOrder || 999} />
				</label>
				<label>
					{text("Season", "Saison")}
					<input name="seasonId" defaultValue={challenge?.seasonId || "custom"} required />
				</label>
				<label>
					Icon
					<input name="icon" defaultValue={challenge?.icon || "🌸"} />
				</label>
				<label>
					{text("Connection", "Verbindung")}
					<select name="requirement" defaultValue={challenge?.requirement || "discord"}>
						<option value="discord">Discord</option>
						<option value="twitch">Twitch</option>
						<option value="riot">Riot</option>
						<option value="community">Community</option>
					</select>
				</label>
				<label>
					Game Mode
					<input name="gameMode" defaultValue={challenge?.gameMode} placeholder="z. B. ARAM" />
				</label>
				<label>
					Queue-ID
					<input name="queueId" type="number" defaultValue={challenge?.queueId} placeholder="z. B. 420" />
				</label>
				<label>
					Start
					<input name="startsAt" type="datetime-local" defaultValue={challenge ? localDate(challenge.startsAt) : localDate(new Date().toISOString())} required />
				</label>
				<label>
					{text("End", "Ende")}
					<input
						name="endsAt"
						type="datetime-local"
						defaultValue={challenge ? localDate(challenge.endsAt) : localDate(new Date(Date.now() + 30 * 864e5).toISOString())}
						required
					/>
				</label>
				<label className="wide">
					{text("Description (German)", "Beschreibung")}
					<textarea name="description" defaultValue={challenge?.description} required />
				</label>
				<label className="wide">
					{text("Description (English)", "Beschreibung (Englisch)")}
					<textarea name="descriptionEn" defaultValue={challenge?.descriptionEn} />
				</label>
				<label className="wide">
					{text("Reward text (German)", "Belohnungstext")}
					<input name="reward" defaultValue={challenge?.reward} />
				</label>
				<label className="wide">
					{text("Reward text (English)", "Belohnungstext (Englisch)")}
					<input name="rewardEn" defaultValue={challenge?.rewardEn} />
				</label>
				<label>
					Badge-ID
					<input name="badgeId" defaultValue={challenge?.badge?.id} />
				</label>
				<label>
					Badge-Name
					<input name="badgeName" defaultValue={challenge?.badge?.name} />
				</label>
				<label>
					Badge-Name (English)
					<input name="badgeNameEn" defaultValue={challenge?.badge?.nameEn} />
				</label>
				<label>
					Badge-Icon
					<input name="badgeIcon" defaultValue={challenge?.badge?.icon} />
				</label>
				<label>
					Seltenheit
					<select name="badgeRarity" defaultValue={challenge?.badge?.rarity || "common"}>
						<option value="common">{text("Common", "Gewöhnlich")}</option>
						<option value="rare">{text("Rare", "Selten")}</option>
						<option value="epic">{text("Epic", "Episch")}</option>
					</select>
				</label>
				<label className="wide">
					{text("Badge description (German)", "Badge-Beschreibung")}
					<input name="badgeDescription" defaultValue={challenge?.badge?.description} />
				</label>
				<label className="wide">
					{text("Badge description (English)", "Badge-Beschreibung (Englisch)")}
					<input name="badgeDescriptionEn" defaultValue={challenge?.badge?.descriptionEn} />
				</label>
				<label>
					{text("Discord role ID", "Discord-Rollen-ID")}
					<input name="discordRoleId" defaultValue={challenge?.discordRoleId} />
				</label>
				<label>
					{text("Discord role name", "Discord-Rollenname")}
					<input name="discordRoleName" defaultValue={challenge?.discordRoleName} />
				</label>
				<label className="wide">
					{text("Meta prerequisites", "Meta-Voraussetzungen")}
					<input
						name="prerequisiteIds"
						defaultValue={challenge?.prerequisiteIds?.join(", ")}
						placeholder={text("Challenge IDs separated by commas", "Challenge-IDs, durch Komma getrennt")}
					/>
				</label>
			</div>
			<footer>
				<code>{challenge?.id || text("generated automatically", "wird automatisch erzeugt")}</code>
				<button className="button button-secondary button-small" type="submit">
					<Check size={14} /> {text("Save", "Speichern")}
				</button>
			</footer>
		</form>
	);
}
