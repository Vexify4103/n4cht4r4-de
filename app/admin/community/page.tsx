"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Brush, Check, ClipboardCheck, Flower2, Gamepad2, ImageIcon, MessageCircleHeart, Plus, Save, ShieldAlert, Sparkles, X } from "lucide-react";
import type { CommunityPostKind, CommunityPostStatus, CommunityProject } from "@/lib/community";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Daten konnten nicht geladen werden.");
		return result;
	});

type ModerationPost = {
	id: string;
	kind: CommunityPostKind;
	title?: string;
	body: string;
	authorName: string;
	mediaUrl?: string | null;
	status: CommunityPostStatus;
	moderationNote?: string;
	createdAt: string;
};

const statusCopy = { pending: "Wartet", published: "Freigegeben", rejected: "Abgelehnt" };

function ProjectEditor({ project, onSaved }: { project: CommunityProject; onSaved: () => Promise<unknown> }) {
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState(false);
	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setNotice("");
		const form = new FormData(event.currentTarget);
		const response = await fetch("/api/admin/community/projects", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: project.id,
				title: form.get("title"),
				game: form.get("game"),
				summary: form.get("summary"),
				details: form.get("details"),
				status: form.get("status"),
				statusLabel: form.get("statusLabel"),
				imageUrl: form.get("imageUrl"),
				applicationHref: form.get("applicationHref") || null,
				rules: String(form.get("rules") || "").split("\n"),
				order: Number(form.get("order") || 100),
				published: form.get("published") === "on",
			}),
		});
		const result = await response.json();
		setSaving(false);
		if (!response.ok) return setNotice(result.error || "Projekt konnte nicht gespeichert werden.");
		setNotice("Projekt gespeichert.");
		await onSaved();
	}

	return (
		<form className="community-project-editor" onSubmit={save}>
			<header>
				{project.imageUrl ? (
					<Image src={project.imageUrl} alt="" width={96} height={54} />
				) : (
					<span>
						<ImageIcon size={22} />
					</span>
				)}
				<div>
					<small>{project.game}</small>
					<h2>{project.title}</h2>
				</div>
				<label className="project-publish-toggle">
					<input name="published" type="checkbox" defaultChecked={project.published} />
					<span>Öffentlich</span>
				</label>
			</header>
			<div className="community-project-editor-fields">
				<label>
					Titel
					<input name="title" defaultValue={project.title} required />
				</label>
				<label>
					Spiel
					<input name="game" defaultValue={project.game} required />
				</label>
				<label>
					Status
					<select name="status" defaultValue={project.status}>
						<option value="online">Online</option>
						<option value="planning">In Planung</option>
						<option value="paused">Pause</option>
						<option value="ended">Archiv</option>
					</select>
				</label>
				<label>
					Status-Text
					<input name="statusLabel" defaultValue={project.statusLabel} required />
				</label>
				<label>
					Sortierung
					<input name="order" type="number" min="0" max="10000" defaultValue={project.order} />
				</label>
				<label>
					Bildpfad oder URL
					<input name="imageUrl" defaultValue={project.imageUrl} />
				</label>
				<label className="wide">
					Kurzbeschreibung
					<textarea name="summary" defaultValue={project.summary} required />
				</label>
				<label className="wide">
					Ausführliche Infos
					<textarea name="details" defaultValue={project.details} />
				</label>
				<label className="wide">
					Regeln · eine pro Zeile
					<textarea name="rules" defaultValue={project.rules.join("\n")} />
				</label>
				<label className="wide">
					Bewerbungslink
					<input name="applicationHref" defaultValue={project.applicationHref || ""} placeholder="Leer lassen, wenn es noch keine Bewerbung gibt" />
				</label>
			</div>
			<footer>
				<span>{notice}</span>
				<button className="button button-primary button-small" disabled={saving} type="submit">
					<Save size={14} /> {saving ? "Speichert ..." : "Projekt speichern"}
				</button>
			</footer>
		</form>
	);
}

export default function AdminCommunityPage() {
	const [tab, setTab] = useState<"moderation" | "projects">("moderation");
	const [filter, setFilter] = useState<CommunityPostStatus>("pending");
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");
	const [newProjectOpen, setNewProjectOpen] = useState(false);
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data: moderation, mutate: refreshPosts } = useSWR<{ posts: ModerationPost[]; counts: Record<string, number> }>(
		access ? `/api/admin/community/posts?status=${filter}` : null,
		fetcher
	);
	const { data: projectData, mutate: refreshProjects } = useSWR<{ projects: CommunityProject[]; usingDefaults: boolean }>(
		access ? "/api/admin/community/projects" : null,
		fetcher
	);

	async function moderate(id: string, status: CommunityPostStatus) {
		setNotice("");
		const response = await fetch("/api/admin/community/posts", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, status, moderationNote: notes[id] || "" }),
		});
		const result = await response.json();
		if (!response.ok) return setNotice(result.error || "Moderation konnte nicht gespeichert werden.");
		setNotice(status === "published" ? "Beitrag hängt jetzt öffentlich an der Pinnwand." : "Beitrag wurde aus der öffentlichen Pinnwand genommen.");
		await refreshPosts();
	}

	async function createProject(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const response = await fetch("/api/admin/community/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: form.get("title"),
				game: form.get("game"),
				summary: form.get("summary"),
				details: "",
				status: "planning",
				statusLabel: "In Vorbereitung",
				imageUrl: "",
				applicationHref: null,
				rules: [],
				order: 100,
				published: false,
			}),
		});
		const result = await response.json();
		if (!response.ok) return setNotice(result.error || "Projekt konnte nicht erstellt werden.");
		setNewProjectOpen(false);
		setNotice("Projekt als nicht öffentlicher Entwurf angelegt.");
		await refreshProjects();
	}

	if (accessError)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>Kein Moderationszugriff</h3>
					<p>Dein Discord-Konto ist nicht für die Community-Verwaltung hinterlegt.</p>
				</div>
			</section>
		);
	if (!access)
		return (
			<section className="content-band">
				<div className="skeleton admin-workspace-skeleton" />
			</section>
		);

	return (
		<main className="admin-community-sanctuary">
			<header className="admin-community-hero">
				<Link href="/admin/tournaments">
					<ArrowLeft size={15} /> Zur Turnierverwaltung
				</Link>
				<span className="admin-seal">
					<MessageCircleHeart size={28} />
				</span>
				<div>
					<span className="kicker">Community-Verwaltung · {access.role}</span>
					<h1>Blütenpost & Spielwelten</h1>
					<p>Beiträge behutsam freigeben und gemeinsame Server aktuell halten.</p>
				</div>
			</header>

			<section className="admin-community-workspace">
				<div className="admin-community-tabs">
					<button className={tab === "moderation" ? "active" : ""} onClick={() => setTab("moderation")}>
						<ClipboardCheck size={16} /> Moderation <span>{moderation?.counts.pending || 0}</span>
					</button>
					<button className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}>
						<Gamepad2 size={16} /> Community-Projekte
					</button>
					<Link href="/admin/challenges">
						<Sparkles size={15} /> Challenges
					</Link>
				</div>
				{notice && (
					<p className="admin-notice">
						<Flower2 size={15} /> {notice}
					</p>
				)}

				{tab === "moderation" && (
					<div className="community-moderation-area">
						<header>
							<div>
								<span className="kicker">Moderationskorb</span>
								<h2>Was darf an die Pinnwand?</h2>
							</div>
							<div className="moderation-filters">
								{(["pending", "published", "rejected"] as CommunityPostStatus[]).map((status) => (
									<button className={filter === status ? "active" : ""} key={status} onClick={() => setFilter(status)}>
										{statusCopy[status]} <span>{moderation?.counts[status] || 0}</span>
									</button>
								))}
							</div>
						</header>
						<div className="community-moderation-list">
							{moderation?.posts.map((post) => (
								<article className="community-moderation-entry" key={post.id}>
									{post.mediaUrl && (
										<div className="moderation-art">
											<Image src={post.mediaUrl} alt={post.title || "Fanart zur Moderation"} fill sizes="280px" unoptimized />
										</div>
									)}
									<div className="moderation-copy">
										<header>
											<span>
												{post.kind === "fanart" ? <Brush size={14} /> : <MessageCircleHeart size={14} />} {post.kind === "fanart" ? "Fanart" : "Gruß"}
											</span>
											<small>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.createdAt))}</small>
										</header>
										<strong>{post.title || post.authorName}</strong>
										{post.title && <small>von {post.authorName}</small>}
										<p>{post.body}</p>
										<label>
											Interne Notiz
											<textarea
												value={notes[post.id] ?? post.moderationNote ?? ""}
												onChange={(event) => setNotes((current) => ({ ...current, [post.id]: event.target.value }))}
												placeholder="Optionaler Grund oder Hinweis für das Mod-Team"
											/>
										</label>
										<footer>
											<button className="button button-secondary button-small" onClick={() => moderate(post.id, "rejected")}>
												<X size={14} /> Ablehnen
											</button>
											<button className="button button-primary button-small" onClick={() => moderate(post.id, "published")}>
												<Check size={14} /> Freigeben
											</button>
										</footer>
									</div>
								</article>
							))}
							{moderation && moderation.posts.length === 0 && (
								<div className="empty-state">
									<ClipboardCheck size={36} />
									<h3>Dieser Korb ist leer</h3>
									<p>Hier wartet gerade nichts auf das Mod-Team.</p>
								</div>
							)}
						</div>
					</div>
				)}

				{tab === "projects" && (
					<div className="community-project-admin-area">
						<header>
							<div>
								<span className="kicker">Weltenbuch</span>
								<h2>Server und Projekte pflegen</h2>
								<p>Status, Regeln und Bewerbungslinks erscheinen direkt im öffentlichen Projekt-Hub.</p>
							</div>
							<button className="button button-primary" onClick={() => setNewProjectOpen((open) => !open)}>
								{newProjectOpen ? <X size={15} /> : <Plus size={15} />} {newProjectOpen ? "Abbrechen" : "Projekt anlegen"}
							</button>
						</header>
						{projectData?.usingDefaults && (
							<p className="project-default-note">
								<Flower2 size={14} /> Die beiden Startprojekte sind Vorlagen. Beim ersten Speichern werden sie in MongoDB übernommen.
							</p>
						)}
						{newProjectOpen && (
							<form className="new-community-project" onSubmit={createProject}>
								<label>
									Projektname
									<input name="title" required />
								</label>
								<label>
									Spiel
									<input name="game" required />
								</label>
								<label>
									Kurzbeschreibung
									<textarea name="summary" required />
								</label>
								<button className="button button-primary" type="submit">
									Entwurf anlegen
								</button>
							</form>
						)}
						<div className="community-project-editor-list">
							{projectData?.projects.map((project) => (
								<ProjectEditor project={project} onSaved={refreshProjects} key={project.id} />
							))}
						</div>
					</div>
				)}
			</section>
		</main>
	);
}
