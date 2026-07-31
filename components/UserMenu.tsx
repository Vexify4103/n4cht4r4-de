"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
	const { data: session, status } = useSession();
	const [open, setOpen] = useState(false);
	const [adminRole, setAdminRole] = useState<string | null>(null);
	const ref = useRef<HTMLDivElement>(null);

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
			.then(async (response) => response.ok ? response.json() : null)
			.then((result) => {
				if (active) setAdminRole(typeof result?.role === "string" ? result.role : null);
			})
			.catch(() => {
				if (active) setAdminRole(null);
			});
		return () => { active = false; };
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
				{session.user?.image ? (
					<Image src={session.user.image} alt="" className="user-avatar" width={34} height={34} />
				) : (
					<span className="user-avatar-placeholder"><User size={17} /></span>
				)}
				<span className="user-menu-name">{session.user?.name}</span>
				<ChevronDown size={14} />
			</button>
			{open && (
				<div className="user-dropdown">
					<div className="user-dropdown-header">
						<small>Angemeldet als</small>
						<strong>{session.user?.name}</strong>
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
