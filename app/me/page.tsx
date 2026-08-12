"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import useSWR from "swr";
import {
	AlertTriangle,
	Award,
	Bell,
	BellOff,
	Check,
	ClipboardList,
	Copy,
	ExternalLink,
	Flower2,
	Gamepad2,
	Link2Off,
	Loader2,
	LogOut,
	Plus,
	RefreshCw,
	ShieldCheck,
	Target,
	Twitch,
	User,
	UsersRound,
	X,
} from "lucide-react";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type Profile = {
	providers: string[];
	twitchLogin: string | null;
	riotVerified: boolean;
	riotSummonerName: string | null;
	riotTagLine: string | null;
	riotVerificationChallenge: { profileIconId: number; profileIconUrl: string; expiresAt: string } | null;
};
type ConnectionAction = {
	target: "discord" | "twitch" | "riot";
	mode: "disconnect" | "change";
};
type TournamentApplication = {
	id: string;
	tournamentId: string;
	title: string;
	tournamentSlug: string;
	riotId: string;
	status: string;
	registrationOpen: boolean;
	wishGroupMode: "disabled" | "duo" | "team";
	wishGroupLimit: number;
	discordDmOptIn?: boolean;
};
type WishGroup = {
	id: string;
	tournamentId: string;
	name: string;
	inviteCode: string;
	ownerUserId: string;
	members: { userId: string; riotId: string }[];
	isOwner: boolean;
};
type TournamentNotification = { id: string; title: string; body: string; href: string; readAt: string | null; createdAt: string; discordStatus: string };
type TournamentProfileData = { applications: TournamentApplication[]; groups: WishGroup[]; notifications: TournamentNotification[] };
type BadgeGrant = {
	id: string;
	rewardKey: string;
	badge: { id: string; name: string; nameEn?: string; description: string; descriptionEn?: string; icon: string; rarity: "common" | "rare" | "epic" };
};
type BadgeProfileData = { badges: BadgeGrant[]; identityBadges: BadgeGrant[]; showcasedBadgeIds: string[] };

const connectionWarningsDe = {
	discord: {
		title: "Von der Website abmelden?",
		copy: "Du wirst aus deinem Community-Profil abgemeldet. Twitch und Riot bleiben mit deinem Profil verbunden und werden nicht gelöscht.",
		confirm: "Jetzt abmelden",
	},
	twitchDisconnect: {
		title: "Twitch-Verbindung trennen?",
		copy: "Neue Watchtime und Twitch-Challenges werden nicht mehr gezählt. Dein bisheriger Fortschritt bleibt erhalten.",
		confirm: "Twitch trennen",
	},
	twitchChange: {
		title: "Anderes Twitch-Konto verwenden?",
		copy: "Die aktuelle Twitch-Verbindung wird getrennt. Anschließend wirst du direkt zur Anmeldung des neuen Twitch-Kontos weitergeleitet.",
		confirm: "Twitch wechseln",
	},
	riotDisconnect: {
		title: "Riot-ID trennen?",
		copy: "Die Verifizierung wird entfernt und League-Challenges werden pausiert. Dein bisheriger Fortschritt bleibt erhalten.",
		confirm: "Riot-ID trennen",
	},
	riotChange: {
		title: "Andere Riot-ID verwenden?",
		copy: "Die aktuelle Verifizierung wird entfernt. Danach musst du die neue Riot-ID erneut über das vorgegebene Profilbild bestätigen.",
		confirm: "Riot-ID wechseln",
	},
};

const connectionWarningsEn: typeof connectionWarningsDe = {
	discord: {
		title: "Sign out of the website?",
		copy: "You will be signed out of your community profile. Twitch and Riot remain connected to your profile and are not deleted.",
		confirm: "Sign out now",
	},
	twitchDisconnect: {
		title: "Disconnect Twitch?",
		copy: "New watch time and Twitch challenges will no longer be tracked. Your existing progress remains saved.",
		confirm: "Disconnect Twitch",
	},
	twitchChange: {
		title: "Use a different Twitch account?",
		copy: "The current Twitch connection will be removed. You will then be taken directly to sign in with the new Twitch account.",
		confirm: "Change Twitch",
	},
	riotDisconnect: {
		title: "Disconnect Riot ID?",
		copy: "Verification will be removed and League challenges paused. Your existing progress remains saved.",
		confirm: "Disconnect Riot ID",
	},
	riotChange: {
		title: "Use a different Riot ID?",
		copy: "The current verification will be removed. You must then confirm the new Riot ID again using the specified profile icon.",
		confirm: "Change Riot ID",
	},
};

export default function MePage() {
	const { locale, text } = useLocale();
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	const { data: session, status } = useSession();
	const router = useRouter();
	const { data: profile, mutate } = useSWR<Profile>(status === "authenticated" ? "/api/user/profile" : null, fetcher);
	const { data: badgeProfile, mutate: refreshBadges } = useSWR<BadgeProfileData>(status === "authenticated" ? "/api/user/badges" : null, fetcher);
	const { data: tournamentProfile, mutate: refreshTournamentProfile } = useSWR<TournamentProfileData>(status === "authenticated" ? "/api/user/tournaments" : null, fetcher);
	const [riotName, setRiotName] = useState("");
	const [riotTag, setRiotTag] = useState("");
	const [busy, setBusy] = useState<"start" | "confirm" | null>(null);
	const [error, setError] = useState("");
	const [connectionAction, setConnectionAction] = useState<ConnectionAction | null>(null);
	const [connectionBusy, setConnectionBusy] = useState(false);
	const [connectionError, setConnectionError] = useState("");
	const [wishGroupName, setWishGroupName] = useState<Record<string, string>>({});
	const [wishGroupCode, setWishGroupCode] = useState("");
	const [tournamentNotice, setTournamentNotice] = useState("");
	const [tournamentBusy, setTournamentBusy] = useState("");
	const [badgeNotice, setBadgeNotice] = useState("");

	useEffect(() => {
		if (status === "unauthenticated") router.replace("/login");
	}, [status, router]);

	async function verify(action: "start" | "confirm") {
		setBusy(action);
		setError("");
		try {
			const response = await fetch("/api/riot/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(action === "start" ? { action, gameName: riotName, tagLine: riotTag, region: "euw" } : { action }),
			});
			const result = await response.json();
			if (!response.ok || (action === "confirm" && !result.verified)) {
				setError(result.error || text("Riot verification is not complete yet.", "Die Riot-Verifizierung ist noch nicht abgeschlossen."));
			} else {
				await mutate();
			}
		} catch {
			setError(text("The connection could not be established.", "Die Verbindung konnte nicht hergestellt werden."));
		} finally {
			setBusy(null);
		}
	}

	function openConnectionAction(target: ConnectionAction["target"], mode: ConnectionAction["mode"]) {
		setConnectionError("");
		setConnectionAction({ target, mode });
	}

	async function confirmConnectionAction() {
		if (!connectionAction || connectionBusy) return;
		setConnectionBusy(true);
		setConnectionError("");
		try {
			if (connectionAction.target === "discord") {
				await signOut({ callbackUrl: "/" });
				return;
			}
			const response = await fetch("/api/user/connections", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider: connectionAction.target }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || text("The connection could not be removed.", "Die Verbindung konnte nicht getrennt werden."));

			const action = connectionAction;
			await mutate();
			setConnectionAction(null);
			if (action.target === "twitch" && action.mode === "change") {
				await signIn("twitch", { callbackUrl: "/me" });
			}
			if (action.target === "riot") {
				setRiotName("");
				setRiotTag("");
				if (action.mode === "change") {
					window.setTimeout(() => document.getElementById("riot-verification")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
				}
			}
		} catch (actionError) {
			setConnectionError(actionError instanceof Error ? actionError.message : text("The connection could not be removed.", "Die Verbindung konnte nicht getrennt werden."));
		} finally {
			setConnectionBusy(false);
		}
	}

	async function tournamentRequest(path: string, method: string, body?: unknown) {
		setTournamentNotice("");
		const response = await fetch(path, {
			method,
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || text("The change could not be saved.", "Die Änderung konnte nicht gespeichert werden."));
		await refreshTournamentProfile();
		return result;
	}

	async function createWishGroup(tournamentId: string) {
		const name = wishGroupName[tournamentId]?.trim();
		if (!name) return setTournamentNotice(text("Please give your preferred group a name.", "Bitte gib deiner Wunschgruppe einen Namen."));
		setTournamentBusy(`create:${tournamentId}`);
		try {
			await tournamentRequest("/api/user/wish-groups", "POST", { tournamentId, name });
			setWishGroupName((current) => ({ ...current, [tournamentId]: "" }));
			setTournamentNotice(text("Preferred group created. Share the code with your teammates.", "Wunschgruppe erstellt. Teile den Code mit deinen Mitspielern."));
		} catch (requestError) {
			setTournamentNotice(
				requestError instanceof Error ? requestError.message : text("The preferred group could not be created.", "Die Wunschgruppe konnte nicht erstellt werden.")
			);
		} finally {
			setTournamentBusy("");
		}
	}

	async function joinWishGroup(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setTournamentBusy("join");
		try {
			await tournamentRequest("/api/user/wish-groups/join", "POST", { inviteCode: wishGroupCode });
			setWishGroupCode("");
			setTournamentNotice(text("You joined the preferred group.", "Du bist der Wunschgruppe beigetreten."));
		} catch (requestError) {
			setTournamentNotice(requestError instanceof Error ? requestError.message : text("Joining failed.", "Der Beitritt ist fehlgeschlagen."));
		} finally {
			setTournamentBusy("");
		}
	}

	async function leaveWishGroup(groupId: string) {
		setTournamentBusy(`leave:${groupId}`);
		try {
			await tournamentRequest(`/api/user/wish-groups/${groupId}/leave`, "POST");
			setTournamentNotice(text("You left the preferred group.", "Du hast die Wunschgruppe verlassen."));
		} catch (requestError) {
			setTournamentNotice(
				requestError instanceof Error ? requestError.message : text("The preferred group could not be left.", "Die Wunschgruppe konnte nicht verlassen werden.")
			);
		} finally {
			setTournamentBusy("");
		}
	}

	async function setTournamentDms(applicationId: string, discordDmOptIn: boolean) {
		setTournamentBusy(`dm:${applicationId}`);
		try {
			await tournamentRequest("/api/user/tournaments/preferences", "PATCH", { applicationId, discordDmOptIn });
			setTournamentNotice(
				discordDmOptIn
					? text("Discord messages for this tournament are enabled.", "Discord-Nachrichten für dieses Turnier sind aktiviert.")
					: text("Discord messages for this tournament are disabled.", "Discord-Nachrichten für dieses Turnier sind deaktiviert.")
			);
		} catch (requestError) {
			setTournamentNotice(
				requestError instanceof Error ? requestError.message : text("The DM setting could not be changed.", "Die DM-Einstellung konnte nicht geändert werden.")
			);
		} finally {
			setTournamentBusy("");
		}
	}

	async function copyWishGroupCode(code: string) {
		await navigator.clipboard.writeText(code);
		setTournamentNotice(text("Preferred group code copied.", "Wunschgruppen-Code kopiert."));
	}

	function markNotificationRead(notificationId: string) {
		void fetch(`/api/user/notifications/${notificationId}/read`, { method: "POST", keepalive: true }).then(() => refreshTournamentProfile());
	}

	async function toggleShowcaseBadge(badgeId: string) {
		const current = badgeProfile?.showcasedBadgeIds || [];
		const next = current.includes(badgeId) ? current.filter((id) => id !== badgeId) : [...current, badgeId];
		if (next.length > 3) return setBadgeNotice(text("You can showcase up to three badges at a time.", "Du kannst höchstens drei Badges gleichzeitig präsentieren."));
		const response = await fetch("/api/user/badges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ badgeIds: next }) });
		const result = await response.json();
		setBadgeNotice(
			response.ok
				? text("Your badge selection was saved.", "Deine Badge-Auswahl wurde gespeichert.")
				: result.error || text("The selection could not be saved.", "Die Auswahl konnte nicht gespeichert werden.")
		);
		if (response.ok) await refreshBadges();
	}

	if (status === "loading" || !session)
		return (
			<main className="me-page">
				<div className="skeleton profile-skeleton" />
			</main>
		);

	const hasDiscord = profile?.providers.includes("discord");
	const hasTwitch = profile?.providers.includes("twitch");
	const challenge = profile?.riotVerificationChallenge;
	const selectedBadges = (badgeProfile?.showcasedBadgeIds || [])
		.map((badgeId) => badgeProfile?.badges.find((grant) => grant.rewardKey === badgeId)?.badge)
		.filter((badge): badge is BadgeGrant["badge"] => Boolean(badge));
	const showcasedBadges = [...(badgeProfile?.identityBadges || []).map((grant) => grant.badge), ...selectedBadges].filter(
		(badge, index, badges) => badges.findIndex((candidate) => candidate.id === badge.id) === index
	);

	return (
		<main className="me-page">
			<section className="profile-intro">
				<div className="profile-avatar-wrap">
					{session.user?.image ? (
						<Image className="me-avatar" src={session.user.image} alt="" width={92} height={92} />
					) : (
						<span className="me-avatar-placeholder">
							<User size={36} />
						</span>
					)}
					<Flower2 size={20} />
				</div>
				<div>
					<span className="kicker">{text("My cherry blossom pass", "Mein Kirschblütenpass")}</span>
					<h1>{session.user?.name || text("My profile", "Mein Profil")}</h1>
					<p>{session.user?.email}</p>
				</div>
			</section>

			<section className="profile-connections">
				<div className="section-heading">
					<span>{text("Connections", "Verbindungen")}</span>
					<h2>{text("What your profile unlocks", "Was dein Profil freischaltet")}</h2>
					<p>
						{text(
							"Discord remains the main account. Twitch tracks watch time, while Riot tracks League progress.",
							"Discord bleibt das Hauptkonto. Twitch zählt Watchtime, Riot zählt League-Fortschritt."
						)}
					</p>
				</div>
				<div className="connection-grid">
					<article className={`connection-panel ${hasDiscord ? "connected" : ""}`}>
						<span className="discord-panel-mark">
							<DiscordMark size={21} />
						</span>
						<div>
							<h3>Discord</h3>
							<p>{text("Community, applications, and tournament contact.", "Community, Bewerbungen und Turnierkontakt.")}</p>
						</div>
						{hasDiscord ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> {text("Main account", "Hauptkonto")}
								</span>
								<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("discord", "disconnect")}>
									<LogOut size={14} /> {text("Sign out", "Abmelden")}
								</button>
							</div>
						) : (
							<button className="button button-discord" onClick={() => signIn("discord")}>
								<DiscordMark size={14} /> {text("Connect Discord", "Discord verbinden")}
							</button>
						)}
					</article>
					<article className={`connection-panel ${hasTwitch ? "connected" : ""}`}>
						<Twitch size={26} />
						<div>
							<h3>Twitch</h3>
							<p>
								{profile?.twitchLogin ? `@${profile.twitchLogin} · ` : ""}
								{text("Live watch time and stream challenges.", "Live-Watchtime und Stream-Challenges.")}
							</p>
						</div>
						{hasTwitch ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> {text("Connected", "Verbunden")}
								</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "disconnect")}>
										<Link2Off size={14} /> {text("Disconnect", "Trennen")}
									</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "change")}>
										<RefreshCw size={14} /> {text("Change", "Wechseln")}
									</button>
								</div>
							</div>
						) : (
							<button className="button button-twitch" onClick={() => signIn("twitch", { callbackUrl: "/me" })}>
								<Plus size={15} /> {text("Connect", "Verbinden")}
							</button>
						)}
					</article>
					<article className={`connection-panel ${profile?.riotVerified ? "connected" : ""}`}>
						<ShieldCheck size={26} />
						<div>
							<h3>Riot-ID</h3>
							<p>
								{profile?.riotVerified
									? `${profile.riotSummonerName}#${profile.riotTagLine}`
									: text("League challenges and tournament applications.", "League-Challenges und Turnierbewerbungen.")}
							</p>
						</div>
						{profile?.riotVerified && (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> {text("Verified", "Verifiziert")}
								</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "disconnect")}>
										<Link2Off size={14} /> {text("Disconnect", "Trennen")}
									</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "change")}>
										<RefreshCw size={14} /> {text("Change", "Wechseln")}
									</button>
								</div>
							</div>
						)}
					</article>
				</div>
			</section>

			{!profile?.riotVerified && (
				<section className="riot-verification" id="riot-verification">
					<div className="section-heading">
						<span>{text("Riot verification", "Riot-Verifizierung")}</span>
						<h2>{text("A profile icon as quick proof of ownership", "Ein Profilbild als kurzer Besitznachweis")}</h2>
						<p>
							{text(
								"Your password is never needed. You only switch temporarily to a randomly selected Riot profile icon.",
								"Dein Passwort wird nie benötigt. Du wechselst nur vorübergehend auf ein zufällig ausgewähltes Riot-Profilbild."
							)}
						</p>
					</div>
					{error && <p className="form-error">{error}</p>}
					{!challenge ? (
						<div className="riot-start-form">
							<label>
								<span>{text("Riot name", "Riot-Name")}</span>
								<input value={riotName} onChange={(event) => setRiotName(event.target.value)} placeholder="Nachtara" />
							</label>
							<label>
								<span>Tag</span>
								<input value={riotTag} onChange={(event) => setRiotTag(event.target.value)} placeholder="EUW" />
							</label>
							<button className="button button-primary" disabled={busy !== null || !riotName.trim() || !riotTag.trim()} onClick={() => verify("start")}>
								{busy === "start" ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />} {text("Start verification", "Verifizierung starten")}
							</button>
						</div>
					) : (
						<div className="riot-icon-challenge">
							<Image src={challenge.profileIconUrl} alt={`Riot Profilbild ${challenge.profileIconId}`} width={112} height={112} />
							<div>
								<span className="kicker">{text("Your task", "Deine Aufgabe")}</span>
								<h3>{text("Set this image as your Riot profile icon.", "Setze dieses Bild als Riot-Profilbild.")}</h3>
								<p>
									{text(
										"You can change it back immediately afterwards. This task expires at",
										"Danach kannst du es sofort wieder zurückändern. Die Aufgabe läuft bis"
									)}{" "}
									{new Date(challenge.expiresAt).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}
									{locale === "de" ? " Uhr." : "."}
								</p>
								<button className="button button-primary" disabled={busy !== null} onClick={() => verify("confirm")}>
									{busy === "confirm" ? <Loader2 className="spin" size={17} /> : <Check size={17} />} {text("Check profile icon now", "Profilbild jetzt prüfen")}
								</button>
							</div>
						</div>
					)}
				</section>
			)}

			{profile?.riotVerified && (
				<section className="riot-verified-banner">
					<ShieldCheck size={28} />
					<div>
						<span className="kicker">{text("Riot ID verified", "Riot-ID verifiziert")}</span>
						<h2>
							{profile.riotSummonerName}#{profile.riotTagLine}
						</h2>
						<p>{text("League challenges and tournament applications are unlocked.", "League-Challenges und Turnierbewerbungen sind freigeschaltet.")}</p>
					</div>
				</section>
			)}

			<section className="profile-badges">
				<div className="section-heading">
					<span>{text("My blossom marks", "Meine Blütenzeichen")}</span>
					<h2>{text("Badges from your challenges", "Badges aus deinen Challenges")}</h2>
					<p>
						{text(
							"Choose up to three badges for your community pass. Team and owner badges appear automatically before them.",
							"Wähle bis zu drei Badges für deinen Community-Pass. Team- und Owner-Badges erscheinen automatisch davor."
						)}
					</p>
				</div>
				<div className="badge-showcase-preview">
					<div className="badge-preview-avatar">
						{session.user?.image ? <Image src={session.user.image} alt="" width={50} height={50} /> : <User size={22} />}
						{showcasedBadges[0] && <span className={`user-menu-badge ${showcasedBadges[0].rarity}`}>{showcasedBadges[0].icon}</span>}
					</div>
					<div>
						<small>{text("How the community sees you", "So sieht dich die Community")}</small>
						<strong>{session.user?.name || text("Community member", "Community-Mitglied")}</strong>
						<span>{text("Account menu, forum, public profile, and tournament rosters", "Account-Menü, Forum, öffentliches Profil und Turnierkader")}</span>
					</div>
					<div className="badge-preview-list">
						{showcasedBadges.map((badge) => (
							<span
								className={`public-badge labeled ${badge.rarity}`}
								title={locale === "en" ? badge.descriptionEn || badge.description : badge.description}
								key={badge.id}
							>
								<b>{badge.icon}</b> {locale === "en" ? badge.nameEn || badge.name : badge.name}
							</span>
						))}
						{!showcasedBadges.length && <span className="badge-preview-empty">{text("No badge showcased yet", "Noch kein Badge präsentiert")}</span>}
					</div>
				</div>
				{badgeNotice && (
					<p className="profile-tournament-notice">
						<Award size={15} /> {badgeNotice}
					</p>
				)}
				{badgeProfile?.badges.length ? (
					<div className="profile-badge-grid">
						{badgeProfile.badges.map((grant) => {
							const showcaseSlot = badgeProfile.showcasedBadgeIds.indexOf(grant.rewardKey) + 1;
							const selected = showcaseSlot > 0;
							return (
								<button
									type="button"
									className={`profile-badge ${grant.badge.rarity} ${selected ? "selected" : ""}`}
									key={grant.id}
									onClick={() => toggleShowcaseBadge(grant.rewardKey)}
								>
									<span>{grant.badge.icon}</span>
									<div>
										<small>
											{showcaseSlot === 1
												? text("Main badge", "Hauptbadge")
												: showcaseSlot > 1
													? `${text("Showcase", "Schaukasten")} ${showcaseSlot}`
													: grant.badge.rarity === "epic"
														? text("Epic", "Episch")
														: grant.badge.rarity === "rare"
															? text("Rare", "Selten")
															: text("Common", "Gewöhnlich")}
										</small>
										<strong>{locale === "en" ? grant.badge.nameEn || grant.badge.name : grant.badge.name}</strong>
										<p>{locale === "en" ? grant.badge.descriptionEn || grant.badge.description : grant.badge.description}</p>
									</div>
									<span className="badge-select-mark">{selected ? showcaseSlot : <Plus size={14} />}</span>
								</button>
							);
						})}
					</div>
				) : (
					<div className="empty-state compact-empty">
						<Award size={30} />
						<h3>{text("Your first badge is waiting", "Dein erstes Badge wartet")}</h3>
						<p>
							{text("Complete a challenge to unlock your first blossom mark here.", "Schließe eine Challenge ab, um hier dein erstes Blütenzeichen freizuschalten.")}
						</p>
						<Link className="text-link" href="/challenges">
							{text("Open challenges", "Challenges öffnen")}
						</Link>
					</div>
				)}
			</section>

			<section className="profile-tournaments">
				<div className="section-heading">
					<span>{text("My tournaments", "Meine Turniere")}</span>
					<h2>{text("Applications and preferred groups", "Anmeldungen und Wunschgruppen")}</h2>
					<p>
						{text(
							"Everyone applies individually. Preferred groups only tell tournament staff who you would like to play with.",
							"Alle bewerben sich einzeln. Wunschgruppen zeigen der Turnierleitung nur, mit wem du gerne zusammenspielen möchtest."
						)}
					</p>
				</div>
				{tournamentNotice && (
					<p className="profile-tournament-notice">
						<Flower2 size={15} /> {tournamentNotice}
					</p>
				)}
				{(tournamentProfile?.applications || []).length ? (
					<>
						<form className="wish-group-join" onSubmit={joinWishGroup}>
							<div>
								<span className="kicker">{text("Received an invitation?", "Einladung erhalten?")}</span>
								<strong>{text("Enter preferred-group code", "Wunschgruppen-Code eingeben")}</strong>
							</div>
							<input
								value={wishGroupCode}
								onChange={(event) => setWishGroupCode(event.target.value.toUpperCase())}
								placeholder="WG-XXXXXXXX"
								aria-label={text("Preferred-group code", "Wunschgruppen-Code")}
								required
							/>
							<button className="button button-secondary" disabled={tournamentBusy === "join"} type="submit">
								<UsersRound size={15} /> {text("Join", "Beitreten")}
							</button>
						</form>
						<div className="profile-tournament-list">
							{tournamentProfile?.applications.map((application) => {
								const group = tournamentProfile.groups.find((entry) => entry.tournamentId === application.tournamentId);
								return (
									<article className="profile-tournament-sheet" key={application.id}>
										<header>
											<div>
												<span className="kicker">
													{text("Solo application", "Solo-Anmeldung")} · {application.status}
												</span>
												<h3>{application.title}</h3>
												<p>{application.riotId}</p>
											</div>
											<Link className="text-link" href={`/tournaments/${application.tournamentSlug}`}>
												{text("Open tournament", "Turnier öffnen")} <ExternalLink size={13} />
											</Link>
										</header>
										<div className="tournament-dm-setting">
											<span className={application.discordDmOptIn ? "dm-icon enabled" : "dm-icon"}>
												{application.discordDmOptIn ? <Bell size={17} /> : <BellOff size={17} />}
											</span>
											<div>
												<strong>{text("Discord bot messages", "Discord-Bot Nachrichten")}</strong>
												<small>{text("Team assignment and important changes", "Team-Zuteilung und wichtige Änderungen")}</small>
											</div>
											<label className="switch-control">
												<input
													type="checkbox"
													checked={Boolean(application.discordDmOptIn)}
													disabled={tournamentBusy === `dm:${application.id}`}
													onChange={(event) => setTournamentDms(application.id, event.target.checked)}
												/>
												<span />
											</label>
										</div>
										{group ? (
											<div className="wish-group-sheet">
												<div className="wish-group-heading">
													<div>
														<span>
															{text("Preferred group", "Wunschgruppe")} · {group.members.length}/{application.wishGroupLimit}
														</span>
														<h4>{group.name}</h4>
													</div>
													<button
														className="wish-code"
														type="button"
														onClick={() => copyWishGroupCode(group.inviteCode)}
														title={text("Copy code", "Code kopieren")}
													>
														<code>{group.inviteCode}</code>
														<Copy size={14} />
													</button>
												</div>
												<div className="wish-group-members">
													{group.members.map((member) => (
														<span key={member.userId}>
															{member.riotId}
															{member.userId === group.ownerUserId ? ` · ${text("Founder", "Gründer")}` : ""}
														</span>
													))}
												</div>
												<p>
													<AlertTriangle size={14} />{" "}
													{text(
														"Skill differences and fair teams take priority. Tournament staff may therefore split this preferred group.",
														"Skill-Unterschiede und faire Teams haben Vorrang. Die Turnierleitung kann diese Wunschgruppe deshalb aufteilen."
													)}
												</p>
												{application.registrationOpen && (
													<button
														className="text-button danger-text"
														type="button"
														disabled={tournamentBusy === `leave:${group.id}`}
														onClick={() => leaveWishGroup(group.id)}
													>
														{text("Leave preferred group", "Wunschgruppe verlassen")}
													</button>
												)}
											</div>
										) : application.wishGroupMode !== "disabled" && application.registrationOpen ? (
											<div className="wish-group-create">
												<div>
													<strong>{text("Create preferred group", "Wunschgruppe erstellen")}</strong>
													<p>
														{text("Up to", "Bis zu")} {application.wishGroupLimit}{" "}
														{text(
															"people. The preference is non-binding and does not guarantee assignment to the same team.",
															"Personen. Der Wunsch ist unverbindlich und garantiert keine gemeinsame Team-Zuteilung."
														)}
													</p>
												</div>
												<div>
													<input
														value={wishGroupName[application.tournamentId] || ""}
														onChange={(event) => setWishGroupName((current) => ({ ...current, [application.tournamentId]: event.target.value }))}
														placeholder={text("Preferred-group name", "Name der Wunschgruppe")}
													/>
													<button
														className="button button-primary"
														type="button"
														disabled={tournamentBusy === `create:${application.tournamentId}`}
														onClick={() => createWishGroup(application.tournamentId)}
													>
														<Plus size={15} /> {text("Create", "Erstellen")}
													</button>
												</div>
											</div>
										) : (
											<p className="wish-group-locked">
												{text(
													"Preferred groups can be opened and changed once registration is active.",
													"Wunschgruppen können geöffnet und geändert werden, sobald die Anmeldung läuft."
												)}
											</p>
										)}
									</article>
								);
							})}
						</div>
					</>
				) : (
					<div className="empty-state compact-empty">
						<UsersRound size={30} />
						<h3>{text("No tournament application yet", "Noch keine Turnieranmeldung")}</h3>
						<p>
							{text(
								"After your first solo application, you can manage a preferred group here.",
								"Nach deiner ersten Solo-Anmeldung kannst du hier eine Wunschgruppe verwalten."
							)}
						</p>
						<Link className="text-link" href="/tournaments">
							{text("Discover tournaments", "Turniere entdecken")}
						</Link>
					</div>
				)}
				{(tournamentProfile?.notifications || []).length > 0 && (
					<div className="profile-notification-list">
						<span className="kicker">{text("Notifications", "Benachrichtigungen")}</span>
						{tournamentProfile?.notifications.map((notification) => (
							<Link
								href={notification.href}
								key={notification.id}
								className={notification.readAt ? "read" : ""}
								onClick={() => markNotificationRead(notification.id)}
							>
								<Bell size={15} />
								<span>
									<strong>{notification.title}</strong>
									<small>{notification.body}</small>
								</span>
								<time>{new Date(notification.createdAt).toLocaleDateString(intlLocale)}</time>
							</Link>
						))}
					</div>
				)}
			</section>

			<section className="profile-shortcuts">
				<Link href="/challenges">
					<Target size={22} />
					<span>
						<strong>{text("My challenges", "Meine Challenges")}</strong>
						<small>{text("Progress and community goals", "Fortschritt und Community-Ziele")}</small>
					</span>
					<ExternalLink size={16} />
				</Link>
				<Link href="/bewerbungen">
					<ClipboardList size={22} />
					<span>
						<strong>{text("My applications", "Meine Bewerbungen")}</strong>
						<small>{text("Openings and status", "Ausschreibungen und Status")}</small>
					</span>
					<ExternalLink size={16} />
				</Link>
				<Link href="/tournaments">
					<Gamepad2 size={22} />
					<span>
						<strong>{text("Tournament hub", "Turnierhub")}</strong>
						<small>{text("Teams, schedule, and playoffs", "Teams, Spielplan und Playoffs")}</small>
					</span>
					<ExternalLink size={16} />
				</Link>
			</section>

			{connectionAction &&
				(() => {
					const connectionWarnings = locale === "en" ? connectionWarningsEn : connectionWarningsDe;
					const warning =
						connectionAction.target === "discord"
							? connectionWarnings.discord
							: connectionAction.target === "twitch"
								? connectionAction.mode === "change"
									? connectionWarnings.twitchChange
									: connectionWarnings.twitchDisconnect
								: connectionAction.mode === "change"
									? connectionWarnings.riotChange
									: connectionWarnings.riotDisconnect;
					return (
						<div className="connection-warning-backdrop" onMouseDown={() => !connectionBusy && setConnectionAction(null)}>
							<section
								className="connection-warning"
								role="dialog"
								aria-modal="true"
								aria-labelledby="connection-warning-title"
								onMouseDown={(event) => event.stopPropagation()}
							>
								<header>
									<span>
										<AlertTriangle size={20} />
									</span>
									<button
										className="icon-action"
										type="button"
										onClick={() => setConnectionAction(null)}
										disabled={connectionBusy}
										title={text("Close", "Schließen")}
									>
										<X size={18} />
									</button>
								</header>
								<div>
									<span className="kicker">{text("Manage connection", "Verbindung verwalten")}</span>
									<h2 id="connection-warning-title">{warning.title}</h2>
									<p>{warning.copy}</p>
									{connectionError && <p className="form-error">{connectionError}</p>}
								</div>
								<footer>
									<button className="button button-secondary" type="button" onClick={() => setConnectionAction(null)} disabled={connectionBusy}>
										{text("Cancel", "Abbrechen")}
									</button>
									<button className="button button-danger-soft" type="button" onClick={confirmConnectionAction} disabled={connectionBusy}>
										{connectionBusy ? (
											<Loader2 className="spin" size={16} />
										) : connectionAction.mode === "change" ? (
											<RefreshCw size={16} />
										) : (
											<Link2Off size={16} />
										)}
										{warning.confirm}
									</button>
								</footer>
							</section>
						</div>
					);
				})()}
		</main>
	);
}
