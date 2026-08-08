import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		await client.connect();
		const tournament = await resolveTournament(client.db(), id);
		const documents = tournament
			? await client
					.db()
					.collection("tournament_teams")
					.find({ tournamentId: tournament.id, published: { $ne: false } })
					.project({ _id: 0 })
					.sort({ publicSeed: 1, publicName: 1, name: 1 })
					.toArray()
			: [];
		const teams = documents.map((team) => ({
			...team,
			name: typeof team.publicName === "string" ? team.publicName : team.name,
			seed: typeof team.publicSeed === "number" ? team.publicSeed : team.seed,
			members: Array.isArray(team.publicMembers) ? team.publicMembers : team.members,
		}));
		return NextResponse.json({ teams });
	} catch {
		return NextResponse.json({ teams: [] });
	}
}
