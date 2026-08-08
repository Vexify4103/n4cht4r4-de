"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

type BadgeProfile = {
	badges: { rewardKey: string; badge: { id: string; name: string; description: string; icon: string; rarity: "common" | "rare" | "epic" } }[];
	showcasedBadgeIds: string[];
};

const fetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.json() : null));

export function UserMenu() {
	const { data: session, status } = useSession();
	const [open, setOpen] = useState(false);
	const [adminRole, setAdminRole] = useState<string | null>(null);
	const ref = useRef<HTMLDivElement>(null);
	const { data: badgeProfile } = useSWR<BadgeProfile | null>(session?.user?.id ? "/api/user/badges" : null, fetcher, {
		revalidateOnFocus: false,
		dedupingInterval: 60_000,
	});
	const showcasedBadges = (badgeProfile?.showcasedBadgeIds || [])
		.map((badgeId) => badgeProfile?.badges.find((grant) => grant.rewardKey === badgeId)?.badge)
		.filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));

	useEffect(() => {
		function handleClick(event: MouseEvent) {
			if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	useEffect(() => {
		if (!session?.user?.id) {
			setAdminRole(null);
			return;
		}
		let active = true;
		fetch("/api/admin/access")
			.then(async (response) => (response.ok ? response.json() : null))
			.then((result) => {
				if (active) setAdminRole(typeof result?.role === "string" ? result.role : null);
			})
			.catch(() => {
				if (active) setAdminRole(null);
			});
		return () => {
			active = false;
		};
	}, [session?.user?.id]);

	if (status === "loading") return <div className="user-menu-skeleton" />;

	if (!session) {
		return (
			<Link href="/login" className="account-login">
				<LogIn size={16} />
				<span>Anmelden</span>
			</Link>
		);
	}

	return (
		<div className="user-menu" ref={ref}>
			<button className="user-menu-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
				<span className="user-avatar-badge-wrap">
					{session.user?.image ? (
						<Image src={session.user.image} alt="" className="user-avatar" width={34} height={34} />
					) : (
						<span className="user-avatar-placeholder">
							<User size={17} />
						</span>
					)}
					{showcasedBadges[0] && (
						<span className={`user-menu-badge ${showcasedBadges[0].rarity}`} title={showcasedBadges[0].name}>
							{showcasedBadges[0].icon}
						</span>
					)}
				</span>
				<span className="user-menu-name">{session.user?.name}</span>
				<ChevronDown size={14} />
			</button>
			{open && (
				<div className="user-dropdown">
					<div className="user-dropdown-header">
						<small>Angemeldet als</small>
						<strong>{session.user?.name}</strong>
						{showcasedBadges.length > 0 && (
							<span className="user-dropdown-badges">
								{showcasedBadges.map((badge) => (
									<span className={`public-badge ${badge.rarity}`} title={`${badge.name}: ${badge.description}`} key={badge.id}>
										{badge.icon}
									</span>
								))}
							</span>
						)}
					</div>
					<Link href="/me" className="user-dropdown-item" onClick={() => setOpen(false)}>
						<User size={16} /> Mein Garten
					</Link>
					{adminRole && (
						<Link href="/admin/tournaments" className="user-dropdown-item" onClick={() => setOpen(false)}>
							<ShieldCheck size={16} /> Turnierverwaltung
						</Link>
					)}
					<button className="user-dropdown-item logout" type="button" onClick={() => signOut()}>
						<LogOut size={16} /> Abmelden
					</button>
				</div>
			)}
		</div>
	);
}
