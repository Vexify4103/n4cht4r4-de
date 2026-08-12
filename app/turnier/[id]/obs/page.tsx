"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Flower2, Swords, Trophy } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type Team = { id: string; name: string };
type Match = { teamAId: string | null; teamBId: string | null; scoreA: number; scoreB: number; status: string; round: number };

function OBSContent() {
	const { text } = useLocale();
	const { id } = useParams<{ id: string }>();
	const teamId = useSearchParams().get("team");
	useEffect(() => {
		document.body.classList.add("obs-page");
		return () => document.body.classList.remove("obs-page");
	}, []);

	const { data: teamsData } = useSWR<{ teams: Team[] }>(`/api/tournaments/${id}/teams`, fetcher, { refreshInterval: 30_000 });
	const { data: matchesData } = useSWR<{ matches: Match[] }>(`/api/tournaments/${id}/matches`, fetcher, { refreshInterval: 30_000 });
	const teams = teamsData?.teams || [];
	const matches = matchesData?.matches || [];
	const team = teams.find((entry) => entry.id === teamId);
	const played = matches.filter((match) => teamId && match.status === "completed" && (match.teamAId === teamId || match.teamBId === teamId));
	const wins = played.filter((match) => (match.teamAId === teamId ? match.scoreA > match.scoreB : match.scoreB > match.scoreA)).length;
	const next = matches.find((match) => teamId && match.status !== "completed" && (match.teamAId === teamId || match.teamBId === teamId));
	const opponentId = next?.teamAId === teamId ? next.teamBId : next?.teamAId;
	const opponent = teams.find((entry) => entry.id === opponentId);

	return (
		<div className="obs-overlay-page">
			<article className="obs-team-card">
				<header className="obs-card-header">
					<Flower2 size={16} />
					<span>{text("Tournament update", "Turnier-Update")}</span>
				</header>
				<h1>{team?.name || text("Loading team", "Team wird geladen")}</h1>
				<div className="obs-card-stat">
					<Swords size={17} />
					<div>
						<span>{text("Next opponent", "Nächster Gegner")}</span>
						<strong>{opponent?.name || text("To be determined", "Wird bestimmt")}</strong>
						{next && <small>{next.round === 1 ? text("Semifinal", "Halbfinale") : text("Final", "Finale")} · Best of 3</small>}
					</div>
				</div>
				<div className="obs-card-stat">
					<Trophy size={17} />
					<div>
						<span>{text("Record", "Bilanz")}</span>
						<strong>
							{wins} {text(wins === 1 ? "win" : "wins", wins === 1 ? "Sieg" : "Siege")} · {played.length - wins}{" "}
							{text(played.length - wins === 1 ? "loss" : "losses", played.length - wins === 1 ? "Niederlage" : "Niederlagen")}
						</strong>
					</div>
				</div>
			</article>
		</div>
	);
}

export default function OBSPage() {
	return (
		<Suspense fallback={null}>
			<OBSContent />
		</Suspense>
	);
}
