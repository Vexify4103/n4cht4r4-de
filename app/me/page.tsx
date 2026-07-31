"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import useSWR from "swr";
import { AlertTriangle, Check, ClipboardList, ExternalLink, Flower2, Gamepad2, Link2Off, Loader2, LogOut, Plus, RefreshCw, ShieldCheck, Target, Twitch, User, X } from "lucide-react";
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
	const [riotName, setRiotName] = useState("");
	const [riotTag, setRiotTag] = useState("");
	const [busy, setBusy] = useState<"start" | "confirm" | null>(null);
	const [error, setError] = useState("");
	const [connectionAction, setConnectionAction] = useState<ConnectionAction | null>(null);
	const [connectionBusy, setConnectionBusy] = useState(false);
	const [connectionError, setConnectionError] = useState("");

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

	if (status === "loading" || !session) return <main className="me-page"><div className="skeleton profile-skeleton" /></main>;

	const hasDiscord = profile?.providers.includes("discord");
	const hasTwitch = profile?.providers.includes("twitch");
	const challenge = profile?.riotVerificationChallenge;

	return (
		<main className="me-page">
			<section className="profile-intro">
				<div className="profile-avatar-wrap">
					{session.user?.image ? <Image className="me-avatar" src={session.user.image} alt="" width={92} height={92} /> : <span className="me-avatar-placeholder"><User size={36} /></span>}
					<Flower2 size={20} />
				</div>
				<div>
					<span className="kicker">Mein Kirschblütenpass</span>
					<h1>{session.user?.name || "Mein Profil"}</h1>
					<p>{session.user?.email}</p>
				</div>
			</section>

			<section className="profile-connections">
				<div className="section-heading"><span>Verbindungen</span><h2>Was dein Profil freischaltet</h2><p>Discord bleibt das Hauptkonto. Twitch zählt Watchtime, Riot zählt League-Fortschritt.</p></div>
				<div className="connection-grid">
					<article className={`connection-panel ${hasDiscord ? "connected" : ""}`}>
						<span className="discord-panel-mark"><DiscordMark size={21} /></span><div><h3>Discord</h3><p>Community, Bewerbungen und Turnierkontakt.</p></div>
						{hasDiscord ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected"><Check size={13} /> Hauptkonto</span>
								<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("discord", "disconnect")}><LogOut size={14} /> Abmelden</button>
							</div>
						) : <button className="button button-discord" onClick={() => signIn("discord")}><DiscordMark size={14} /> Discord verbinden</button>}
					</article>
					<article className={`connection-panel ${hasTwitch ? "connected" : ""}`}>
						<Twitch size={26} /><div><h3>Twitch</h3><p>{profile?.twitchLogin ? `@${profile.twitchLogin} · ` : ""}Live-Watchtime und Stream-Challenges.</p></div>
						{hasTwitch ? (
							<div className="connection-panel-actions">
								<span className="connection-badge connected"><Check size={13} /> Verbunden</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "disconnect")}><Link2Off size={14} /> Trennen</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("twitch", "change")}><RefreshCw size={14} /> Wechseln</button>
								</div>
							</div>
						) : <button className="button button-twitch" onClick={() => signIn("twitch", { callbackUrl: "/me" })}><Plus size={15} /> Verbinden</button>}
					</article>
					<article className={`connection-panel ${profile?.riotVerified ? "connected" : ""}`}>
						<ShieldCheck size={26} /><div><h3>Riot-ID</h3><p>{profile?.riotVerified ? `${profile.riotSummonerName}#${profile.riotTagLine}` : "League-Challenges und Turnierbewerbungen."}</p></div>
						{profile?.riotVerified && (
							<div className="connection-panel-actions">
								<span className="connection-badge connected"><Check size={13} /> Verifiziert</span>
								<div className="connection-manage-buttons">
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "disconnect")}><Link2Off size={14} /> Trennen</button>
									<button className="connection-manage-button" type="button" onClick={() => openConnectionAction("riot", "change")}><RefreshCw size={14} /> Wechseln</button>
								</div>
							</div>
						)}
					</article>
				</div>
			</section>

			{!profile?.riotVerified && (
				<section className="riot-verification" id="riot-verification">
					<div className="section-heading"><span>Riot-Verifizierung</span><h2>Ein Profilbild als kurzer Besitznachweis</h2><p>Dein Passwort wird nie benötigt. Du wechselst nur vorübergehend auf ein zufällig ausgewähltes Riot-Profilbild.</p></div>
					{error && <p className="form-error">{error}</p>}
					{!challenge ? (
						<div className="riot-start-form">
							<label><span>Riot-Name</span><input value={riotName} onChange={(event) => setRiotName(event.target.value)} placeholder="Nachtara" /></label>
							<label><span>Tag</span><input value={riotTag} onChange={(event) => setRiotTag(event.target.value)} placeholder="EUW" /></label>
							<button className="button button-primary" disabled={busy !== null || !riotName.trim() || !riotTag.trim()} onClick={() => verify("start")}>
								{busy === "start" ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />} Verifizierung starten
							</button>
						</div>
					) : (
						<div className="riot-icon-challenge">
							<Image src={challenge.profileIconUrl} alt={`Riot Profilbild ${challenge.profileIconId}`} width={112} height={112} />
							<div><span className="kicker">Deine Aufgabe</span><h3>Setze dieses Bild als Riot-Profilbild.</h3><p>Danach kannst du es sofort wieder zurückändern. Die Aufgabe läuft bis {new Date(challenge.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.</p>
								<button className="button button-primary" disabled={busy !== null} onClick={() => verify("confirm")}>{busy === "confirm" ? <Loader2 className="spin" size={17} /> : <Check size={17} />} Profilbild jetzt prüfen</button>
							</div>
						</div>
					)}
				</section>
			)}

			{profile?.riotVerified && (
				<section className="riot-verified-banner">
					<ShieldCheck size={28} /><div><span className="kicker">Riot-ID verifiziert</span><h2>{profile.riotSummonerName}#{profile.riotTagLine}</h2><p>League-Challenges und Turnierbewerbungen sind freigeschaltet.</p></div>
				</section>
			)}

			<section className="profile-shortcuts">
				<Link href="/challenges"><Target size={22} /><span><strong>Meine Challenges</strong><small>Fortschritt und Community-Ziele</small></span><ExternalLink size={16} /></Link>
				<Link href="/bewerbungen"><ClipboardList size={22} /><span><strong>Meine Bewerbungen</strong><small>Ausschreibungen und Status</small></span><ExternalLink size={16} /></Link>
				<Link href="/tournaments"><Gamepad2 size={22} /><span><strong>Turnierhub</strong><small>Teams, Spielplan und Playoffs</small></span><ExternalLink size={16} /></Link>
			</section>

			{connectionAction && (() => {
				const warning = connectionAction.target === "discord"
					? connectionWarnings.discord
					: connectionAction.target === "twitch"
						? connectionAction.mode === "change" ? connectionWarnings.twitchChange : connectionWarnings.twitchDisconnect
						: connectionAction.mode === "change" ? connectionWarnings.riotChange : connectionWarnings.riotDisconnect;
				return (
					<div className="connection-warning-backdrop" onMouseDown={() => !connectionBusy && setConnectionAction(null)}>
						<section className="connection-warning" role="dialog" aria-modal="true" aria-labelledby="connection-warning-title" onMouseDown={(event) => event.stopPropagation()}>
							<header>
								<span><AlertTriangle size={20} /></span>
								<button className="icon-action" type="button" onClick={() => setConnectionAction(null)} disabled={connectionBusy} title="Schließen"><X size={18} /></button>
							</header>
							<div>
								<span className="kicker">Verbindung verwalten</span>
								<h2 id="connection-warning-title">{warning.title}</h2>
								<p>{warning.copy}</p>
								{connectionError && <p className="form-error">{connectionError}</p>}
							</div>
							<footer>
								<button className="button button-secondary" type="button" onClick={() => setConnectionAction(null)} disabled={connectionBusy}>Abbrechen</button>
								<button className="button button-danger-soft" type="button" onClick={confirmConnectionAction} disabled={connectionBusy}>
									{connectionBusy ? <Loader2 className="spin" size={16} /> : connectionAction.mode === "change" ? <RefreshCw size={16} /> : <Link2Off size={16} />}
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
