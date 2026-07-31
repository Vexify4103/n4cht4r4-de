import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const tournament = await resolveTournament(client.db(), id);
		const tournamentId = tournament?.id;
		const groups = tournamentId ? await client.db().collection("tournament_groups").find({ tournamentId }).project({ _id: 0 }).sort({ name: 1 }).toArray() : [];
		const standings = tournamentId ? await client.db().collection("tournament_standings").find({ tournamentId }).project({ _id: 0 }).sort({ groupId: 1, rank: 1 }).toArray() : [];
		return NextResponse.json({ groups, standings });
	} catch {
		return NextResponse.json({ groups: [], standings: [] });
	}
}
