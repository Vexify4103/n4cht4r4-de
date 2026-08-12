"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Radio, Users } from "lucide-react";
import type { PublicBadge } from "@/lib/public-badges";
import { useLocale } from "@/components/LocaleProvider";

export type PublicTeam = {
	id: string;
	name: string;
	seed?: number | null;
	members?: { name: string; profileHref?: string; role?: string; opgg?: string; champs?: string[]; badges?: PublicBadge[] }[];
};

function playerOpgg(riotId: string) {
	return `https://www.op.gg/summoners/euw/${encodeURIComponent(riotId.replace("#", "-"))}`;
}

function multiOpgg(members: PublicTeam["members"]) {
	return `https://op.gg/de/lol/multisearch/euw?summoners=${encodeURIComponent((members || []).map((member) => member.name).join(","))}`;
}

export function TournamentTeamCard({ tournamentId, team }: { tournamentId: string; team: PublicTeam }) {
	const [copied, setCopied] = useState(false);
	const { locale, text } = useLocale();

	async function copyObsLink() {
		const url = `${window.location.origin}/tournaments/${tournamentId}/obs?bg=transparent&team=${team.id}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	}

	return (
		<article className="tournament-team-card">
			<header className="team-card-heading">
				<span className="team-seal">
					<Users size={20} />
				</span>
				<div>
					<small>{team.seed ? `Seed ${team.seed}` : text("Confirmed team", "Bestätigtes Team")}</small>
					<h3>{team.name}</h3>
				</div>
				<a className="icon-action" href={multiOpgg(team.members)} target="_blank" rel="noreferrer" title={text("Open team on op.gg", "Team auf op.gg öffnen")}>
					<ExternalLink size={16} />
				</a>
			</header>

			<div className="team-roster">
				{team.members?.length ? (
					team.members.map((member) => (
						<div className="team-player" key={`${team.id}-${member.name}`}>
							<span>{member.role || text("Player", "Spieler")}</span>
							<div className="team-player-identity">
								{member.profileHref ? (
									<Link className="team-player-profile-link" href={member.profileHref}>
										{member.name}
									</Link>
								) : (
									<strong>{member.name}</strong>
								)}
								{Boolean(member.badges?.length) && (
									<span className="player-badge-showcase" aria-label={text("Showcased community badges", "Präsentierte Community-Badges")}>
										{member.badges?.map((badge) => (
											<span
												className={`public-badge ${badge.rarity}`}
												title={`${locale === "en" ? badge.nameEn || badge.name : badge.name}: ${locale === "en" ? badge.descriptionEn || badge.description : badge.description}`}
												key={badge.id}
											>
												{badge.icon}
											</span>
										))}
									</span>
								)}
							</div>
							<a href={member.opgg || playerOpgg(member.name)} target="_blank" rel="noreferrer" title={`${member.name} ${text("on op.gg", "auf op.gg öffnen")}`}>
								<ExternalLink size={14} />
							</a>
						</div>
					))
				) : (
					<p className="muted-note">{text("The roster has not been published yet.", "Der Kader wird noch veröffentlicht.")}</p>
				)}
			</div>

			<footer className="team-card-footer">
				<a className="text-link" href={multiOpgg(team.members)} target="_blank" rel="noreferrer">
					Team op.gg <ExternalLink size={14} />
				</a>
				<button className="obs-copy-button" type="button" onClick={copyObsLink}>
					{copied ? <Check size={14} /> : <Copy size={14} />}
					{copied ? text("OBS link copied", "OBS-Link kopiert") : text("Copy OBS card", "OBS-Karte kopieren")}
					<Radio size={13} />
				</button>
			</footer>
		</article>
	);
}
