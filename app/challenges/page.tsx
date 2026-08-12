"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { Award, Gamepad2, Gift, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Target, Twitch } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Challenge = {
	id: string;
	seasonId: string;
	title: string;
	titleEn?: string;
	description: string;
	descriptionEn?: string;
	type: "wins" | "kills" | "matches" | "watchtime" | "community" | "meta";
	target: number;
	progress: number;
	icon: string;
	reward?: string;
	rewardEn?: string;
	startsAt: string;
	endsAt: string;
	badge?: { id: string; name: string; nameEn?: string; description: string; descriptionEn?: string; icon: string; rarity: "common" | "rare" | "epic" };
	completedAt?: string | null;
	rewards?: Array<{ id: string; type: "badge" | "discord_role"; label: string; status: "granted" | "available" | "queued" | "failed" }>;
	requirement?: "discord" | "twitch" | "riot" | "community";
};

type Profile = {
	providers: string[];
	riotVerified: boolean;
};

function progressLabel(challenge: Challenge, locale: Locale) {
	if (challenge.type === "watchtime" || challenge.type === "community") return `${formatMinutes(challenge.progress, locale)} / ${formatMinutes(challenge.target, locale)}`;
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	return `${challenge.progress.toLocaleString(intlLocale)} / ${challenge.target.toLocaleString(intlLocale)}`;
}

function formatMinutes(value: number, locale: Locale) {
	const intlLocale = locale === "en" ? "en-GB" : "de-DE";
	const hours = Math.floor(value / 60);
	const minutes = value % 60;
	if (!hours) return `${minutes.toLocaleString(intlLocale)} min`;
	if (!minutes) return `${hours.toLocaleString(intlLocale)} ${locale === "en" ? "hrs" : "Std."}`;
	return `${hours.toLocaleString(intlLocale)} ${locale === "en" ? "hrs" : "Std."} ${minutes.toLocaleString(intlLocale)} min`;
}

function rarityLabel(rarity: "common" | "rare" | "epic" | undefined, locale: Locale) {
	if (locale === "en") return rarity === "epic" ? "Epic" : rarity === "rare" ? "Rare" : rarity === "common" ? "Common" : "";
	return rarity === "epic" ? "Episch" : rarity === "rare" ? "Selten" : rarity === "common" ? "Gewöhnlich" : "";
}

export default function ChallengesPage() {
	const { locale, text } = useLocale();
	const { data: session } = useSession();
	const [tab, setTab] = useState<"personal" | "community">("personal");
	const [updating, setUpdating] = useState(false);
	const [notice, setNotice] = useState("");
	const [claiming, setClaiming] = useState("");
	const { data, mutate } = useSWR<{ challenges: Challenge[] }>("/api/challenges", fetcher, { revalidateOnFocus: false });
	const { data: profile } = useSWR<Profile>(session ? "/api/user/profile" : null, fetcher);
	const challenges = (data?.challenges || []).filter((challenge) => (tab === "community" ? challenge.type === "community" : challenge.type !== "community"));

	const updateProgress = useCallback(async () => {
		if (!session || updating) return;
		setUpdating(true);
		try {
			const response = await fetch("/api/challenges/update", { method: "POST" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || text("The Riot check could not be queued.", "Die Riot-Prüfung konnte nicht eingeplant werden."));
			setNotice(
				result.created
					? text("Riot check queued. The server will process it within the rate limits.", "Riot-Prüfung eingeplant. Der Server arbeitet sie rate-limit-sicher ab.")
					: text("Your Riot check is already queued.", "Deine Riot-Prüfung wartet bereits in der Queue.")
			);
			for (let attempt = 0; attempt < 6; attempt++) {
				await new Promise((resolve) => window.setTimeout(resolve, 5_000));
				await mutate();
			}
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The Riot check could not be started.", "Die Riot-Prüfung konnte nicht gestartet werden."));
		} finally {
			setUpdating(false);
		}
	}, [session, updating, mutate, text]);

	async function claimReward(grantId: string) {
		setClaiming(grantId);
		setNotice("");
		try {
			const response = await fetch(`/api/challenges/rewards/${grantId}/claim`, { method: "POST" });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || text("The Discord role could not be requested.", "Die Discord-Rolle konnte nicht angefordert werden."));
			setNotice(
				result.granted
					? text("The Discord role is already active.", "Die Discord-Rolle ist bereits aktiv.")
					: text("The Discord role was added to the bot queue.", "Die Discord-Rolle wurde sicher in die Bot-Queue gelegt.")
			);
			await mutate();
		} catch (error) {
			setNotice(error instanceof Error ? error.message : text("The reward could not be requested.", "Die Belohnung konnte nicht angefordert werden."));
		} finally {
			setClaiming("");
		}
	}

	const hasDiscord = profile?.providers.includes("discord");
	const hasTwitch = profile?.providers.includes("twitch");

	return (
		<>
			<PageHero
				className="challenge-page-hero"
				kicker={text("Community challenges", "Community Challenges")}
				title={text("Our little challenge journal.", "Unser kleines Challenge-Tagebuch.")}
				copy={text(
					"League moments, shared stream time, and little milestones grow here blossom by blossom.",
					"League-Momente, gemeinsame Streamzeit und kleine Meilensteine wachsen hier Blüte für Blüte."
				)}
				icon={<Target size={44} strokeWidth={1.6} />}
			/>

			<section className="content-band challenge-connections-band">
				<div className="requirements-strip">
					<strong>{text("Your connections", "Deine Verbindungen")}</strong>
					<div>
						<span className={`connection-badge discord-connection ${hasDiscord ? "connected" : ""}`}>
							<span className="discord-mark-chip">
								<DiscordMark size={9} />
							</span>{" "}
							Discord
						</span>
						<span className={`connection-badge ${hasTwitch ? "connected" : ""}`}>
							<Twitch size={13} /> Twitch
						</span>
						<span className={`connection-badge ${profile?.riotVerified ? "connected" : ""}`}>
							<ShieldCheck size={13} /> Riot-ID
						</span>
					</div>
					{session ? (
						<Link className="text-link" href="/me">
							{text("Manage connections", "Verbindungen verwalten")}
						</Link>
					) : (
						<Link className="button button-primary" href="/login">
							{text("Start with Discord", "Mit Discord starten")}
						</Link>
					)}
				</div>
			</section>

			<section className="content-band challenge-journal-band">
				{notice && (
					<p className="challenge-notice">
						<Sparkles size={15} /> {notice}
					</p>
				)}
				<div className="challenge-toolbar">
					<div className="tab-nav">
						<button className={`tab-btn ${tab === "personal" ? "active" : ""}`} onClick={() => setTab("personal")}>
							<Gamepad2 size={15} /> {text("For me", "Für mich")}
						</button>
						<button className={`tab-btn ${tab === "community" ? "active" : ""}`} onClick={() => setTab("community")}>
							<Sparkles size={15} /> {text("Together", "Gemeinsam")}
						</button>
					</div>
					{tab === "personal" && session && profile?.riotVerified && (
						<button className="button button-secondary button-small" disabled={updating} onClick={updateProgress}>
							<RefreshCw className={updating ? "spin" : ""} size={15} />{" "}
							{updating ? text("Checking", "Wird geprüft") : text("Check League now", "League jetzt prüfen")}
						</button>
					)}
				</div>
				<div className="challenge-journal-heading">
					<span className="kicker">{tab === "community" ? text("Our shared Hanami", "Unser gemeinsamer Hanami") : text("Your season", "Deine Saison")}</span>
					<h2>
						{tab === "community"
							? text("What the whole community achieves together", "Was die ganze Community zusammen schafft")
							: text("Your personal blossom paths", "Deine persönlichen Blütenwege")}
					</h2>
					<p>
						{tab === "community"
							? text("Every connected minute contributes to the same goal.", "Jede verknüpfte Minute zählt in dieselbe Richtung.")
							: text("Twitch and Riot goals are collected independently.", "Twitch- und Riot-Ziele werden unabhängig voneinander gesammelt.")}
					</p>
				</div>

				{tab === "personal" && !session && (
					<div className="empty-state challenge-login-note">
						<LockKeyhole size={38} />
						<h3>{text("Your challenges are waiting", "Deine Challenges warten auf dich")}</h3>
						<p>
							{text(
								"Sign in with Discord first. You can then securely connect Twitch and Riot to your profile.",
								"Melde dich zuerst mit Discord an. Twitch und Riot kannst du danach sicher mit deinem Profil verbinden."
							)}
						</p>
						<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
							<DiscordMark size={17} /> {text("Sign in with Discord", "Mit Discord anmelden")}
						</button>
					</div>
				)}
				<div className="challenge-journal">
					{challenges.map((challenge) => {
						const percent = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
						const complete = challenge.progress >= challenge.target;
						const roleReward = challenge.rewards?.find((reward) => reward.type === "discord_role");
						return (
							<article className={`challenge-journal-entry ${challenge.type === "community" ? "community" : ""}`} key={challenge.id}>
								<div className="challenge-card-top">
									<span className="challenge-icon" aria-hidden="true">
										{challenge.icon}
									</span>
									<span className={`challenge-badge ${complete ? "active" : challenge.type === "community" ? "community" : ""}`}>
										{complete
											? text("Completed", "Geschafft")
											: challenge.requirement === "twitch"
												? "Twitch"
												: challenge.requirement === "riot"
													? "Riot-ID"
													: challenge.requirement === "discord"
														? "Discord"
														: "Community"}
									</span>
								</div>
								<h3>{locale === "en" ? challenge.titleEn || challenge.title : challenge.title}</h3>
								<p>{locale === "en" ? challenge.descriptionEn || challenge.description : challenge.description}</p>
								<div className="challenge-season-line">
									<span>
										{challenge.seasonId === "community-permanent"
											? text("Permanent milestone", "Permanenter Meilenstein")
											: text("Launch season", "Launch-Saison")}
										{challenge.badge ? ` · ${rarityLabel(challenge.badge.rarity, locale)}` : ""}
									</span>
									{challenge.seasonId !== "community-permanent" && (
										<time>
											{text("until", "bis")} {new Date(challenge.endsAt).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE")}
										</time>
									)}
								</div>
								{challenge.reward && (
									<small className="challenge-reward">
										<Gift size={13} /> {text("Reward", "Belohnung")}: {locale === "en" ? challenge.rewardEn || challenge.reward : challenge.reward}
									</small>
								)}
								<div className="challenge-progress">
									<div className="progress-bar">
										<div className="progress-fill" style={{ width: `${percent}%` }} />
									</div>
									<div className="progress-text">
										<span>{progressLabel(challenge, locale)}</span>
										<strong>{percent}%</strong>
									</div>
								</div>
								{complete && challenge.badge && (
									<div className={`challenge-unlocked-badge ${challenge.badge.rarity}`}>
										<span>{challenge.badge.icon}</span>
										<div>
											<small>{text("Badge unlocked", "Badge freigeschaltet")}</small>
											<strong>{locale === "en" ? challenge.badge.nameEn || challenge.badge.name : challenge.badge.name}</strong>
										</div>
										<Award size={17} />
									</div>
								)}
								{roleReward && roleReward.status !== "granted" && (
									<button
										className="button button-secondary button-small challenge-claim"
										disabled={roleReward.status === "queued" || claiming === roleReward.id}
										onClick={() => claimReward(roleReward.id)}
									>
										{claiming === roleReward.id ? <Loader2 className="spin" size={14} /> : <Gift size={14} />}
										{roleReward.status === "queued"
											? text("Discord role queued", "Discord-Rolle wartet")
											: roleReward.status === "failed"
												? text("Retry Discord role", "Discord-Rolle erneut versuchen")
												: text("Claim Discord role", "Discord-Rolle abholen")}
									</button>
								)}
								{roleReward?.status === "granted" && (
									<p className="challenge-role-granted">
										<ShieldCheck size={14} /> {text("Discord role active", "Discord-Rolle aktiv")}
									</p>
								)}
							</article>
						);
					})}
				</div>
			</section>
		</>
	);
}
