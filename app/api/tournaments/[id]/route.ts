import client from "@/lib/db";
import { announcedTournaments, normalizeTournament } from "@/lib/tournaments";
import { publicTournamentId, resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
