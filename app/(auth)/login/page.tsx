"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Flower2, ShieldCheck, Twitch } from "lucide-react";
import { DiscordMark } from "@/components/DiscordMark";

export default function LoginPage() {
	const { status } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (status === "authenticated") router.push("/me");
	}, [status, router]);

	if (status === "loading" || status === "authenticated") {
		return (
			<section className="login-page">
				<div className="login-card">
					<div className="login-header">
						<Flower2 size={28} />
						<h1>Dein Platz wird vorbereitet...</h1>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="login-page">
			<div className="login-card">
				<div className="login-header">
					<Flower2 size={30} />
					<span className="section-kicker">Community-Zugang</span>
					<h1>Willkommen im Kirschblütenzimmer.</h1>
					<p>Discord ist dein Hauptkonto für Bewerbungen, Turniere und die Community.</p>
				</div>
				<div className="login-buttons">
					<button className="login-btn discord" onClick={() => signIn("discord")}>
						<DiscordMark size={20} />
						<span>Mit Discord anmelden</span>
					</button>
					<button className="login-btn twitch" onClick={() => signIn("twitch")}>
						<Twitch size={22} />
						<span>Twitch-Konto verbinden</span>
					</button>
				</div>
				<p className="login-note">
					<ShieldCheck size={15} />
					Twitch und deine Riot-ID kannst du später in deinem Profil verbinden.
				</p>
			</div>
		</section>
	);
}
