import client from "@/lib/db";
import { announcedTournaments, isTournamentStatus, TournamentRecord } from "@/lib/tournaments";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeTournament(value: Record<string, unknown>): TournamentRecord | null {
	if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.game !== "string" || typeof value.format !== "string" || !isTournamentStatus(value.status)) {
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const document = await resolveTournament(client.db(), id);
		if (document && document.published === false) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		const tournament = document ? normalizeTournament(document) : announcedTournaments.find((entry) => entry.id === id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		return NextResponse.json({ tournament: document ? { ...tournament, id: publicTournamentId(document) } : tournament });
	} catch {
		const tournament = announcedTournaments.find((entry) => entry.id === id);
		if (!tournament) return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
		return NextResponse.json({ tournament });
	}
}
