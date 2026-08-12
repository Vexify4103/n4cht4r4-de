"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { Brush, CheckCircle2, Clock3, EyeOff, Flower2, Heart, ImagePlus, Loader2, MessageCircleHeart, Send, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import type { PublicBadge } from "@/lib/public-badges";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type CommunityPost = {
	id: string;
	kind: "message" | "fanart";
	title?: string;
	body: string;
	authorName: string;
	authorImage?: string | null;
	authorId?: string;
	profileHref?: string | null;
	badges?: PublicBadge[];
	mediaUrl?: string | null;
	status: "pending" | "published" | "rejected";
	createdAt: string;
	publishedAt: string | null;
};

const filters = [
	{ value: "all", en: "Everything", de: "Alles", icon: Sparkles },
	{ value: "message", en: "Kind messages", de: "Liebe Grüße", icon: MessageCircleHeart },
	{ value: "fanart", en: "Fan art", de: "Fanart", icon: Brush },
] as const;

export default function CommunityPage() {
	const { locale, text } = useLocale();
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
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
	const { data: ownData, mutate: mutateOwn } = useSWR<{ posts: CommunityPost[] }>(session ? "/api/community/posts?mine=1&limit=12" : null, fetcher, {
		refreshInterval: 60_000,
		revalidateOnFocus: true,
	});
	const hasDiscord = profile?.providers.includes("discord");
	const unpublishedPosts = ownData?.posts.filter((post) => post.status !== "published") || [];

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setNotice(null);
		const formData = new FormData(event.currentTarget);
		formData.set("kind", composeKind);
		try {
			const response = await fetch("/api/community/posts", { method: "POST", body: formData });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || text("Your submission could not be sent.", "Dein Beitrag konnte nicht gesendet werden."));
			formRef.current?.reset();
			setNotice({
				tone: "success",
				text:
					composeKind === "fanart"
						? text(
								"Image uploaded, but not published yet. You can see it above under your submissions.",
								"Bild hochgeladen, aber noch nicht veröffentlicht. Du kannst es oben unter deinen Einreichungen sehen."
							)
						: text(
								"Submission saved, but not published yet. You can see it above under your submissions.",
								"Beitrag gespeichert, aber noch nicht veröffentlicht. Du kannst ihn oben unter deinen Einreichungen sehen."
							),
			});
			await Promise.all([mutate(), mutateOwn()]);
		} catch (error) {
			setNotice({ tone: "error", text: error instanceof Error ? error.message : text("Your submission could not be sent.", "Dein Beitrag konnte nicht gesendet werden.") });
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<>
			<PageHero
				kicker={text("From the community, for the community", "Von der Community für die Community")}
				title={text("The cherry blossom community wall.", "Die Kirschblüten-Pinnwand.")}
				copy={text(
					"Leave Nachtara a kind message, share a stream moment, or hang your fan art among the blossoms. Every submission is reviewed before publication.",
					"Lass Nachtara einen lieben Gruß da, teile einen Stream-Moment oder häng dein Fanart zwischen die Blüten. Jeder Beitrag wird vor der Veröffentlichung kurz angesehen."
				)}
				icon={<MessageCircleHeart size={44} strokeWidth={1.6} />}
				compact
			/>

			<section className="content-band community-wall-layout">
				{unpublishedPosts.length > 0 && (
					<section className="community-own-submissions" aria-labelledby="own-community-submissions">
						<header>
							<div>
								<span className="kicker">{text("Visible only to you", "Nur für dich sichtbar")}</span>
								<h2 id="own-community-submissions">{text("Your unpublished submissions", "Deine noch nicht veröffentlichten Einreichungen")}</h2>
							</div>
							<p>
								{text(
									"Your upload arrived. Nachtara or her team will review it before it appears on the public wall.",
									"Der Upload ist angekommen. Nachtara oder ihr Team schaut kurz darüber, bevor er an der öffentlichen Pinnwand erscheint."
								)}
							</p>
						</header>
						<div className="community-own-grid">
							{unpublishedPosts.map((post) => (
								<article className={`community-own-entry ${post.status}`} key={post.id}>
									{post.mediaUrl ? (
										<div className="community-own-art">
											<Image
												src={post.mediaUrl}
												alt={post.title || text("Your uploaded fan art", "Dein hochgeladenes Fanart")}
												fill
												sizes="160px"
												unoptimized
											/>
										</div>
									) : (
										<span className="community-own-message">
											<MessageCircleHeart size={24} />
										</span>
									)}
									<div>
										<span className="community-own-status">
											{post.status === "pending" ? <Clock3 size={13} /> : <EyeOff size={13} />}
											{post.status === "pending"
												? text("Uploaded, not published yet", "Hochgeladen, noch nicht veröffentlicht")
												: text("Not published", "Nicht veröffentlicht")}
										</span>
										<strong>{post.title || text("Kind message", "Lieber Gruß")}</strong>
										<small>{new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.createdAt))}</small>
									</div>
								</article>
							))}
						</div>
					</section>
				)}
				<aside className="community-compose">
					<header>
						<span className="kicker">{text("Your place on the wall", "Dein Platz an der Wand")}</span>
						<h2>{text("Leave something lovely", "Etwas Schönes dalassen")}</h2>
						<p>{text("Personal, kind, and as playful as you like.", "Persönlich, freundlich und gern ein bisschen verspielt.")}</p>
					</header>
					{!session ? (
						<div className="community-login-note">
							<span className="discord-panel-mark">
								<DiscordMark size={20} />
							</span>
							<div>
								<strong>{text("Write with Discord", "Mit Discord schreiben")}</strong>
								<p>{text("This keeps your submission connected to your community name.", "So bleibt dein Beitrag mit deinem Community-Namen verbunden.")}</p>
							</div>
							<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
								<DiscordMark size={16} /> {text("Sign in with Discord", "Mit Discord anmelden")}
							</button>
						</div>
					) : profile && !hasDiscord ? (
						<div className="community-login-note">
							<ShieldCheck size={22} />
							<div>
								<strong>{text("Discord is still missing", "Discord fehlt noch")}</strong>
								<p>{text("Connect Discord in your profile before submitting anything.", "Verbinde Discord in deinem Profil, bevor du etwas einreichst.")}</p>
							</div>
							<Link className="button button-secondary" href="/me">
								{text("Profile", "Zum Profil")}
							</Link>
						</div>
					) : (
						<form ref={formRef} className="community-compose-form" onSubmit={submit}>
							<div className="community-compose-modes" aria-label={text("Submission type", "Art des Beitrags")}>
								<button type="button" className={composeKind === "message" ? "active" : ""} onClick={() => setComposeKind("message")}>
									<Heart size={15} /> {text("Kind message", "Lieber Gruß")}
								</button>
								<button type="button" className={composeKind === "fanart" ? "active" : ""} onClick={() => setComposeKind("fanart")}>
									<Brush size={15} /> Fanart
								</button>
							</div>
							{composeKind === "fanart" && (
								<label>
									{text("Title of your artwork", "Titel deines Bildes")}
									<input name="title" maxLength={100} required placeholder={text("What is your work called?", "Wie heißt dein Werk?")} />
								</label>
							)}
							<label>
								{text("Your message", "Deine Nachricht")}
								<textarea
									name="body"
									minLength={3}
									maxLength={1200}
									required
									placeholder={
										composeKind === "fanart"
											? text("Tell us a little about your fan art...", "Erzähl kurz etwas zu deinem Fanart ...")
											: text("A kind message for Nachtara and the community...", "Ein lieber Gruß an Nachtara und die Community ...")
									}
								/>
							</label>
							{composeKind === "fanart" && (
								<label className="community-art-upload">
									<ImagePlus size={21} />
									<span>
										<strong>{text("Choose image", "Bild auswählen")}</strong>
										<small>{text("PNG, JPG, WEBP, or GIF · maximum 8 MB", "PNG, JPG, WEBP oder GIF · maximal 8 MB")}</small>
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
								{submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />} {text("Send for review", "Zur Moderation senden")}
							</button>
							<small className="community-moderation-copy">
								{text("By submitting, you accept the", "Mit dem Absenden akzeptierst du die")}{" "}
								<Link href="/agb">{text("community rules", "Community-Regeln")}</Link>.{" "}
								{text("You retain the rights to your work.", "Rechte an deinem Werk bleiben bei dir.")}
							</small>
						</form>
					)}
				</aside>

				<div className="community-wall">
					<header className="community-wall-head">
						<div>
							<span className="kicker">{text("Approved submissions", "Freigegebene Beiträge")}</span>
							<h2>
								{data ? `${data.total} ${text("little garden moments", "kleine Gartenmomente")}` : text("Opening the community wall", "Die Pinnwand wird geöffnet")}
							</h2>
						</div>
						<div className="community-wall-filters">
							{filters.map(({ value, en, de, icon: Icon }) => (
								<button
									type="button"
									key={value}
									className={filter === value ? "active" : ""}
									onClick={() => {
										setFilter(value);
										setLimit(18);
									}}
								>
									<Icon size={14} /> {text(en, de)}
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
											<Image
												src={post.mediaUrl}
												alt={post.title || text("Fan art from the community", "Fanart aus der Community")}
												fill
												sizes="(max-width: 760px) 100vw, 33vw"
											/>
										</div>
									)}
									<div className="community-post-paper">
										<header>
											<Link className="community-post-identity" href={post.profileHref || "/community"}>
												{post.authorImage ? (
													<Image src={post.authorImage} alt="" width={34} height={34} />
												) : (
													<span>
														<Flower2 size={16} />
													</span>
												)}
												<div>
													<strong>{post.authorName}</strong>
													<small>
														{new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(post.publishedAt || post.createdAt))}
													</small>
												</div>
											</Link>
											{Boolean(post.badges?.length) && (
												<span className="community-post-badges" aria-label={text("Showcased community badges", "Präsentierte Community-Badges")}>
													{post.badges?.map((badge) => (
														<span
															className={`public-badge ${badge.rarity}`}
															title={`${locale === "en" ? badge.nameEn || badge.name : badge.name}: ${locale === "en" ? badge.descriptionEn || badge.description : badge.description}`}
															key={badge.id}
														>
															{badge.icon}
														</span>
													))}
												</span>
											)}
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
							<h3>{text("There is still room among the blossoms", "Hier ist noch Platz zwischen den Blüten")}</h3>
							<p>
								{text(
									"The first approved message or piece of fan art will receive a place of honour.",
									"Der erste freigegebene Gruß oder das erste Fanart bekommt einen Ehrenplatz."
								)}
							</p>
						</div>
					)}
					{data?.hasMore && (
						<div className="community-wall-more">
							<span>
								{data.posts.length} {text("of", "von")} {data.total} {text("visible", "sichtbar")}
							</span>
							<button className="button button-secondary" onClick={() => setLimit((current) => current + 18)}>
								<Flower2 size={14} /> {text("Hang up more", "Mehr aufhängen")}
							</button>
						</div>
					)}
				</div>
			</section>
		</>
	);
}
