"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { ArrowLeft, Check, ChevronDown, Flower2, Gauge, Plus, ShieldAlert, Sparkles } from "lucide-react";
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

type RoleOption = { id: string; name: string; color: number; assignable: boolean };
type RolePickerData = { configured: boolean; roles: RoleOption[]; error?: string };
const CREATE_ROLE = "__create__";

function localDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AdminChallengesPage() {
	const { text } = useLocale();
	const { data, error, mutate } = useSWR<{ challenges: Challenge[]; queues: { riot: number; discord: number } }>("/api/admin/challenges", fetcher);
	const { data: rolePicker } = useSWR<RolePickerData>(data ? "/api/admin/discord/roles" : null, fetcher);
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
			// A newly created role must show up in every picker.
			if (payload.discordRoleId === CREATE_ROLE) await globalMutate("/api/admin/discord/roles");
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
				{creating && <ChallengeForm rolePicker={rolePicker} onSubmit={(event) => save(event)} />}
				<div className="challenge-admin-list">
					{data.challenges.map((challenge) => (
						<ChallengeForm challenge={challenge} rolePicker={rolePicker} key={challenge.id} onSubmit={(event) => save(event, challenge.id)} />
					))}
				</div>
			</section>
		</main>
	);
}

function ChallengeForm({
	challenge,
	rolePicker,
	onSubmit,
}: {
	challenge?: Challenge;
	rolePicker?: RolePickerData;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	const { text } = useLocale();
	// Folded fields stay mounted (only hidden), so nothing is lost from the form.
	const [open, setOpen] = useState(!challenge);
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
				<div className="challenge-admin-head-actions">
					{challenge && (
						<button className="challenge-admin-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
							{open ? text("Fold", "Zuklappen") : text("Edit", "Bearbeiten")} <ChevronDown size={16} aria-hidden="true" />
						</button>
					)}
					<label className="switch-control" aria-label={text("Active", "Aktiv")}>
						<input name="enabled" type="checkbox" defaultChecked={challenge?.enabled !== false} />
						<span />
					</label>
				</div>
			</header>
			<div className="challenge-admin-fields" hidden={!open}>
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
				<RolePicker challenge={challenge} picker={rolePicker} />
				<label className="wide">
					{text("Meta prerequisites", "Meta-Voraussetzungen")}
					<input
						name="prerequisiteIds"
						defaultValue={challenge?.prerequisiteIds?.join(", ")}
						placeholder={text("Challenge IDs separated by commas", "Challenge-IDs, durch Komma getrennt")}
					/>
				</label>
			</div>
			<footer hidden={!open}>
				<code>{challenge?.id || text("generated automatically", "wird automatisch erzeugt")}</code>
				<button className="button button-secondary button-small" type="submit">
					<Check size={14} /> {text("Save", "Speichern")}
				</button>
			</footer>
		</form>
	);
}

/** Pick a server role (or create one on save). Falls back to typing the ID when the bot is not configured. */
function RolePicker({ challenge, picker }: { challenge?: Challenge; picker?: RolePickerData }) {
	const { text } = useLocale();
	const [selected, setSelected] = useState(challenge?.discordRoleId || "");
	const [newName, setNewName] = useState(challenge?.title || "");
	// After saving, follow the stored role so a second save does not create the role again.
	useEffect(() => setSelected(challenge?.discordRoleId || ""), [challenge?.discordRoleId]);
	if (!picker?.configured)
		return (
			<>
				<label>
					{text("Discord role ID", "Discord-Rollen-ID")}
					<input name="discordRoleId" defaultValue={challenge?.discordRoleId} inputMode="numeric" autoComplete="off" spellCheck={false} />
				</label>
				<label>
					{text("Discord role name", "Discord-Rollenname")}
					<input name="discordRoleName" defaultValue={challenge?.discordRoleName} autoComplete="off" />
				</label>
			</>
		);
	const current = picker.roles.find((role) => role.id === selected);
	const unknownCurrent = selected && selected !== CREATE_ROLE && !current;
	return (
		<>
			<label className="wide">
				{text("Discord role reward", "Discord-Rolle als Belohnung")}
				<select name="discordRoleId" value={selected} onChange={(event) => setSelected(event.target.value)}>
					<option value="">{text("No role", "Keine Rolle")}</option>
					<option value={CREATE_ROLE}>{text("+ Create new role…", "+ Neue Rolle erstellen…")}</option>
					{unknownCurrent && (
						<option value={selected}>
							{selected.startsWith("managed:")
								? text(`Created automatically (${challenge?.discordRoleName || selected})`, `Wird automatisch erstellt (${challenge?.discordRoleName || selected})`)
								: text(`Unknown role ${selected}`, `Unbekannte Rolle ${selected}`)}
						</option>
					)}
					{picker.roles.map((role) => (
						<option key={role.id} value={role.id} disabled={!role.assignable}>
							{role.name}
							{role.assignable ? "" : text(" (above the bot)", " (über dem Bot)")}
						</option>
					))}
				</select>
				{picker.error && <small className="form-error">{picker.error}</small>}
				<small className="muted-note">
					{text(
						"Players get this role when they finish the challenge. Roles above the bot's own role cannot be given out.",
						"Spieler bekommen diese Rolle, wenn sie die Challenge schaffen. Rollen über der Bot-Rolle kann der Bot nicht vergeben."
					)}
				</small>
			</label>
			{selected === CREATE_ROLE ? (
				<label className="wide">
					{text("Name of the new role", "Name der neuen Rolle")}
					<input name="discordRoleName" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} required autoComplete="off" />
					<small className="muted-note">
						{text("The role is created on Discord when you save.", "Die Rolle wird beim Speichern auf Discord erstellt.")}
					</small>
				</label>
			) : (
				<input type="hidden" name="discordRoleName" value={current?.name || (unknownCurrent ? challenge?.discordRoleName || "" : "")} />
			)}
		</>
	);
}
