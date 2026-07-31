import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const tournament = await resolveTournament(client.db(), id);
		const matches = tournament ? await client.db().collection("tournament_matches").find({ tournamentId: tournament.id }).project({ _id: 0 }).sort({ stage: 1, groupId: 1, round: 1, position: 1 }).toArray() : [];
		return NextResponse.json({ matches });
	} catch {
		return NextResponse.json({ matches: [] });
	}
}
