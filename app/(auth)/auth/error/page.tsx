"use client";

import Link from "next/link";
import { AlertTriangle, Flower2 } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export default function AuthErrorPage() {
	const { text } = useLocale();
	return (
		<section className="login-page">
			<div className="login-card">
				<div className="login-header">
					<AlertTriangle size={28} />
					<h1>{text("Something went wrong", "Ein Fehler ist aufgetreten")} 🌸</h1>
					<p>{text("Something went wrong while signing in. Please try again.", "Beim Anmelden ist leider etwas schiefgelaufen. Bitte versuche es erneut.")}</p>
				</div>
				<Link href="/login" className="button button-primary">
					<Flower2 size={18} />
					{text("Back to sign in", "Zurück zum Login")}
				</Link>
			</div>
		</section>
	);
}
