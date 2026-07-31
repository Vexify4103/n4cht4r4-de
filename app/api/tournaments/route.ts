import client from "@/lib/db";
import { announcedTournaments, isTournamentStatus, TournamentRecord } from "@/lib/tournaments";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeTournament(value: Record<string, unknown>): TournamentRecord | null {
	if (
		typeof value.id !== "string" ||
		typeof value.title !== "string" ||
		typeof value.game !== "string" ||
		typeof value.format !== "string" ||
		!isTournamentStatus(value.status)
	) {
		return null;
	}

	return {
		id: value.id,
		title: value.title,
		game: value.game,
		format: value.format,
		status: value.status,
		date: typeof value.date === "string" ? value.date : null,
		maxTeams: typeof value.maxTeams === "number" ? value.maxTeams : 0,
		currentTeams: typeof value.currentTeams === "number" ? value.currentTeams : 0,
		registrationOpen: value.registrationOpen === true,
		rules: Array.isArray(value.rules) ? value.rules.filter((rule): rule is string => typeof rule === "string") : [],
	};
}

export async function GET() {
	try {
		await client.connect();
		const db = client.db();
		const records = await db.collection("tournaments").find({ published: { $ne: false } }).sort({ date: 1 }).toArray();
		const resolvedRecords = await Promise.all(records.map(async (record) => await resolveTournament(db, String(record.id)) || record));
		const tournaments = resolvedRecords
			.map((record) => {
				const normalized = normalizeTournament(record);
				return normalized ? { ...normalized, id: publicTournamentId(record) } : null;
			})
			.filter((record): record is TournamentRecord => Boolean(record));
		return NextResponse.json({ tournaments: tournaments.length > 0 ? tournaments : announcedTournaments });
	} catch {
		return NextResponse.json({ tournaments: announcedTournaments });
	}
}
