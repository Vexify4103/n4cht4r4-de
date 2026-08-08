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
type BadgeGrant = { id: string; rewardKey: string; badge: { id: string; name: string; description: string; icon: string; rarity: "common" | "rare" | "epic" } };
type BadgeProfileData = { badges: BadgeGrant[]; showcasedBadgeIds: string[] };

const connectionWarnings = {
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

export default function MePage() {
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
				setError(result.error || "Die Riot-Verifizierung ist noch nicht abgeschlossen.");
			} else {
				await mutate();
			}
		} catch {
			setError("Die Verbindung konnte nicht hergestellt werden.");
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
			if (!response.ok) throw new Error(result.error || "Die Verbindung konnte nicht getrennt werden.");

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
			setConnectionError(actionError instanceof Error ? actionError.message : "Die Verbindung konnte nicht getrennt werden.");
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
		if (!response.ok) throw new Error(result.error || "Die Änderung konnte nicht gespeichert werden.");
		await refreshTournamentProfile();
		return result;
	}

	async function createWishGroup(tournamentId: string) {
		const name = wishGroupName[tournamentId]?.trim();
		if (!name) return setTournamentNotice("Bitte gib deiner Wunschgruppe einen Namen.");
		setTournamentBusy(`create:${tournamentId}`);
		try {
			await tournamentRequest("/api/user/wish-groups", "POST", { tournamentId, name });
			setWishGroupName((current) => ({ ...current, [tournamentId]: "" }));
			setTournamentNotice("Wunschgruppe erstellt. Teile den Code mit deinen Mitspielern.");
		} catch (requestError) {
			setTournamentNotice(requestError instanceof Error ? requestError.message : "Die Wunschgruppe konnte nicht erstellt werden.");
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
			setTournamentNotice("Du bist der Wunschgruppe beigetreten.");
		} catch (requestError) {
			setTournamentNotice(requestError instanceof Error ? requestError.message : "Der Beitritt ist fehlgeschlagen.");
		} finally {
			setTournamentBusy("");
		}
	}

	async function leaveWishGroup(groupId: string) {
		setTournamentBusy(`leave:${groupId}`);
		try {
			await tournamentRequest(`/api/user/wish-groups/${groupId}/leave`, "POST");
			setTournamentNotice("Du hast die Wunschgruppe verlassen.");
		} catch (requestError) {
			setTournamentNotice(requestError instanceof Error ? requestError.message : "Die Wunschgruppe konnte nicht verlassen werden.");
		} finally {
			setTournamentBusy("");
		}
	}

	async function setTournamentDms(applicationId: string, discordDmOptIn: boolean) {
		setTournamentBusy(`dm:${applicationId}`);
		try {
			await tournamentRequest("/api/user/tournaments/preferences", "PATCH", { applicationId, discordDmOptIn });
			setTournamentNotice(discordDmOptIn ? "Discord-Nachrichten für dieses Turnier sind aktiviert." : "Discord-Nachrichten für dieses Turnier sind deaktiviert.");
		} catch (requestError) {
			setTournamentNotice(requestError instanceof Error ? requestError.message : "Die DM-Einstellung konnte nicht geändert werden.");
		} finally {
			setTournamentBusy("");
		}
	}

	async function copyWishGroupCode(code: string) {
		await navigator.clipboard.writeText(code);
		setTournamentNotice("Wunschgruppen-Code kopiert.");
	}

	function markNotificationRead(notificationId: string) {
		void fetch(`/api/user/notifications/${notificationId}/read`, { method: "POST", keepalive: true }).then(() => refreshTournamentProfile());
	}

	async function toggleShowcaseBadge(badgeId: string) {
		const current = badgeProfile?.showcasedBadgeIds || [];
		const next = current.includes(badgeId) ? current.filter((id) => id !== badgeId) : [...current, badgeId];
		if (next.length > 3) return setBadgeNotice("Du kannst höchstens drei Badges gleichzeitig präsentieren.");
		const response = await fetch("/api/user/badges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ badgeIds: next }) });
		const result = await response.json();
		setBadgeNotice(response.ok ? "Deine Badge-Auswahl wurde gespeichert." : result.error || "Die Auswahl konnte nicht gespeichert werden.");
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
	const showcasedBadges = (badgeProfile?.showcasedBadgeIds || [])
		.map((badgeId) => badgeProfile?.badges.find((grant) => grant.rewardKey === badgeId)?.badge)
		.filter((badge): badge is BadgeGrant["badge"] => Boolean(badge));

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
					<span className="kicker">Mein Kirschblütenpass</span>
					<h1>{session.user?.name || "Mein Profil"}</h1>
					<p>{session.user?.email}</p>
				</div>
			</section>

			<section className="profile-connections">
				<div className="section-heading">
					<span>Verbindungen</span>
					<h2>Was dein Profil freischaltet</h2>
					<p>Discord bleibt das Hauptkonto. Twitch zählt Watchtime, Riot zählt League-Fortschritt.</p>
				</div>
				<div className="connection-grid">
					<article className={`connection-panel ${hasDiscord ? "connected" : ""}`}>
						<span className="discord-panel-mark">
							<DiscordMark size={21} />
						</span>
						<div>
							<h3>Discord</h3>
							<p>Community, Bewerbungen und Turnierkontakt.</p>
						</div>
						{hasDiscord ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> Hauptkonto
								</span>
								<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("discord", "disconnect")}>
									<LogOut size={14} /> Abmelden
								</button>
							</div>
						) : (
							<button className="button button-discord" onClick={() => signIn("discord")}>
								<DiscordMark size={14} /> Discord verbinden
							</button>
						)}
					</article>
					<article className={`connection-panel ${hasTwitch ? "connected" : ""}`}>
						<Twitch size={26} />
						<div>
							<h3>Twitch</h3>
							<p>{profile?.twitchLogin ? `@${profile.twitchLogin} · ` : ""}Live-Watchtime und Stream-Challenges.</p>
						</div>
						{hasTwitch ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> Verbunden
								</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "disconnect")}>
										<Link2Off size={14} /> Trennen
									</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "change")}>
										<RefreshCw size={14} /> Wechseln
									</button>
								</div>
							</div>
						) : (
							<button className="button button-twitch" onClick={() => signIn("twitch", { callbackUrl: "/me" })}>
								<Plus size={15} /> Verbinden
							</button>
						)}
					</article>
					<article className={`connection-panel ${profile?.riotVerified ? "connected" : ""}`}>
						<ShieldCheck size={26} />
						<div>
							<h3>Riot-ID</h3>
							<p>{profile?.riotVerified ? `${profile.riotSummonerName}#${profile.riotTagLine}` : "League-Challenges und Turnierbewerbungen."}</p>
						</div>
						{profile?.riotVerified && (
							<div className="connection-panel-actions">
								<span className="connection-badge connected">
									<Check size={13} /> Verifiziert
								</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "disconnect")}>
										<Link2Off size={14} /> Trennen
									</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "change")}>
										<RefreshCw size={14} /> Wechseln
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
						<span>Riot-Verifizierung</span>
						<h2>Ein Profilbild als kurzer Besitznachweis</h2>
						<p>Dein Passwort wird nie benötigt. Du wechselst nur vorübergehend auf ein zufällig ausgewähltes Riot-Profilbild.</p>
					</div>
					{error && <p className="form-error">{error}</p>}
					{!challenge ? (
						<div className="riot-start-form">
							<label>
								<span>Riot-Name</span>
								<input value={riotName} onChange={(event) => setRiotName(event.target.value)} placeholder="Nachtara" />
							</label>
							<label>
								<span>Tag</span>
								<input value={riotTag} onChange={(event) => setRiotTag(event.target.value)} placeholder="EUW" />
							</label>
							<button className="button button-primary" disabled={busy !== null || !riotName.trim() || !riotTag.trim()} onClick={() => verify("start")}>
								{busy === "start" ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />} Verifizierung starten
							</button>
						</div>
					) : (
						<div className="riot-icon-challenge">
							<Image src={challenge.profileIconUrl} alt={`Riot Profilbild ${challenge.profileIconId}`} width={112} height={112} />
							<div>
								<span className="kicker">Deine Aufgabe</span>
								<h3>Setze dieses Bild als Riot-Profilbild.</h3>
								<p>
									Danach kannst du es sofort wieder zurückändern. Die Aufgabe läuft bis{" "}
									{new Date(challenge.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.
								</p>
								<button className="button button-primary" disabled={busy !== null} onClick={() => verify("confirm")}>
									{busy === "confirm" ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Profilbild jetzt prüfen
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
						<span className="kicker">Riot-ID verifiziert</span>
						<h2>
							{profile.riotSummonerName}#{profile.riotTagLine}
						</h2>
						<p>League-Challenges und Turnierbewerbungen sind freigeschaltet.</p>
					</div>
				</section>
			)}

			<section className="profile-badges">
				<div className="section-heading">
					<span>Meine Blütenzeichen</span>
					<h2>Badges aus deinen Challenges</h2>
					<p>Wähle bis zu drei Badges für deinen Community-Pass. Der erste ausgewählte Badge ist dein Zeichen am Accountbild.</p>
				</div>
				<div className="badge-showcase-preview">
					<div className="badge-preview-avatar">
						{session.user?.image ? <Image src={session.user.image} alt="" width={50} height={50} /> : <User size={22} />}
						{showcasedBadges[0] && <span className={`user-menu-badge ${showcasedBadges[0].rarity}`}>{showcasedBadges[0].icon}</span>}
					</div>
					<div>
						<small>So sieht dich die Community</small>
						<strong>{session.user?.name || "Community-Mitglied"}</strong>
						<span>Account-Menü und veröffentlichte Turnierkader</span>
					</div>
					<div className="badge-preview-list">
						{showcasedBadges.map((badge) => (
							<span className={`public-badge labeled ${badge.rarity}`} title={badge.description} key={badge.id}>
								<b>{badge.icon}</b> {badge.name}
							</span>
						))}
						{!showcasedBadges.length && <span className="badge-preview-empty">Noch kein Badge präsentiert</span>}
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
												? "Hauptbadge"
												: showcaseSlot > 1
													? `Schaukasten ${showcaseSlot}`
													: grant.badge.rarity === "epic"
														? "Episch"
														: grant.badge.rarity === "rare"
															? "Selten"
															: "Gewöhnlich"}
										</small>
										<strong>{grant.badge.name}</strong>
										<p>{grant.badge.description}</p>
									</div>
									<span className="badge-select-mark">{selected ? showcaseSlot : <Plus size={14} />}</span>
								</button>
							);
						})}
					</div>
				) : (
					<div className="empty-state compact-empty">
						<Award size={30} />
						<h3>Dein erstes Badge wartet</h3>
						<p>Schließe eine Challenge ab, um hier dein erstes Blütenzeichen freizuschalten.</p>
						<Link className="text-link" href="/challenges">
							Challenges öffnen
						</Link>
					</div>
				)}
			</section>

			<section className="profile-tournaments">
				<div className="section-heading">
					<span>Meine Turniere</span>
					<h2>Anmeldungen und Wunschgruppen</h2>
					<p>Alle bewerben sich einzeln. Wunschgruppen zeigen der Turnierleitung nur, mit wem du gerne zusammenspielen möchtest.</p>
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
								<span className="kicker">Einladung erhalten?</span>
								<strong>Wunschgruppen-Code eingeben</strong>
							</div>
							<input
								value={wishGroupCode}
								onChange={(event) => setWishGroupCode(event.target.value.toUpperCase())}
								placeholder="WG-XXXXXXXX"
								aria-label="Wunschgruppen-Code"
								required
							/>
							<button className="button button-secondary" disabled={tournamentBusy === "join"} type="submit">
								<UsersRound size={15} /> Beitreten
							</button>
						</form>
						<div className="profile-tournament-list">
							{tournamentProfile?.applications.map((application) => {
								const group = tournamentProfile.groups.find((entry) => entry.tournamentId === application.tournamentId);
								return (
									<article className="profile-tournament-sheet" key={application.id}>
										<header>
											<div>
												<span className="kicker">Solo-Anmeldung · {application.status}</span>
												<h3>{application.title}</h3>
												<p>{application.riotId}</p>
											</div>
											<Link className="text-link" href={`/tournaments/${application.tournamentSlug}`}>
												Turnier öffnen <ExternalLink size={13} />
											</Link>
										</header>
										<div className="tournament-dm-setting">
											<span className={application.discordDmOptIn ? "dm-icon enabled" : "dm-icon"}>
												{application.discordDmOptIn ? <Bell size={17} /> : <BellOff size={17} />}
											</span>
											<div>
												<strong>Discord-Bot Nachrichten</strong>
												<small>Team-Zuteilung und wichtige Änderungen</small>
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
															Wunschgruppe · {group.members.length}/{application.wishGroupLimit}
														</span>
														<h4>{group.name}</h4>
													</div>
													<button className="wish-code" type="button" onClick={() => copyWishGroupCode(group.inviteCode)} title="Code kopieren">
														<code>{group.inviteCode}</code>
														<Copy size={14} />
													</button>
												</div>
												<div className="wish-group-members">
													{group.members.map((member) => (
														<span key={member.userId}>
															{member.riotId}
															{member.userId === group.ownerUserId ? " · Gründer" : ""}
														</span>
													))}
												</div>
												<p>
													<AlertTriangle size={14} /> Skill-Unterschiede und faire Teams haben Vorrang. Die Turnierleitung kann diese Wunschgruppe deshalb
													aufteilen.
												</p>
												{application.registrationOpen && (
													<button
														className="text-button danger-text"
														type="button"
														disabled={tournamentBusy === `leave:${group.id}`}
														onClick={() => leaveWishGroup(group.id)}
													>
														Wunschgruppe verlassen
													</button>
												)}
											</div>
										) : application.wishGroupMode !== "disabled" && application.registrationOpen ? (
											<div className="wish-group-create">
												<div>
													<strong>Wunschgruppe erstellen</strong>
													<p>
														Bis zu {application.wishGroupLimit} Personen. Der Wunsch ist unverbindlich und garantiert keine gemeinsame Team-Zuteilung.
													</p>
												</div>
												<div>
													<input
														value={wishGroupName[application.tournamentId] || ""}
														onChange={(event) => setWishGroupName((current) => ({ ...current, [application.tournamentId]: event.target.value }))}
														placeholder="Name der Wunschgruppe"
													/>
													<button
														className="button button-primary"
														type="button"
														disabled={tournamentBusy === `create:${application.tournamentId}`}
														onClick={() => createWishGroup(application.tournamentId)}
													>
														<Plus size={15} /> Erstellen
													</button>
												</div>
											</div>
										) : (
											<p className="wish-group-locked">Wunschgruppen können geöffnet und geändert werden, sobald die Anmeldung läuft.</p>
										)}
									</article>
								);
							})}
						</div>
					</>
				) : (
					<div className="empty-state compact-empty">
						<UsersRound size={30} />
						<h3>Noch keine Turnieranmeldung</h3>
						<p>Nach deiner ersten Solo-Anmeldung kannst du hier eine Wunschgruppe verwalten.</p>
						<Link className="text-link" href="/tournaments">
							Turniere entdecken
						</Link>
					</div>
				)}
				{(tournamentProfile?.notifications || []).length > 0 && (
					<div className="profile-notification-list">
						<span className="kicker">Benachrichtigungen</span>
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
								<time>{new Date(notification.createdAt).toLocaleDateString("de-DE")}</time>
							</Link>
						))}
					</div>
				)}
			</section>

			<section className="profile-shortcuts">
				<Link href="/challenges">
					<Target size={22} />
					<span>
						<strong>Meine Challenges</strong>
						<small>Fortschritt und Community-Ziele</small>
					</span>
					<ExternalLink size={16} />
				</Link>
				<Link href="/bewerbungen">
					<ClipboardList size={22} />
					<span>
						<strong>Meine Bewerbungen</strong>
						<small>Ausschreibungen und Status</small>
					</span>
					<ExternalLink size={16} />
				</Link>
				<Link href="/tournaments">
					<Gamepad2 size={22} />
					<span>
						<strong>Turnierhub</strong>
						<small>Teams, Spielplan und Playoffs</small>
					</span>
					<ExternalLink size={16} />
				</Link>
			</section>

			{connectionAction &&
				(() => {
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
									<button className="icon-action" type="button" onClick={() => setConnectionAction(null)} disabled={connectionBusy} title="Schließen">
										<X size={18} />
									</button>
								</header>
								<div>
									<span className="kicker">Verbindung verwalten</span>
									<h2 id="connection-warning-title">{warning.title}</h2>
									<p>{warning.copy}</p>
									{connectionError && <p className="form-error">{connectionError}</p>}
								</div>
								<footer>
									<button className="button button-secondary" type="button" onClick={() => setConnectionAction(null)} disabled={connectionBusy}>
										Abbrechen
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
