import client from "@/lib/db";
import { NextResponse } from "next/server";
import { resolveTournament } from "@/lib/tournament-slugs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const db = client.db();
		const tournament = await resolveTournament(db, id);
		const standings = tournament ? await db.collection("tournament_standings").find({ tournamentId: tournament.id }).project({ _id: 0 }).sort({ rank: 1, wins: -1 }).toArray() : [];
		return NextResponse.json({ standings });
	} catch {
		return NextResponse.json({ standings: [] });
	}
}
