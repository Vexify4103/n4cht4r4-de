"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import { Gamepad2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Target, Twitch } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { DiscordMark } from "@/components/DiscordMark";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type Challenge = {
	id: string;
	title: string;
	description: string;
	type: "wins" | "kills" | "matches" | "watchtime" | "community";
	target: number;
	progress: number;
	icon: string;
	reward?: string;
	requirement?: "discord" | "twitch" | "riot";
};

type Profile = {
	providers: string[];
	riotVerified: boolean;
};

function progressLabel(challenge: Challenge) {
	if (challenge.type === "watchtime") return `${challenge.progress} / ${challenge.target} Minuten`;
	if (challenge.type === "community" && challenge.target >= 60) {
		return `${Math.floor(challenge.progress / 60).toLocaleString("de-DE")} / ${Math.floor(challenge.target / 60).toLocaleString("de-DE")} Stunden`;
	}
	return `${challenge.progress.toLocaleString("de-DE")} / ${challenge.target.toLocaleString("de-DE")}`;
}

export default function ChallengesPage() {
	const { data: session } = useSession();
	const [tab, setTab] = useState<"personal" | "community">("personal");
	const [updating, setUpdating] = useState(false);
	const { data, mutate } = useSWR<{ challenges: Challenge[] }>("/api/challenges", fetcher, { revalidateOnFocus: false });
	const { data: profile } = useSWR<Profile>(session ? "/api/user/profile" : null, fetcher);
	const challenges = (data?.challenges || []).filter((challenge) => tab === "community" ? challenge.type === "community" : challenge.type !== "community");

	const updateProgress = useCallback(async () => {
		if (!session || updating) return;
		setUpdating(true);
		try {
			await fetch("/api/challenges/update", { method: "POST" });
			await mutate();
		} finally {
			setUpdating(false);
		}
	}, [session, updating, mutate]);

	const hasDiscord = profile?.providers.includes("discord");
	const hasTwitch = profile?.providers.includes("twitch");

	return (
		<>
			<PageHero
				kicker="Community-Challenges"
				title="Kleine Ziele, gemeinsam gesammelt."
				copy="Deine League-Matches und Live-Watchtime werden nach dem Verknüpfen automatisch gezählt. Community-Ziele wachsen mit allen zusammen."
				icon={<Target size={44} strokeWidth={1.6} />}
			/>

			<section className="content-band">
				<div className="requirements-strip">
					<strong>Deine Verbindungen</strong>
					<div>
						<span className={`connection-badge discord-connection ${hasDiscord ? "connected" : ""}`}><span className="discord-mark-chip"><DiscordMark size={9} /></span> Discord</span>
						<span className={`connection-badge ${hasTwitch ? "connected" : ""}`}><Twitch size={13} /> Twitch</span>
						<span className={`connection-badge ${profile?.riotVerified ? "connected" : ""}`}><ShieldCheck size={13} /> Riot-ID</span>
					</div>
					{session ? <Link className="text-link" href="/me">Verbindungen verwalten</Link> : <Link className="button button-primary" href="/login">Mit Discord starten</Link>}
				</div>
			</section>

			<section className="content-band">
				<div className="challenge-toolbar">
					<div className="tab-nav">
						<button className={`tab-btn ${tab === "personal" ? "active" : ""}`} onClick={() => setTab("personal")}><Gamepad2 size={15} /> Für mich</button>
						<button className={`tab-btn ${tab === "community" ? "active" : ""}`} onClick={() => setTab("community")}><Sparkles size={15} /> Gemeinsam</button>
					</div>
					{tab === "personal" && session && profile?.riotVerified && (
						<button className="button button-secondary button-small" disabled={updating} onClick={updateProgress}>
							<RefreshCw className={updating ? "spin" : ""} size={15} /> {updating ? "Wird geprüft" : "League jetzt prüfen"}
						</button>
					)}
				</div>

				{tab === "personal" && !session ? (
					<div className="empty-state">
						<LockKeyhole size={38} />
						<h3>Deine Challenges warten auf dich</h3>
						<p>Melde dich zuerst mit Discord an. Twitch und Riot kannst du danach sicher mit deinem Profil verbinden.</p>
						<button className="login-btn discord compact-login" onClick={() => signIn("discord")}>
							<DiscordMark size={17} /> Mit Discord anmelden
						</button>
					</div>
				) : (
					<div className="challenge-grid">
						{challenges.map((challenge) => {
							const percent = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
							const complete = challenge.progress >= challenge.target;
							return (
								<article className={`challenge-card ${challenge.type === "community" ? "community" : ""}`} key={challenge.id}>
									<div className="challenge-card-top">
										<span className="challenge-icon" aria-hidden="true">{challenge.icon}</span>
										<span className={`challenge-badge ${complete ? "active" : challenge.type === "community" ? "community" : ""}`}>
											{complete ? "Geschafft" : challenge.requirement === "twitch" ? "Twitch" : challenge.requirement === "riot" ? "Riot-ID" : "Community"}
										</span>
									</div>
									<h3>{challenge.title}</h3>
									<p>{challenge.description}</p>
									{challenge.reward && <small className="challenge-reward">Belohnung: {challenge.reward}</small>}
									<div className="challenge-progress">
										<div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
										<div className="progress-text"><span>{progressLabel(challenge)}</span><strong>{percent}%</strong></div>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</section>
		</>
	);
}
