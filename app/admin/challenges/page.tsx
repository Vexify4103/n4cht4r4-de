"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Check, Flower2, Gauge, Plus, ShieldAlert, Sparkles } from "lucide-react";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Die Challenge-Verwaltung konnte nicht geladen werden.");
		return result;
	});

type Challenge = {
	id: string;
	title: string;
	description: string;
	type: string;
	target: number;
	icon: string;
	seasonId: string;
	startsAt: string;
	endsAt: string;
	enabled?: boolean;
	sortOrder?: number;
	reward?: string;
	discordRoleId?: string;
	discordRoleName?: string;
	gameMode?: string;
	queueId?: number;
	requirement?: string;
	prerequisiteIds?: string[];
	badge?: { id: string; name: string; description: string; icon: string; rarity: string };
};

function localDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AdminChallengesPage() {
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
		setNotice(response.ok ? (id ? "Challenge gespeichert." : "Challenge angelegt.") : result.error || "Speichern fehlgeschlagen.");
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
					<h3>Kein Challenge-Zugriff</h3>
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
					<ArrowLeft size={15} /> Turnierakte
				</Link>
				<span className="admin-seal">
					<Sparkles size={31} />
				</span>
				<div>
					<span className="kicker">Community-System</span>
					<h1>Challenge-Garten</h1>
					<p>Saisons, Ziele, Badges und Discord-Belohnungen an einem Ort pflegen.</p>
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
						<span className="kicker">Aktive und archivierte Ziele</span>
						<h2>{data.challenges.length} Challenges</h2>
					</div>
					<button className="button button-primary" onClick={() => setCreating((value) => !value)}>
						<Plus size={15} /> Neue Challenge
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
	return (
		<form className={`challenge-admin-form ${challenge?.enabled === false ? "disabled" : ""}`} onSubmit={onSubmit}>
			<header>
				<div>
					<span>{challenge?.icon || "🌸"}</span>
					<div>
						<small>{challenge?.seasonId || "Neue Saison"}</small>
						<h3>{challenge?.title || "Neue Challenge"}</h3>
					</div>
				</div>
				<label className="switch-control">
					<input name="enabled" type="checkbox" defaultChecked={challenge?.enabled !== false} />
					<span />
				</label>
			</header>
			<div className="challenge-admin-fields">
				<label>
					Titel
					<input name="title" defaultValue={challenge?.title} required />
				</label>
				<label>
					Typ
					<select name="type" defaultValue={challenge?.type || "matches"}>
						<option value="matches">Matches</option>
						<option value="wins">Siege</option>
						<option value="kills">Kills</option>
						<option value="watchtime">Watchtime</option>
						<option value="community">Community</option>
						<option value="meta">Meta</option>
					</select>
				</label>
				<label>
					Ziel
					<input name="target" type="number" min="1" defaultValue={challenge?.target || 1} required />
				</label>
				<label>
					Sortierung
					<input name="sortOrder" type="number" defaultValue={challenge?.sortOrder || 999} />
				</label>
				<label>
					Saison
					<input name="seasonId" defaultValue={challenge?.seasonId || "custom"} required />
				</label>
				<label>
					Icon
					<input name="icon" defaultValue={challenge?.icon || "🌸"} />
				</label>
				<label>
					Verbindung
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
					Ende
					<input
						name="endsAt"
						type="datetime-local"
						defaultValue={challenge ? localDate(challenge.endsAt) : localDate(new Date(Date.now() + 30 * 864e5).toISOString())}
						required
					/>
				</label>
				<label className="wide">
					Beschreibung
					<textarea name="description" defaultValue={challenge?.description} required />
				</label>
				<label className="wide">
					Belohnungstext
					<input name="reward" defaultValue={challenge?.reward} />
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
					Badge-Icon
					<input name="badgeIcon" defaultValue={challenge?.badge?.icon} />
				</label>
				<label>
					Seltenheit
					<select name="badgeRarity" defaultValue={challenge?.badge?.rarity || "common"}>
						<option value="common">Gewöhnlich</option>
						<option value="rare">Selten</option>
						<option value="epic">Episch</option>
					</select>
				</label>
				<label className="wide">
					Badge-Beschreibung
					<input name="badgeDescription" defaultValue={challenge?.badge?.description} />
				</label>
				<label>
					Discord-Rollen-ID
					<input name="discordRoleId" defaultValue={challenge?.discordRoleId} />
				</label>
				<label>
					Discord-Rollenname
					<input name="discordRoleName" defaultValue={challenge?.discordRoleName} />
				</label>
				<label className="wide">
					Meta-Voraussetzungen
					<input name="prerequisiteIds" defaultValue={challenge?.prerequisiteIds?.join(", ")} placeholder="Challenge-IDs, durch Komma getrennt" />
				</label>
			</div>
			<footer>
				<code>{challenge?.id || "wird automatisch erzeugt"}</code>
				<button className="button button-secondary button-small" type="submit">
					<Check size={14} /> Speichern
				</button>
			</footer>
		</form>
	);
}
