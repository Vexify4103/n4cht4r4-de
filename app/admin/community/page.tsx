"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
	AlertTriangle,
	ArrowLeft,
	Brush,
	Check,
	ClipboardCheck,
	Flower2,
	Gamepad2,
	ImageIcon,
	MessageCircleHeart,
	Plus,
	Save,
	ShieldAlert,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import type { CommunityPostKind, CommunityPostStatus, CommunityProject } from "@/lib/community";
import { useLocale } from "@/components/LocaleProvider";

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

function ProjectEditor({ project, onSaved }: { project: CommunityProject; onSaved: () => Promise<unknown> }) {
	const { text } = useLocale();
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
		if (!response.ok) return setNotice(result.error || text("The project could not be saved.", "Projekt konnte nicht gespeichert werden."));
		setNotice(text("Project saved.", "Projekt gespeichert."));
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
					<span>{text("Public", "Öffentlich")}</span>
				</label>
			</header>
			<div className="community-project-editor-fields">
				<label>
					{text("Title", "Titel")}
					<input name="title" defaultValue={project.title} required />
				</label>
				<label>
					{text("Game", "Spiel")}
					<input name="game" defaultValue={project.game} required />
				</label>
				<label>
					Status
					<select name="status" defaultValue={project.status}>
						<option value="online">Online</option>
						<option value="planning">{text("Planning", "In Planung")}</option>
						<option value="paused">{text("Paused", "Pause")}</option>
						<option value="ended">{text("Archive", "Archiv")}</option>
					</select>
				</label>
				<label>
					{text("Status text", "Status-Text")}
					<input name="statusLabel" defaultValue={project.statusLabel} required />
				</label>
				<label>
					{text("Sort order", "Sortierung")}
					<input name="order" type="number" min="0" max="10000" defaultValue={project.order} />
				</label>
				<label>
					{text("Image path or URL", "Bildpfad oder URL")}
					<input name="imageUrl" defaultValue={project.imageUrl} />
				</label>
				<label className="wide">
					{text("Short description", "Kurzbeschreibung")}
					<textarea name="summary" defaultValue={project.summary} required />
				</label>
				<label className="wide">
					{text("Detailed information", "Ausführliche Infos")}
					<textarea name="details" defaultValue={project.details} />
				</label>
				<label className="wide">
					{text("Rules · one per line", "Regeln · eine pro Zeile")}
					<textarea name="rules" defaultValue={project.rules.join("\n")} />
				</label>
				<label className="wide">
					{text("Application link", "Bewerbungslink")}
					<input
						name="applicationHref"
						defaultValue={project.applicationHref || ""}
						placeholder={text("Leave empty if applications are not available yet", "Leer lassen, wenn es noch keine Bewerbung gibt")}
					/>
				</label>
			</div>
			<footer>
				<span>{notice}</span>
				<button className="button button-primary button-small" disabled={saving} type="submit">
					<Save size={14} /> {saving ? text("Saving...", "Speichert ...") : text("Save project", "Projekt speichern")}
				</button>
			</footer>
		</form>
	);
}

export default function AdminCommunityPage() {
	const { locale, text } = useLocale();
	const [tab, setTab] = useState<"moderation" | "projects">("moderation");
	const [filter, setFilter] = useState<CommunityPostStatus>("pending");
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");
	const [newProjectOpen, setNewProjectOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ModerationPost | null>(null);
	const [deleting, setDeleting] = useState(false);
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const { data: moderation, mutate: refreshPosts } = useSWR<{ posts: ModerationPost[]; counts: Record<string, number> }>(
		access ? `/api/admin/community/posts?status=${filter}` : null,
		fetcher
	);
	const { data: projectData, mutate: refreshProjects } = useSWR<{ projects: CommunityProject[]; usingDefaults: boolean }>(
		access ? "/api/admin/community/projects" : null,
		fetcher
	);

	useEffect(() => {
		if (!deleteTarget) return;
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape" && !deleting) setDeleteTarget(null);
		}
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [deleteTarget, deleting]);

	async function moderate(id: string, status: CommunityPostStatus) {
		setNotice("");
		const response = await fetch("/api/admin/community/posts", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, status, moderationNote: notes[id] || "" }),
		});
		const result = await response.json();
		if (!response.ok) return setNotice(result.error || text("The moderation decision could not be saved.", "Moderation konnte nicht gespeichert werden."));
		setNotice(
			status === "published"
				? text("The post is now public on the community wall.", "Beitrag hängt jetzt öffentlich an der Pinnwand.")
				: text("The post was removed from the public community wall.", "Beitrag wurde aus der öffentlichen Pinnwand genommen.")
		);
		await refreshPosts();
	}

	async function deletePost() {
		if (!deleteTarget || deleting) return;
		setDeleting(true);
		setNotice("");
		const response = await fetch("/api/admin/community/posts", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: deleteTarget.id }),
		});
		const result = await response.json();
		setDeleting(false);
		if (!response.ok) return setNotice(result.error || text("The post could not be deleted.", "Beitrag konnte nicht gelöscht werden."));
		setDeleteTarget(null);
		setNotice(text("The post and its image file were permanently deleted.", "Beitrag und zugehörige Bilddatei wurden endgültig gelöscht."));
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
		if (!response.ok) return setNotice(result.error || text("The project could not be created.", "Projekt konnte nicht erstellt werden."));
		setNewProjectOpen(false);
		setNotice(text("Project created as a private draft.", "Projekt als nicht öffentlicher Entwurf angelegt."));
		await refreshProjects();
	}

	if (accessError)
		return (
			<section className="content-band">
				<div className="empty-state">
					<ShieldAlert size={40} />
					<h3>{text("No moderation access", "Kein Moderationszugriff")}</h3>
					<p>{text("Your Discord account is not registered for community management.", "Dein Discord-Konto ist nicht für die Community-Verwaltung hinterlegt.")}</p>
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
			{deleteTarget && (
				<div className="community-delete-backdrop" onMouseDown={() => !deleting && setDeleteTarget(null)}>
					<section
						className="community-delete-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="community-delete-title"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<span className="community-delete-icon">
							<AlertTriangle size={25} />
						</span>
						<div>
							<span className="kicker">{text("Delete permanently", "Endgültig löschen")}</span>
							<h2 id="community-delete-title">
								{text(`Remove “${deleteTarget.title || deleteTarget.authorName}”?`, `„${deleteTarget.title || deleteTarget.authorName}“ entfernen?`)}
							</h2>
							<p>
								{text(
									"The post is removed from moderation and any uploaded image is deleted as well. This cannot be undone.",
									"Der Beitrag wird aus der Moderation entfernt. Ein hochgeladenes Bild wird ebenfalls vollständig gelöscht. Das lässt sich nicht rückgängig machen."
								)}
							</p>
						</div>
						<footer>
							<button className="button button-secondary" type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>
								{text("Cancel", "Abbrechen")}
							</button>
							<button className="button button-danger-soft" type="button" disabled={deleting} onClick={deletePost}>
								<Trash2 size={15} /> {deleting ? text("Deleting...", "Wird gelöscht ...") : text("Delete permanently", "Endgültig löschen")}
							</button>
						</footer>
					</section>
				</div>
			)}
			<header className="admin-community-hero">
				<Link href="/admin/tournaments">
					<ArrowLeft size={15} /> {text("Tournament management", "Zur Turnierverwaltung")}
				</Link>
				<span className="admin-seal">
					<MessageCircleHeart size={28} />
				</span>
				<div>
					<span className="kicker">
						{text("Community management", "Community-Verwaltung")} · {access.role}
					</span>
					<h1>{text("Blossom mail & game worlds", "Blütenpost & Spielwelten")}</h1>
					<p>{text("Review submissions carefully and keep shared servers up to date.", "Beiträge behutsam freigeben und gemeinsame Server aktuell halten.")}</p>
				</div>
			</header>

			<section className="admin-community-workspace">
				<div className="admin-community-tabs">
					<button className={tab === "moderation" ? "active" : ""} onClick={() => setTab("moderation")}>
						<ClipboardCheck size={16} /> {text("Moderation", "Moderation")} <span>{moderation?.counts.pending || 0}</span>
					</button>
					<button className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}>
						<Gamepad2 size={16} /> {text("Community projects", "Community-Projekte")}
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
								<span className="kicker">{text("Moderation queue", "Moderationskorb")}</span>
								<h2>{text("What may appear on the community wall?", "Was darf an die Pinnwand?")}</h2>
							</div>
							<div className="moderation-filters">
								{(["pending", "published", "rejected"] as CommunityPostStatus[]).map((status) => (
									<button className={filter === status ? "active" : ""} key={status} onClick={() => setFilter(status)}>
										{text(
											status === "pending" ? "Pending" : status === "published" ? "Published" : "Rejected",
											status === "pending" ? "Wartet" : status === "published" ? "Freigegeben" : "Abgelehnt"
										)}{" "}
										<span>{moderation?.counts[status] || 0}</span>
									</button>
								))}
							</div>
						</header>
						<div className="community-moderation-list">
							{moderation?.posts.map((post) => (
								<article className="community-moderation-entry" key={post.id}>
									{post.mediaUrl && (
										<div className="moderation-art">
											<Image
												src={post.mediaUrl}
												alt={post.title || text("Fan art awaiting moderation", "Fanart zur Moderation")}
												fill
												sizes="280px"
												unoptimized
											/>
										</div>
									)}
									<div className="moderation-copy">
										<header>
											<span>
												{post.kind === "fanart" ? <Brush size={14} /> : <MessageCircleHeart size={14} />}{" "}
												{post.kind === "fanart" ? text("Fan art", "Fanart") : text("Message", "Gruß")}
											</span>
											<small>
												{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
													new Date(post.createdAt)
												)}
											</small>
										</header>
										<strong>{post.title || post.authorName}</strong>
										{post.title && (
											<small>
												{text("by", "von")} {post.authorName}
											</small>
										)}
										<p>{post.body}</p>
										<label>
											{text("Internal note", "Interne Notiz")}
											<textarea
												value={notes[post.id] ?? post.moderationNote ?? ""}
												onChange={(event) => setNotes((current) => ({ ...current, [post.id]: event.target.value }))}
												placeholder={text("Optional reason or note for the moderation team", "Optionaler Grund oder Hinweis für das Mod-Team")}
											/>
										</label>
										<footer>
											<button className="moderation-delete-button" type="button" onClick={() => setDeleteTarget(post)}>
												<Trash2 size={14} /> {text("Delete", "Löschen")}
											</button>
											<div className="moderation-decision-buttons">
												<button className="button button-secondary button-small" onClick={() => moderate(post.id, "rejected")}>
													<X size={14} /> {text("Reject", "Ablehnen")}
												</button>
												<button className="button button-primary button-small" onClick={() => moderate(post.id, "published")}>
													<Check size={14} /> {text("Publish", "Freigeben")}
												</button>
											</div>
										</footer>
									</div>
								</article>
							))}
							{moderation && moderation.posts.length === 0 && (
								<div className="empty-state">
									<ClipboardCheck size={36} />
									<h3>{text("This queue is empty", "Dieser Korb ist leer")}</h3>
									<p>{text("Nothing is currently waiting for the moderation team.", "Hier wartet gerade nichts auf das Mod-Team.")}</p>
								</div>
							)}
						</div>
					</div>
				)}

				{tab === "projects" && (
					<div className="community-project-admin-area">
						<header>
							<div>
								<span className="kicker">{text("World book", "Weltenbuch")}</span>
								<h2>{text("Manage servers and projects", "Server und Projekte pflegen")}</h2>
								<p>
									{text(
										"Status, rules, and application links appear directly in the public project hub.",
										"Status, Regeln und Bewerbungslinks erscheinen direkt im öffentlichen Projekt-Hub."
									)}
								</p>
							</div>
							<button className="button button-primary" onClick={() => setNewProjectOpen((open) => !open)}>
								{newProjectOpen ? <X size={15} /> : <Plus size={15} />} {newProjectOpen ? text("Cancel", "Abbrechen") : text("Create project", "Projekt anlegen")}
							</button>
						</header>
						{projectData?.usingDefaults && (
							<p className="project-default-note">
								<Flower2 size={14} />{" "}
								{text(
									"The two starter projects are templates. They are copied to MongoDB when first saved.",
									"Die beiden Startprojekte sind Vorlagen. Beim ersten Speichern werden sie in MongoDB übernommen."
								)}
							</p>
						)}
						{newProjectOpen && (
							<form className="new-community-project" onSubmit={createProject}>
								<label>
									{text("Project name", "Projektname")}
									<input name="title" required />
								</label>
								<label>
									{text("Game", "Spiel")}
									<input name="game" required />
								</label>
								<label>
									{text("Short description", "Kurzbeschreibung")}
									<textarea name="summary" required />
								</label>
								<button className="button button-primary" type="submit">
									{text("Create draft", "Entwurf anlegen")}
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
