"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { CalendarDays, Swords, Users } from "lucide-react";
import { TournamentHeader } from "@/components/TournamentHeader";
import { PublicTeam, TournamentTeamCard } from "@/components/TournamentTeamCard";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const fetcher = (url: string) => fetch(url).then((response) => response.json());
type View = "schedule" | "groups" | "playoffs" | "teams" | "rules";
type Match = {
	id: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	bracket?: "upper" | "lower" | "finals";
	matchType?: "standard" | "grand_final" | "bracket_reset";
	groupId?: string;
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId?: string | null;
	scoreA: number;
	scoreB: number;
	status: string;
	scheduledAt: string | null;
};
type Standing = { groupId?: string; rank: number; teamId: string; teamName: string; wins: number; losses: number; points: number };

function matchLabel(match: Match, locale: Locale) {
	if (match.placement === "third_place") return locale === "en" ? "Third-place match" : "Spiel um Platz 3";
	if (match.stage === "group") return `${locale === "en" ? "Round" : "Runde"} ${match.round}`;
	if (match.matchType === "grand_final") return "Grand Final";
	if (match.matchType === "bracket_reset") return "Grand Final Reset";
	if (match.bracket === "upper") return `Winner Bracket · ${locale === "en" ? "Round" : "Runde"} ${match.round}`;
	if (match.bracket === "lower") return `Loser Bracket · ${locale === "en" ? "Round" : "Runde"} ${match.round}`;
	if (match.round === 1) return locale === "en" ? "Semifinal" : "Halbfinale";
	return locale === "en" ? "Final" : "Finale";
}

const viewMeta = {
	schedule: {
		en: { kicker: "Schedule", title: "All matchups and dates", copy: "Tournament staff update pairings, start times, and results here." },
		de: { kicker: "Spielplan", title: "Alle Paarungen und Termine", copy: "Ansetzungen, Startzeiten und Ergebnisse werden hier von der Turnierleitung aktualisiert." },
	},
	groups: {
		en: { kicker: "Group stage", title: "Standings and groups", copy: "All groups, wins, and placements at a glance." },
		de: { kicker: "Gruppenphase", title: "Tabellen und Gruppen", copy: "Alle Gruppen, Siege und Platzierungen auf einen Blick." },
	},
	playoffs: {
		en: { kicker: "Playoffs", title: "The path to the final", copy: "A visual bracket shows matchups, results, and progression." },
		de: { kicker: "Playoffs", title: "Der Weg bis ins Finale", copy: "Ein visueller Turnierbaum zeigt Paarungen, Ergebnisse und das Weiterkommen." },
	},
	teams: {
		en: { kicker: "Participants", title: "Teams and rosters", copy: "Riot IDs, op.gg profiles, team multisearch, and copyable OBS cards for streamers." },
		de: { kicker: "Teilnehmerfeld", title: "Teams und ihre Kader", copy: "Riot-IDs, op.gg-Profile, Team-Multisearch und kopierbare OBS-Karten für Streamer." },
	},
	rules: {
		en: { kicker: "Rules", title: "Play fair, have fun together", copy: "The complete rules for participants, streamers, and viewers." },
		de: { kicker: "Regelwerk", title: "Fair spielen, gemeinsam Spaß haben", copy: "Das vollständige Regelwerk für Teilnehmer, Streamer und Zuschauer." },
	},
};

function MatchSchedule({ matches, names }: { matches: Match[]; names: Map<string, string> }) {
	const { locale, text } = useLocale();
	if (!matches.length)
		return (
			<Empty
				icon={CalendarDays}
				title={text("No matches scheduled yet", "Noch keine Matches angesetzt")}
				copy={text(
					"Tournament staff will publish the schedule once every pairing is confirmed.",
					"Die Turnierleitung veröffentlicht den Spielplan, sobald alle Paarungen feststehen."
				)}
			/>
		);
	return (
		<div className="match-list">
			{matches.map((match) => (
				<article className="match-row" key={match.id}>
					<div>
						<small>{matchLabel(match, locale)}</small>
						<time>
							{match.scheduledAt
								? new Date(match.scheduledAt).toLocaleString(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" })
								: text("Date to be announced", "Termin folgt")}
						</time>
					</div>
					<strong>{match.teamAId ? names.get(match.teamAId) || "Team A" : text("TBD", "Noch offen")}</strong>
					<b>{match.status === "completed" ? `${match.scoreA} : ${match.scoreB}` : "vs."}</b>
					<strong>{match.teamBId ? names.get(match.teamBId) || "Team B" : text("TBD", "Noch offen")}</strong>
					<span className={`status-pill ${match.status === "completed" ? "completed" : ""}`}>
						{match.status === "completed" ? text("Completed", "Beendet") : text("Scheduled", "Geplant")}
					</span>
				</article>
			))}
		</div>
	);
}

function BracketLane({ matches, names }: { matches: Match[]; names: Map<string, string> }) {
	const { locale, text } = useLocale();
	const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
	return (
		<div className="visual-bracket">
			{rounds.map((round, roundIndex) => (
				<section className="bracket-column" key={round}>
					<header>
						<span>
							{text("Round", "Runde")} {round}
						</span>
						<h2>
							{matches[0]?.bracket === "finals"
								? round === 1
									? "Grand Final"
									: "Reset"
								: roundIndex === rounds.length - 1
									? text("Final", "Finale")
									: rounds.length === 2
										? text("Semifinal", "Halbfinale")
										: `${text("Round", "Runde")} ${round}`}
						</h2>
					</header>
					<div className="bracket-column-matches">
						{matches
							.filter((match) => match.round === round)
							.map((match) => (
								<article className={`bracket-match ${match.placement === "third_place" ? "is-placement" : ""}`} key={match.id}>
									<small className="bracket-match-label">{matchLabel(match, locale)}</small>
									<div className={match.winnerTeamId && match.winnerTeamId === match.teamAId ? "winner" : ""}>
										<span>{match.teamAId ? names.get(match.teamAId) || "Team A" : text("TBD", "Noch offen")}</span>
										<b>{match.status === "completed" ? match.scoreA : "–"}</b>
									</div>
									<div className={match.winnerTeamId && match.winnerTeamId === match.teamBId ? "winner" : ""}>
										<span>{match.teamBId ? names.get(match.teamBId) || "Team B" : text("TBD", "Noch offen")}</span>
										<b>{match.status === "completed" ? match.scoreB : "–"}</b>
									</div>
								</article>
							))}
					</div>
				</section>
			))}
		</div>
	);
}

function Bracket({ matches, names }: { matches: Match[]; names: Map<string, string> }) {
	const { text } = useLocale();
	if (!matches.length)
		return (
			<Empty
				icon={Swords}
				title={text("The bracket is being prepared", "Der Turnierbaum wird vorbereitet")}
				copy={text(
					"Tournament staff will publish every pairing once the teams are confirmed.",
					"Sobald die Teams feststehen, veröffentlicht die Turnierleitung alle Paarungen."
				)}
			/>
		);
	const hasDoubleElimination = matches.some((match) => match.bracket === "lower");
	if (!hasDoubleElimination) return <BracketLane matches={matches} names={names} />;
	const lanes = [
		{ key: "upper", title: "Winner Bracket", copy: text("Winners stay on the direct path to the Grand Final.", "Wer gewinnt, bleibt auf dem direkten Weg ins Grand Final.") },
		{
			key: "lower",
			title: "Loser Bracket",
			copy: text("After a loss, this bracket offers a second chance to reach the final.", "Nach einer Niederlage bleibt hier die zweite Chance auf das Finale."),
		},
		{
			key: "finals",
			title: "Grand Final",
			copy: text("The Winner Bracket champion meets the Loser Bracket champion.", "Der Sieger des Winner Brackets trifft auf den Sieger des Loser Brackets."),
		},
	] as const;
	return (
		<div className="double-elimination-bracket">
			{lanes.map((lane) => {
				const laneMatches = matches.filter((match) => match.bracket === lane.key && match.status !== "skipped");
				return laneMatches.length ? (
					<section className={`bracket-lane bracket-lane-${lane.key}`} key={lane.key}>
						<header>
							<span>{lane.title}</span>
							<p>{lane.copy}</p>
						</header>
						<BracketLane matches={laneMatches} names={names} />
					</section>
				) : null;
			})}
		</div>
	);
}

function Empty({ icon: Icon, title, copy }: { icon: typeof Swords; title: string; copy: string }) {
	return (
		<div className="empty-state">
			<Icon size={36} />
			<h3>{title}</h3>
			<p>{copy}</p>
		</div>
	);
}

export function TournamentPublicView({ view }: { view: View }) {
	const { locale, text } = useLocale();
	const { id } = useParams<{ id: string }>();
	const { data: tournamentData } = useSWR<{ tournament: { title: string; rules: string[]; game: string } }>(`/api/tournaments/${id}`, fetcher);
	const { data: teamsData } = useSWR<{ teams: PublicTeam[] }>(`/api/tournaments/${id}/teams`, fetcher);
	const { data: matchesData } = useSWR<{ matches: Match[] }>(`/api/tournaments/${id}/matches`, fetcher);
	const { data: groupsData } = useSWR<{ groups: { id: string; name: string }[]; standings: Standing[] }>(`/api/tournaments/${id}/groups`, fetcher);
	const teams = teamsData?.teams || [];
	const matches = matchesData?.matches || [];
	const names = new Map(teams.map((team) => [team.id, team.name]));
	const meta = viewMeta[view][locale];

	return (
		<>
			<TournamentHeader
				id={id}
				active={view}
				kicker={`${tournamentData?.tournament.title || text("Tournament", "Turnier")} · ${meta.kicker}`}
				title={meta.title}
				copy={meta.copy}
			/>
			<section className="content-band tournament-view">
				{view === "schedule" && <MatchSchedule matches={matches} names={names} />}
				{view === "playoffs" && <Bracket matches={matches.filter((match) => match.stage === "playoff")} names={names} />}
				{view === "teams" &&
					(teams.length ? (
						<div className="tournament-team-grid">
							{teams.map((team) => (
								<TournamentTeamCard tournamentId={id} team={team} key={team.id} />
							))}
						</div>
					) : (
						<Empty
							icon={Users}
							title={text("No teams published yet", "Noch keine Teams veröffentlicht")}
							copy={text("Confirmed rosters appear after tournament staff approve them.", "Bestätigte Kader erscheinen nach der Freigabe durch die Turnierleitung.")}
						/>
					))}
				{view === "groups" &&
					((groupsData?.groups || []).length ? (
						<div className="groups-grid">
							{groupsData?.groups.map((group) => (
								<article className="group-table" key={group.id}>
									<h2>{group.name}</h2>
									{(groupsData.standings || [])
										.filter((standing) => standing.groupId === group.id)
										.map((standing) => (
											<div className="standings-row" key={standing.teamId}>
												<span>#{standing.rank}</span>
												<strong>{standing.teamName}</strong>
												<span>
													{standing.wins} {text("W", "S")}
												</span>
												<span>{standing.points} P</span>
											</div>
										))}
								</article>
							))}
						</div>
					) : (
						<Empty
							icon={Users}
							title={text("This tournament has no groups", "Dieses Turnier hat keine Gruppen")}
							copy={text("A playoffs-only format leads directly into the bracket.", "Bei einem reinen Playoff-Format führt der Weg direkt in den Turnierbaum.")}
						/>
					))}
				{view === "rules" &&
					((tournamentData?.tournament.rules || []).length ? (
						<div className="tournament-rules">
							{(tournamentData?.tournament.rules || []).map((rule, index) =>
								rule.startsWith("## ") ? (
									<h2 key={`${rule}-${index}`}>{rule.slice(3)}</h2>
								) : (
									<div className="rule-item" key={`${rule}-${index}`}>
										<span className="rule-number">{String(index + 1).padStart(2, "0")}</span>
										<span className="rule-text">{rule}</span>
									</div>
								)
							)}
						</div>
					) : (
						<Empty
							icon={Swords}
							title={text("The rules are being prepared", "Das Regelwerk wird vorbereitet")}
							copy={text(
								"All binding ARAM MAYHEM rules will appear here before registration opens.",
								"Alle verbindlichen ARAM-MAYHEM-Regeln erscheinen hier, bevor die Anmeldung geöffnet wird."
							)}
						/>
					))}
			</section>
		</>
	);
}
