"use client";

import Link from "next/link";
import { Flower2, Home, MessageCircleHeart } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export default function NotFound() {
	const { text } = useLocale();
	return (
		<section className="not-found-page">
			<div className="not-found-illustration" aria-hidden="true">
				<span className="not-found-code">404</span>
				<div className="not-found-branch">
					<span>🌸</span>
					<span>🌸</span>
					<span>🌸</span>
				</div>
				<span className="not-found-petal petal-one">✿</span>
				<span className="not-found-petal petal-two">❀</span>
				<span className="not-found-petal petal-three">✿</span>
			</div>

			<div className="not-found-copy">
				<span className="kicker">{text("Lost in the blossom garden", "Verlaufen im Blütengarten")}</span>
				<h1>{text("This page seems to have drifted away.", "Diese Seite ist wohl davongeweht.")}</h1>
				<p>
					{text(
						"Nothing is blooming here right now. Perhaps the link was old, mistyped, or simply carried away by a sakura leaf.",
						"Hier blüht gerade nichts. Vielleicht war der Link alt, vertippt oder ein Sakura-Blatt hat ihn einfach mitgenommen."
					)}
				</p>
				<div className="not-found-actions">
					<Link className="button button-primary" href="/">
						<Home size={17} /> {text("Back to home", "Zurück zur Startseite")}
					</Link>
					<Link className="not-found-community-link" href="/community">
						<MessageCircleHeart size={16} /> {text("Community wall", "Zur Community-Pinnwand")}
					</Link>
				</div>
				<span className="not-found-note">
					<Flower2 size={15} /> {text("Nachtara's garden is waiting for you there.", "Nachtaras Garten wartet dort auf dich.")}
				</span>
			</div>
		</section>
	);
}
