"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Brush, CalendarDays, Crown, Flower2, MessageCircleHeart, Sparkles, Trophy, UserRound } from "lucide-react";
import type { PublicBadge } from "@/lib/public-badges";

const fetcher = (url: string) =>
	fetch(url).then(async (response) => {
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || "Community-Profil nicht gefunden.");
		return data;
	});

type MemberProfile = {
	member: { id: string; name: string; image: string | null; memberSince: string | null; badges: PublicBadge[] };
	posts: { id: string; kind: "message" | "fanart"; title?: string; body: string; mediaUrl: string | null; publishedAt: string }[];
	tournaments: { id: string; title: string; href: string; status: string; date: string | null; teamName: string; won: boolean }[];
};

export default function CommunityMemberPage() {
	const params = useParams<{ id: string }>();
	const { data, error, isLoading } = useSWR<MemberProfile>(params.id ? `/api/community/members/${params.id}` : null, fetcher);

	if (isLoading)
		return (
			<main className="member-profile-page">
				<div className="skeleton member-profile-skeleton" />
			</main>
		);
	if (error || !data)
		return (
			<main className="member-profile-page">
				<div className="empty-state">
					<UserRound size={38} />
					<h1>Dieses Community-Profil blüht hier nicht.</h1>
					<p>Der Link ist ungültig oder das Profil existiert nicht mehr.</p>
					<Link className="button button-secondary" href="/community">
						Zur Pinnwand
					</Link>
				</div>
			</main>
		);

	const { member, posts, tournaments } = data;
	return (
		<main className="member-profile-page">
			<Link className="member-profile-back" href="/community">
				<ArrowLeft size={15} /> Zur Kirschblüten-Pinnwand
			</Link>
			<header className="member-profile-hero">
				<div className="member-profile-avatar">
					{member.image ? <Image src={member.image} alt="" width={112} height={112} /> : <UserRound size={40} />}
					{member.badges[0] && <span className={`user-menu-badge ${member.badges[0].rarity}`}>{member.badges[0].icon}</span>}
				</div>
				<div>
					<span className="kicker">Community-Pass</span>
					<h1>{member.name}</h1>
					<p>
						{member.memberSince
							? `Im Garten seit ${new Intl.DateTimeFormat("de-DE", { year: "numeric", month: "long" }).format(new Date(member.memberSince))}`
							: "Teil von Nachtaras Community Garden"}
					</p>
				</div>
				<Flower2 className="member-profile-hero-flower" size={72} strokeWidth={0.8} />
			</header>

			<section className="member-profile-badges">
				<header>
					<span className="kicker">Präsentierte Blütenzeichen</span>
					<h2>Was hier schon erblüht ist</h2>
				</header>
				<div className="member-badge-ribbon">
					{member.badges.map((badge) => (
						<span className={`public-badge labeled ${badge.rarity}`} title={badge.description} key={badge.id}>
							<b>{badge.icon}</b> {badge.name}
						</span>
					))}
					{!member.badges.length && (
						<span className="member-profile-empty-line">
							<Sparkles size={15} /> Noch keine Badges präsentiert
						</span>
					)}
				</div>
			</section>

			<section className="member-profile-columns">
				<div>
					<header className="member-profile-section-head">
						<span className="kicker">Pinnwand</span>
						<h2>Beiträge & Fanart</h2>
					</header>
					<div className="member-contribution-list">
						{posts.map((post) => (
							<article className="member-contribution" key={post.id}>
								{post.mediaUrl && (
									<div className="member-contribution-art">
										<Image src={post.mediaUrl} alt={post.title || "Community-Fanart"} fill sizes="(max-width: 720px) 100vw, 320px" />
									</div>
								)}
								<div>
									<span>
										{post.kind === "fanart" ? <Brush size={13} /> : <MessageCircleHeart size={13} />}
										{post.kind === "fanart" ? "Fanart" : "Lieber Gruß"}
									</span>
									{post.title && <h3>{post.title}</h3>}
									<p>{post.body}</p>
								</div>
							</article>
						))}
						{!posts.length && (
							<div className="empty-state compact-empty">
								<MessageCircleHeart size={30} />
								<h3>Noch still an der Pinnwand</h3>
								<p>Freigegebene Beiträge erscheinen später hier.</p>
							</div>
						)}
					</div>
				</div>
				<div>
					<header className="member-profile-section-head">
						<span className="kicker">Turniergarten</span>
						<h2>Teams & Turniere</h2>
					</header>
					<div className="member-tournament-list">
						{tournaments.map((tournament) => (
							<Link href={tournament.href} className={tournament.won ? "winner" : ""} key={`${tournament.id}-${tournament.teamName}`}>
								<span className="member-tournament-icon">{tournament.won ? <Crown size={19} /> : <Trophy size={19} />}</span>
								<div>
									<small>{tournament.won ? "Turniersieg" : tournament.status === "completed" ? "Teilgenommen" : "Im Team"}</small>
									<strong>{tournament.title}</strong>
									<span>{tournament.teamName}</span>
								</div>
								{tournament.date && (
									<time>
										<CalendarDays size={12} /> {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(tournament.date))}
									</time>
								)}
							</Link>
						))}
						{!tournaments.length && (
							<div className="empty-state compact-empty">
								<Trophy size={30} />
								<h3>Noch keine Teamseite</h3>
								<p>Veröffentlichte Turnierkader erscheinen hier.</p>
							</div>
						)}
					</div>
				</div>
			</section>
		</main>
	);
}
