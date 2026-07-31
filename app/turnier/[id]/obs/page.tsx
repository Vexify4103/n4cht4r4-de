"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Flower2, Swords, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type Team = { id: string; name: string };
type Match = { teamAId: string | null; teamBId: string | null; scoreA: number; scoreB: number; status: string; round: number };

function OBSContent() {
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
	const wins = played.filter((match) => match.teamAId === teamId ? match.scoreA > match.scoreB : match.scoreB > match.scoreA).length;
	const next = matches.find((match) => teamId && match.status !== "completed" && (match.teamAId === teamId || match.teamBId === teamId));
	const opponentId = next?.teamAId === teamId ? next.teamBId : next?.teamAId;
	const opponent = teams.find((entry) => entry.id === opponentId);

	return (
		<div className="obs-overlay-page">
			<article className="obs-team-card">
				<header className="obs-card-header"><Flower2 size={16} /><span>Turnier-Update</span></header>
				<h1>{team?.name || "Team wird geladen"}</h1>
				<div className="obs-card-stat">
					<Swords size={17} />
					<div><span>Nächster Gegner</span><strong>{opponent?.name || "Wird bestimmt"}</strong>{next && <small>{next.round === 1 ? "Halbfinale" : "Finale"} · Best of 3</small>}</div>
				</div>
				<div className="obs-card-stat">
					<Trophy size={17} />
					<div><span>Bilanz</span><strong>{wins} Sieg{wins === 1 ? "" : "e"} · {played.length - wins} Niederlage{played.length - wins === 1 ? "" : "n"}</strong></div>
				</div>
			</article>
		</div>
	);
}

export default function OBSPage() {
	return <Suspense fallback={null}><OBSContent /></Suspense>;
}
