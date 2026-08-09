"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { Brush, CheckCircle2, Flower2, Heart, ImagePlus, Loader2, MessageCircleHeart, Send, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type CommunityPost = {
	id: string;
	kind: "message" | "fanart";
	title?: string;
	body: string;
	authorName: string;
	authorImage?: string | null;
	mediaUrl?: string | null;
	publishedAt: string;
};

const filters = [
	{ value: "all", label: "Alles", icon: Sparkles },
	{ value: "message", label: "Liebe Grüße", icon: MessageCircleHeart },
	{ value: "fanart", label: "Fanart", icon: Brush },
] as const;

export default function CommunityPage() {
	const { data: session } = useSession();
	const { data: profile } = useSWR<{ providers: string[] }>(session ? "/api/user/profile" : null, fetcher);
	const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
	const [composeKind, setComposeKind] = useState<"message" | "fanart">("message");
	const [limit, setLimit] = useState(18);
	const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const query = filter === "all" ? "" : `&kind=${filter}`;
	const { data, isLoading, mutate } = useSWR<{ posts: CommunityPost[]; total: number; hasMore: boolean }>(`/api/community/posts?limit=${limit}${query}`, fetcher, {
		refreshInterval: 120_000,
		keepPreviousData: true,
	});
	const hasDiscord = profile?.providers.includes("discord");

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setNotice(null);
		const formData = new FormData(event.currentTarget);
		formData.set("kind", composeKind);
		try {
			const response = await fetch("/api/community/posts", { method: "POST", body: formData });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Dein Beitrag konnte nicht gesendet werden.");
			formRef.current?.reset();
			setNotice({ tone: "success", text: "Dein Beitrag liegt jetzt bei der Moderation und erscheint nach der Freigabe." });
			await mutate();
		} catch (error) {
			setNotice({ tone: "error", text: error instanceof Error ? error.message : "Dein Beitrag konnte nicht gesendet werden." });
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<>
			<PageHero
				kicker="Von der Community für die Community"
				title="Die Kirschblüten-Pinnwand."
				copy="Lass Nachtara einen lieben Gruß da, teile einen Stream-Moment oder häng dein Fanart zwischen die Blüten. Jeder Beitrag wird vor der Veröffentlichung kurz angesehen."
				icon={<MessageCircleHeart size={44} strokeWidth={1.6} />}
				compact
			/>

			<section className="content-band community-wall-layout">
				<aside className="community-compose">
					<header>
						<span className="kicker">Dein Platz an der Wand</span>
						<h2>Etwas Schönes dalassen</h2>
						<p>Persönlich, freundlich und gern ein bisschen verspielt.</p>
					</header>
					{!session ? (
						<div className="community-login-note">
							<span className="discord-panel-mark">
								<DiscordMark size={20} />
							</span>
							<div>
								<strong>Mit Discord schreiben</strong>
								<p>So bleibt dein Beitrag mit deinem Community-Namen verbunden.</p>
							</div>
							<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
								<DiscordMark size={16} /> Mit Discord anmelden
							</button>
						</div>
					) : profile && !hasDiscord ? (
						<div className="community-login-note">
							<ShieldCheck size={22} />
							<div>
								<strong>Discord fehlt noch</strong>
								<p>Verbinde Discord in deinem Profil, bevor du etwas einreichst.</p>
							</div>
							<Link className="button button-secondary" href="/me">
								Zum Profil
							</Link>
						</div>
					) : (
						<form ref={formRef} className="community-compose-form" onSubmit={submit}>
							<div className="community-compose-modes" aria-label="Art des Beitrags">
								<button type="button" className={composeKind === "message" ? "active" : ""} onClick={() => setComposeKind("message")}>
									<Heart size={15} /> Lieber Gruß
								</button>
								<button type="button" className={composeKind === "fanart" ? "active" : ""} onClick={() => setComposeKind("fanart")}>
									<Brush size={15} /> Fanart
								</button>
							</div>
							{composeKind === "fanart" && (
								<label>
									Titel deines Bildes
									<input name="title" maxLength={100} required placeholder="Wie heißt dein Werk?" />
								</label>
							)}
							<label>
								Deine Nachricht
								<textarea
									name="body"
									minLength={3}
									maxLength={1200}
									required
									placeholder={composeKind === "fanart" ? "Erzähl kurz etwas zu deinem Fanart ..." : "Ein lieber Gruß an Nachtara und die Community ..."}
								/>
							</label>
							{composeKind === "fanart" && (
								<label className="community-art-upload">
									<ImagePlus size={21} />
									<span>
										<strong>Bild auswählen</strong>
										<small>PNG, JPG, WEBP oder GIF · maximal 8 MB</small>
									</span>
									<input name="artwork" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
								</label>
							)}
							{notice && (
								<p className={`community-compose-notice ${notice.tone}`}>
									{notice.tone === "success" && <CheckCircle2 size={15} />}
									{notice.text}
								</p>
							)}
							<button className="button button-primary" type="submit" disabled={submitting || !profile}>
								{submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Zur Moderation senden
							</button>
							<small className="community-moderation-copy">
								Mit dem Absenden akzeptierst du die <Link href="/agb">Community-Regeln</Link>. Rechte an deinem Werk bleiben bei dir.
							</small>
						</form>
					)}
				</aside>

				<div className="community-wall">
					<header className="community-wall-head">
						<div>
							<span className="kicker">Freigegebene Beiträge</span>
							<h2>{data ? `${data.total} kleine Gartenmomente` : "Die Pinnwand wird geöffnet"}</h2>
						</div>
						<div className="community-wall-filters">
							{filters.map(({ value, label, icon: Icon }) => (
								<button
									type="button"
									key={value}
									className={filter === value ? "active" : ""}
									onClick={() => {
										setFilter(value);
										setLimit(18);
									}}
								>
									<Icon size={14} /> {label}
								</button>
							))}
						</div>
					</header>

					{isLoading && !data ? (
						<div className="skeleton community-wall-skeleton" />
					) : data?.posts.length ? (
						<div className={`community-post-grid ${filter === "fanart" ? "fanart-only" : ""}`}>
							{data.posts.map((post) => (
								<article className={`community-post ${post.kind}`} key={post.id}>
									{post.mediaUrl && (
										<div className="community-post-art">
											<Image src={post.mediaUrl} alt={post.title || "Fanart aus der Community"} fill sizes="(max-width: 760px) 100vw, 33vw" />
										</div>
									)}
									<div className="community-post-paper">
										<header>
											{post.authorImage ? (
												<Image src={post.authorImage} alt="" width={34} height={34} />
											) : (
												<span>
													<Flower2 size={16} />
												</span>
											)}
											<div>
												<strong>{post.authorName}</strong>
												<small>{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(post.publishedAt))}</small>
											</div>
										</header>
										{post.title && <h3>{post.title}</h3>}
										<p>{post.body}</p>
										<Flower2 className="community-post-flower" size={13} />
									</div>
								</article>
							))}
						</div>
					) : (
						<div className="empty-state">
							<MessageCircleHeart size={38} />
							<h3>Hier ist noch Platz zwischen den Blüten</h3>
							<p>Der erste freigegebene Gruß oder das erste Fanart bekommt einen Ehrenplatz.</p>
						</div>
					)}
					{data?.hasMore && (
						<div className="community-wall-more">
							<span>
								{data.posts.length} von {data.total} sichtbar
							</span>
							<button className="button button-secondary" onClick={() => setLimit((current) => current + 18)}>
								<Flower2 size={14} /> Mehr aufhängen
							</button>
						</div>
					)}
				</div>
			</section>
		</>
	);
}
