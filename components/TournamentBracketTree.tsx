"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// Playoff tree with drawn paths: every match sits between the two matches that feed it,
// and a line shows where the winner goes. Loser drops are written on the card footer.
// Layout idea adapted from the Lauchgruen BracketTree, computed from the match wiring instead of the DOM.

export type TreeMatch = {
	id: string;
	stage: "group" | "playoff";
	placement?: "third_place";
	bracket?: "upper" | "lower" | "finals";
	matchType?: "standard" | "grand_final" | "bracket_reset";
	round: number;
	position: number;
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId?: string | null;
	scoreA: number;
	scoreB: number;
	status: string;
	bye?: boolean;
	nextMatchId?: string;
	nextSlot?: "teamAId" | "teamBId";
	loserNextMatchId?: string;
	loserNextSlot?: "teamAId" | "teamBId";
};

const CARD_W = 192;
const HEAD_H = 26;
const ROW_H = 30;
const FOOT_H = 22;
const CARD_H = HEAD_H + ROW_H * 2 + FOOT_H;
const COL_GAP = 48;
const SLOT = 124;
const LANE_HEAD = 58;
const COL_HEAD = 28;
const LANE_GAP = 40;

type Placed = { match: TreeMatch; x: number; y: number };
type ColumnLabel = { x: number; y: number; text: string };
type LaneTitle = { y: number; title: string; copy: string; width: number };

function laneOf(match: TreeMatch) {
	if (match.placement === "third_place") return "placement";
	return match.bracket ?? "main";
}

/** Places one lane: leaves get their own slot, every later match is centred on its feeders. */
function placeLane(matches: TreeMatch[], top: number) {
	const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
	const center = new Map<string, number>();
	let leaf = 0;
	for (const round of rounds) {
		for (const match of matches.filter((entry) => entry.round === round).sort((a, b) => a.position - b.position)) {
			const feeders = matches
				.filter((entry) => entry.nextMatchId === match.id && entry.matchType !== "grand_final")
				.map((entry) => center.get(entry.id))
				.filter((value): value is number => value !== undefined);
			center.set(match.id, feeders.length ? feeders.reduce((sum, value) => sum + value, 0) / feeders.length : leaf++);
		}
	}
	const cardsTop = top + LANE_HEAD + COL_HEAD;
	const placed = matches.map((match) => ({
		match,
		x: rounds.indexOf(match.round) * (CARD_W + COL_GAP),
		y: cardsTop + center.get(match.id)! * SLOT + (SLOT - CARD_H) / 2,
	}));
	return { placed, rounds, height: LANE_HEAD + COL_HEAD + Math.max(leaf, 1) * SLOT, columnTop: top + LANE_HEAD };
}

export function TournamentBracketTree({ matches, names, bestOf = 1 }: { matches: TreeMatch[]; names: Map<string, string>; bestOf?: number }) {
	const { text } = useLocale();
	const [selected, setSelected] = useState<string | null>(null);
	const select = (teamId: string | null) => setSelected((current) => (!teamId || current === teamId ? null : teamId));

	const layout = useMemo(() => {
		const placed: Placed[] = [];
		const columns: ColumnLabel[] = [];
		const titles: LaneTitle[] = [];
		const lanes = new Map<string, TreeMatch[]>();
		for (const match of matches) lanes.set(laneOf(match), [...(lanes.get(laneOf(match)) ?? []), match]);
		const isDouble = lanes.has("lower");
		let top = 0;
		let width = 0;
		const laneDefs = isDouble
			? [
					{
						key: "upper",
						title: "Winner Bracket",
						copy: text("Win and you stay on the direct path to the Grand Final.", "Wer gewinnt, bleibt auf dem direkten Weg ins Grand Final."),
						last: text("Winner final", "Winner-Finale"),
					},
					{
						key: "lower",
						title: "Loser Bracket",
						copy: text("One loss is allowed. The second one ends the run.", "Eine Niederlage ist erlaubt. Die zweite beendet das Turnier."),
						last: text("Loser final", "Loser-Finale"),
					},
				]
			: [
					{
						key: "main",
						title: text("Bracket", "Turnierbaum"),
						copy: text("Every loss ends the run. The winner moves along the line.", "Jede Niederlage beendet das Turnier. Wer gewinnt, folgt der Linie."),
						last: text("Final", "Finale"),
					},
				];
		const laneEnds: Record<string, Placed | undefined> = {};
		for (const def of laneDefs) {
			const laneMatches = lanes.get(def.key);
			if (!laneMatches?.length) continue;
			const lane = placeLane(laneMatches, top);
			titles.push({ y: top, title: def.title, copy: def.copy, width: lane.rounds.length * (CARD_W + COL_GAP) - COL_GAP });
			lane.rounds.forEach((round, index) => {
				const isLast = index === lane.rounds.length - 1;
				const isSemi = !isDouble && index === lane.rounds.length - 2;
				columns.push({
					x: index * (CARD_W + COL_GAP),
					y: lane.columnTop,
					text: isLast ? def.last : isSemi ? text("Semifinal", "Halbfinale") : `${text("Round", "Runde")} ${round}`,
				});
			});
			placed.push(...lane.placed);
			laneEnds[def.key] = lane.placed.filter((entry) => entry.match.round === lane.rounds.at(-1)).sort((a, b) => a.y - b.y)[0];
			width = Math.max(width, lane.rounds.length * (CARD_W + COL_GAP) - COL_GAP);
			top += lane.height + LANE_GAP;
		}
		const finals = (lanes.get("finals") ?? []).sort((a, b) => a.round - b.round);
		if (finals.length && laneEnds.upper && laneEnds.lower) {
			const centerY = (laneEnds.upper.y + laneEnds.lower.y) / 2;
			const x0 = width + COL_GAP;
			// The reset sits under the Grand Final so the tree stays narrow enough for a laptop screen.
			finals.forEach((match, index) => {
				const y = centerY + index * (CARD_H + COL_HEAD + 36);
				placed.push({ match, x: x0, y });
				columns.push({ x: x0, y: y - COL_HEAD - 4, text: match.matchType === "bracket_reset" ? text("Reset (if needed)", "Reset (falls nötig)") : "Grand Final" });
			});
			width = x0 + CARD_W;
		}
		const third = lanes.get("placement")?.[0];
		const final = laneEnds.main;
		if (third && final) {
			const y = final.y + CARD_H + COL_HEAD + 36;
			placed.push({ match: third, x: final.x, y });
			columns.push({ x: final.x, y: y - COL_HEAD - 4, text: text("Third place", "Spiel um Platz 3") });
			top = Math.max(top, y + CARD_H + LANE_GAP);
		}
		const height = Math.max(top - LANE_GAP, ...placed.map((entry) => entry.y + CARD_H)) + 8;
		return { placed, columns, titles, width, height };
	}, [matches, text]);

	const byId = new Map(layout.placed.map((entry) => [entry.match.id, entry]));
	const code = (match: TreeMatch) => {
		if (match.matchType === "grand_final") return "Grand Final";
		if (match.matchType === "bracket_reset") return "Reset";
		if (match.placement === "third_place") return text("Third place", "Platz 3");
		const prefix = match.bracket === "upper" ? "WB " : match.bracket === "lower" ? "LB " : "";
		return `${prefix}R${match.round} · M${match.position}`;
	};
	const placeholder = (match: TreeMatch, slot: "teamAId" | "teamBId") => {
		const winnerFrom = matches.find((entry) => entry.nextMatchId === match.id && entry.nextSlot === slot && entry.matchType !== "grand_final");
		if (winnerFrom) return `${text("Winner", "Sieger")} ${code(winnerFrom)}`;
		const loserFrom = matches.find((entry) => entry.loserNextMatchId === match.id && entry.loserNextSlot === slot);
		if (loserFrom) return `${text("Loser", "Verlierer")} ${code(loserFrom)}`;
		if (match.matchType === "bracket_reset")
			return slot === "teamAId" ? text("Winner bracket team", "Team aus dem Winner Bracket") : text("Loser bracket team", "Team aus dem Loser Bracket");
		return text("TBD", "Noch offen");
	};
	const route = (match: TreeMatch) => {
		if (match.matchType === "grand_final") return text("If the loser-bracket team wins: reset", "Gewinnt das LB-Team: Reset");
		if (match.matchType === "bracket_reset") return text("Decides the title", "Entscheidet den Titel");
		if (match.placement === "third_place") return text("Winner takes third place", "Sieger wird Dritter");
		const loserTarget = match.loserNextMatchId ? matches.find((entry) => entry.id === match.loserNextMatchId) : undefined;
		if (loserTarget) return `${text("Loser", "Verlierer")} → ${code(loserTarget)}`;
		if (!match.nextMatchId && match.bracket !== "lower") return text("Winner takes the title", "Sieger holt den Titel");
		return text("Loser is out", "Verlierer scheidet aus");
	};
	const involves = (match: TreeMatch) => Boolean(selected && (match.teamAId === selected || match.teamBId === selected));

	const paths = layout.placed.flatMap(({ match, x, y }) => {
		if (!match.nextMatchId) return [];
		const target = byId.get(match.nextMatchId);
		if (!target) return [];
		const x1 = x + CARD_W;
		const y1 = y + CARD_H / 2;
		const x2 = target.x;
		const reset = match.matchType === "grand_final";
		const decided = match.status === "completed" || Boolean(match.bye);
		const highlighted = Boolean(selected && match.winnerTeamId === selected && involves(target.match));
		if (reset) return [{ key: match.id, d: `M ${x + CARD_W / 2} ${y + CARD_H} V ${target.y}`, decided, highlighted, dashed: true }];
		const y2 = target.y + HEAD_H + (match.nextSlot === "teamBId" ? ROW_H * 1.5 : ROW_H / 2);
		const midX = x2 - COL_GAP / 2;
		return [{ key: match.id, d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`, decided, highlighted, dashed: false }];
	});

	const teamIds = [...new Set(matches.flatMap((match) => [match.teamAId, match.teamBId]).filter((id): id is string => Boolean(id)))].sort((a, b) =>
		(names.get(a) || "").localeCompare(names.get(b) || "", "de")
	);

	return (
		<div className="bracket-tree">
			{teamIds.length > 1 ? (
				<div className="bracket-tree-teams" role="group" aria-label={text("Highlight a team", "Team hervorheben")}>
					<span>{text("Follow a team", "Team verfolgen")}</span>
					{teamIds.map((teamId) => (
						<button type="button" key={teamId} aria-pressed={selected === teamId} onClick={() => select(teamId)}>
							{names.get(teamId) || "Team"}
						</button>
					))}
				</div>
			) : null}
			<div className="bracket-tree-scroll">
				<div className={`bracket-tree-canvas ${selected ? "is-filtering" : ""}`} style={{ width: layout.width, height: layout.height }}>
					<svg className="bracket-tree-lines" width={layout.width} height={layout.height} aria-hidden="true">
						{paths.map((path) => (
							<path
								key={path.key}
								d={path.d}
								className={`${path.decided ? "is-decided" : ""} ${path.highlighted ? "is-highlighted" : ""}`}
								strokeDasharray={path.dashed ? "5 5" : undefined}
							/>
						))}
					</svg>
					{layout.titles.map((title) => (
						<header className="bracket-tree-lane" key={title.title} style={{ top: title.y, width: title.width }}>
							<strong>{title.title}</strong>
							<span>{title.copy}</span>
						</header>
					))}
					{layout.columns.map((column) => (
						<span className="bracket-tree-column" key={`${column.x}-${column.y}`} style={{ left: column.x, top: column.y, width: CARD_W }}>
							{column.text}
						</span>
					))}
					{layout.placed.map(({ match, x, y }) => {
						const skipped = match.status === "skipped";
						const conditional = match.status === "conditional";
						const done = match.status === "completed";
						const final = match.matchType === "grand_final" || match.matchType === "bracket_reset" || (!match.nextMatchId && laneOf(match) === "main");
						const chip = match.bye ? text("Bye", "Freilos") : skipped ? text("Not needed", "Entfällt") : conditional ? text("If needed", "Falls nötig") : `Bo${bestOf}`;
						return (
							<article
								key={match.id}
								className={`bracket-tree-card ${done ? "is-done" : ""} ${skipped ? "is-skipped" : ""} ${final ? "is-final" : ""} ${involves(match) ? "is-highlighted" : selected ? "is-dimmed" : ""}`}
								style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
							>
								<header>
									<span>{code(match)}</span>
									<small>{chip}</small>
								</header>
								{(["teamAId", "teamBId"] as const).map((slot) => {
									const teamId = match[slot];
									const score = slot === "teamAId" ? match.scoreA : match.scoreB;
									const winner = done && teamId && match.winnerTeamId === teamId;
									const loser = done && teamId && match.winnerTeamId && match.winnerTeamId !== teamId;
									return (
										<div
											className={`bracket-tree-row ${winner ? "is-winner" : ""} ${loser ? "is-loser" : ""} ${teamId && teamId === selected ? "is-selected" : ""}`}
											key={slot}
										>
											{teamId ? (
												<button type="button" onClick={() => select(teamId)} title={names.get(teamId)}>
													{names.get(teamId) || "Team"}
												</button>
											) : (
												<em>{match.bye && slot === "teamBId" ? text("Bye", "Freilos") : placeholder(match, slot)}</em>
											)}
											<b>{done ? score : "–"}</b>
										</div>
									);
								})}
								<footer>{route(match)}</footer>
							</article>
						);
					})}
				</div>
			</div>
		</div>
	);
}
