import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const tournament = await resolveTournament(client.db(), id);
		const teams = tournament ? await client.db().collection("tournament_teams").find({ tournamentId: tournament.id, published: { $ne: false } }).project({ _id: 0 }).sort({ name: 1 }).toArray() : [];
		return NextResponse.json({ teams });
	} catch {
		return NextResponse.json({ teams: [] });
	}
}
