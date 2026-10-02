"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Check, Flower2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { ApplicationDefinition, ApplicationType } from "@/lib/applications";
import { newsCategories, type NewsItem } from "@/lib/news";

async function fetcher(url: string) {
	const response = await fetch(url);
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || "Fehler beim Laden.");
	return data;
}
type Application = { id: string; type: ApplicationType; discord: string; role: string; reason: string; experience: string; status: string; createdAt: string; reviewNote?: string };

function ApplicationReview({ application, refresh }: { application: Application; refresh: () => Promise<unknown> }) {
	const { locale, text } = useLocale();
	const [note, setNote] = useState(application.reviewNote || "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	async function review(status: string) {
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/admin/applications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: application.id, status, reviewNote: note }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error);
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : text("Could not save.", "Speichern fehlgeschlagen."));
		} finally {
			setBusy(false);
		}
	}
	return (
		<article className="content-review">
			<header>
				<div>
					<span className="kicker">
						{application.type === "appeal" ? text("Ban appeal", "Entbannungsantrag") : application.type} · {application.role}
					</span>
					<h3>{application.discord}</h3>
				</div>
				<span>
					{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium" }).format(new Date(application.createdAt))} ·{" "}
					{application.status === "pending"
						? text("Pending", "In Prüfung")
						: application.status === "accepted"
							? text("Accepted", "Angenommen")
							: text("Declined", "Abgelehnt")}
				</span>
			</header>
			<p>{application.reason}</p>
			{application.experience && <p className="muted-note">{application.experience}</p>}
			<label>
				{text("Reply / decision reason (visible to the applicant)", "Rückmeldung / Begründung (für die Person sichtbar)")}
				<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} />
			</label>
			{application.type === "appeal" && (
				<p className="muted-note">
					{text(
						"An accepted appeal does not automatically lift a ban. Apply the decision on Discord or the affected platform.",
						"Ein angenommener Antrag hebt den Bann nicht automatisch auf. Setze die Entscheidung auf Discord oder der betroffenen Plattform um."
					)}
				</p>
			)}
			<div className="dialog-actions">
				<button type="button" className="button button-primary" disabled={busy} onClick={() => review("accepted")}>
					<Check size={16} />
					{text("Accept", "Annehmen")}
				</button>
				<button type="button" className="button button-secondary" disabled={busy} onClick={() => review("rejected")}>
					<X size={16} />
					{text("Decline", "Ablehnen")}
				</button>
				<button type="button" className="text-link" disabled={busy} onClick={() => review("pending")}>
					{text("Reopen", "Erneut prüfen")}
				</button>
			</div>
			{error && (
				<p role="alert" className="form-error">
					{error}
				</p>
			)}
		</article>
	);
}

export default function ContentAdminPage() {
	const { text } = useLocale();
	const { data: access, error: accessError } = useSWR<{ role: string }>("/api/admin/access", fetcher);
	const allowed = access?.role === "owner" || access?.role === "tournament_admin";
	const { data: newsData, error: newsError, mutate: refreshNews } = useSWR<{ news: NewsItem[] }>(allowed ? "/api/admin/news" : null, fetcher);
	const {
		data: applicationData,
		error: applicationError,
		mutate: refreshApplications,
	} = useSWR<{ definitions: Record<ApplicationType, ApplicationDefinition>; applications: Application[] }>(allowed ? "/api/admin/applications" : null, fetcher);
	const [tab, setTab] = useState<"news" | "applications">("news");
	const [editing, setEditing] = useState<NewsItem | "new" | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	const [filter, setFilter] = useState("pending");
	const item = editing && editing !== "new" ? editing : null;

	async function request(url: string, method: string, body: unknown) {
		const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error);
	}
	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice("");
		const form = new FormData(event.currentTarget);
		try {
			await request("/api/admin/news", item ? "PATCH" : "POST", {
				...Object.fromEntries(form),
				id: item?.id,
				published: form.get("published") === "on",
				pinned: form.get("pinned") === "on",
			});
			await refreshNews();
			setEditing(null);
			setNotice(text("News saved.", "News gespeichert."));
		} catch (e) {
			setNotice(e instanceof Error ? e.message : text("Could not save.", "Speichern fehlgeschlagen."));
		} finally {
			setBusy(false);
		}
	}
	async function remove(id: string) {
		setBusy(true);
		try {
			await request("/api/admin/news", "DELETE", { id });
			await refreshNews();
			setDeleting(null);
		} catch (e) {
			setNotice(e instanceof Error ? e.message : text("Could not delete.", "Löschen fehlgeschlagen."));
		} finally {
			setBusy(false);
		}
	}
	async function toggle(type: string, open: boolean) {
		setBusy(true);
		try {
			await request("/api/admin/applications", "PATCH", { action: "settings", type, open });
			await refreshApplications();
		} catch (e) {
			setNotice(e instanceof Error ? e.message : text("Could not save.", "Speichern fehlgeschlagen."));
		} finally {
			setBusy(false);
		}
	}
	if (accessError || (access && !allowed))
		return (
			<section className="content-band">
				<h1>{text("No access", "Kein Zugriff")}</h1>
			</section>
		);
	if (!access)
		return (
			<section className="content-band">
				<div className="skeleton form-skeleton" />
			</section>
		);
	return (
		<div className="admin-sanctuary content-admin">
			<header className="section-heading">
				<span className="kicker">
					<Flower2 size={17} /> {text("Nachtara's desk", "Nachtaras Schreibtisch")}
				</span>
				<h1>{text("News & applications", "News & Bewerbungen")}</h1>
				<Link className="text-link" href="/admin/tournaments">
					<ArrowLeft size={16} /> {text("Back to admin", "Zurück zur Verwaltung")}
				</Link>
			</header>
			<div className="content-tabs" role="tablist" aria-label={text("Content administration", "Inhalte verwalten")}>
				<button role="tab" aria-selected={tab === "news"} aria-controls="news-panel" id="news-tab" onClick={() => setTab("news")}>
					News
				</button>
				<button role="tab" aria-selected={tab === "applications"} aria-controls="applications-panel" id="applications-tab" onClick={() => setTab("applications")}>
					{text("Applications & appeals", "Bewerbungen & Anträge")}
				</button>
			</div>
			{notice && <p role="status">{notice}</p>}
			{(newsError || applicationError) && (
				<p role="alert" className="form-error">
					{text("Could not load the data. Please reload.", "Daten konnten nicht geladen werden. Bitte neu laden.")}
				</p>
			)}
			{tab === "news" ? (
				<section id="news-panel" role="tabpanel" aria-labelledby="news-tab">
					<button className="button button-primary" type="button" onClick={() => setEditing("new")}>
						<Plus size={17} />
						{text("Write news", "News schreiben")}
					</button>
					{editing && (
						<form key={item?.id || "new"} className="app-form news-editor" onSubmit={save}>
							<h2>{item ? text("Edit news", "News bearbeiten") : text("A new announcement", "Eine neue Nachricht")}</h2>
							<label>
								{text("Category", "Kategorie")}
								<select name="category" defaultValue={item?.category || "community"}>
									{newsCategories.map((category) => (
										<option key={category} value={category}>
											{category}
										</option>
									))}
								</select>
							</label>
							<label>
								{text("Title (German) *", "Titel (Deutsch) *")}
								<input name="title" required maxLength={120} defaultValue={item?.title} />
							</label>
							<label>
								{text("Text (German) *", "Text (Deutsch) *")}
								<textarea name="body" required maxLength={1500} defaultValue={item?.body} />
							</label>
							<label>
								{text("Title (English, optional)", "Titel (Englisch, optional)")}
								<input name="titleEn" maxLength={120} defaultValue={item?.titleEn} />
							</label>
							<label>
								{text("Text (English, optional)", "Text (Englisch, optional)")}
								<textarea name="bodyEn" maxLength={1500} defaultValue={item?.bodyEn} />
							</label>
							<label>
								{text("Link (optional)", "Link (optional)")}
								<input name="href" maxLength={500} defaultValue={item?.href} placeholder="https://…" />
							</label>
							<label className="form-checkbox">
								<input type="checkbox" name="published" defaultChecked={item?.published || false} />
								{text("Published", "Veröffentlicht")}
							</label>
							<label className="form-checkbox">
								<input type="checkbox" name="pinned" defaultChecked={item?.pinned || false} />
								{text("Pin at the top", "Oben anheften")}
							</label>
							<div className="dialog-actions">
								<button className="button button-primary" disabled={busy}>
									<Save size={16} />
									{text("Save", "Speichern")}
								</button>
								<button className="button button-secondary" type="button" onClick={() => setEditing(null)}>
									{text("Cancel", "Abbrechen")}
								</button>
							</div>
						</form>
					)}
					<div className="content-review-list">
						{newsData?.news.map((news) => (
							<article className="content-review" key={news.id}>
								<span className="kicker">
									{news.category} · {news.published ? text("Published", "Veröffentlicht") : text("Draft", "Entwurf")}
									{news.pinned ? " · 📌" : ""}
								</span>
								<h3>{news.title}</h3>
								<p>{news.body}</p>
								<div className="dialog-actions">
									<button
										className="icon-action"
										type="button"
										title={text("Edit", "Bearbeiten")}
										aria-label={text("Edit", "Bearbeiten")}
										onClick={() => setEditing(news)}
									>
										<Pencil size={17} />
									</button>
									<button
										className="icon-action"
										type="button"
										title={text("Delete", "Löschen")}
										aria-label={text("Delete", "Löschen")}
										onClick={() => setDeleting(news.id)}
									>
										<Trash2 size={17} />
									</button>
									{deleting === news.id && (
										<>
											<span>{text("Delete this announcement?", "Diese News löschen?")}</span>
											<button type="button" className="button button-secondary" disabled={busy} onClick={() => remove(news.id)}>
												{text("Delete", "Löschen")}
											</button>
											<button type="button" className="text-link" onClick={() => setDeleting(null)}>
												{text("Cancel", "Abbrechen")}
											</button>
										</>
									)}
								</div>
							</article>
						))}
					</div>
				</section>
			) : (
				<section id="applications-panel" role="tabpanel" aria-labelledby="applications-tab">
					<h2>{text("Application phases", "Bewerbungsphasen")}</h2>
					<div className="application-phase-list">
						{applicationData &&
							Object.entries(applicationData.definitions)
								.filter(([type]) => type !== "tournaments")
								.map(([type, definition]) => (
									<label key={type}>
										<span>{definition.label}</span>
										<input type="checkbox" checked={definition.open} disabled={busy} onChange={(e) => toggle(type, e.target.checked)} />
										<span>{definition.open ? text("Open", "Offen") : text("Closed", "Geschlossen")}</span>
									</label>
								))}
					</div>
					<label className="content-filter">
						{text("Show", "Anzeigen")}
						<select value={filter} onChange={(e) => setFilter(e.target.value)}>
							<option value="pending">{text("Pending", "In Prüfung")}</option>
							<option value="accepted">{text("Accepted", "Angenommen")}</option>
							<option value="rejected">{text("Declined", "Abgelehnt")}</option>
							<option value="all">{text("All", "Alle")}</option>
						</select>
					</label>
					<div className="content-review-list">
						{applicationData?.applications
							.filter((a) => filter === "all" || a.status === filter)
							.map((application) => (
								<ApplicationReview key={application.id} application={application} refresh={refreshApplications} />
							))}
						{applicationData && !applicationData.applications.some((a) => filter === "all" || a.status === filter) && (
							<p>{text("No submissions here yet.", "Hier gibt es noch keine Anträge.")}</p>
						)}
					</div>
				</section>
			)}
		</div>
	);
}
