import Link from "next/link";
import { Flower2, Home, MessageCircleHeart } from "lucide-react";

export default function NotFound() {
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
				<span className="kicker">Verlaufen im Blütengarten</span>
				<h1>Diese Seite ist wohl davongeweht.</h1>
				<p>Hier blüht gerade nichts. Vielleicht war der Link alt, vertippt oder ein Sakura-Blatt hat ihn einfach mitgenommen.</p>
				<div className="not-found-actions">
					<Link className="button button-primary" href="/">
						<Home size={17} /> Zurück zur Startseite
					</Link>
					<Link className="not-found-community-link" href="/community">
						<MessageCircleHeart size={16} /> Zur Community-Pinnwand
					</Link>
				</div>
				<span className="not-found-note">
					<Flower2 size={15} /> Nachtaras Garten wartet dort auf dich.
				</span>
			</div>
		</section>
	);
}
