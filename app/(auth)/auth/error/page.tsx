"use client";

import Link from "next/link";
import { AlertTriangle, Flower2 } from "lucide-react";

export default function AuthErrorPage() {
	return (
		<section className="login-page">
			<div className="login-card">
				<div className="login-header">
					<AlertTriangle size={28} />
					<h1>Ein Fehler ist aufgetreten 🌸</h1>
					<p>Beim Anmelden ist leider etwas schiefgelaufen. Bitte versuche es erneut.</p>
				</div>
				<Link href="/login" className="button button-primary">
					<Flower2 size={18} />
					Zurück zum Login
				</Link>
			</div>
		</section>
	);
}
