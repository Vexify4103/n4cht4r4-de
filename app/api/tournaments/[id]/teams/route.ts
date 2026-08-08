import client from "@/lib/db";
import { resolveTournament } from "@/lib/tournament-slugs";
import { getPublicBadgeShowcases } from "@/lib/public-badges";
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
		const publicMembers: Record<string, unknown>[] = documents.flatMap((team) => {
			const members = Array.isArray(team.publicMembers) ? team.publicMembers : team.members;
			return Array.isArray(members) ? (members as Record<string, unknown>[]) : [];
		});
		const badgeShowcases = await getPublicBadgeShowcases(
			client.db(),
			publicMembers.map((member) => (typeof member.userId === "string" ? member.userId : ""))
		);
		const teams = documents.map((team) => {
			const rawMembers = Array.isArray(team.publicMembers) ? team.publicMembers : team.members;
			const members = Array.isArray(rawMembers) ? (rawMembers as Record<string, unknown>[]) : [];
			return {
				id: String(team.id),
				name: typeof team.publicName === "string" ? team.publicName : String(team.name || "Team"),
				seed: typeof team.publicSeed === "number" ? team.publicSeed : typeof team.seed === "number" ? team.seed : null,
				members: members.map((member) => ({
					name: String(member.name || "Spieler"),
					role: typeof member.role === "string" ? member.role : undefined,
					opgg: typeof member.opgg === "string" ? member.opgg : undefined,
					champs: Array.isArray(member.champs) ? member.champs.filter((champ: unknown): champ is string => typeof champ === "string").slice(0, 3) : [],
					badges: typeof member.userId === "string" ? badgeShowcases.get(member.userId) || [] : [],
				})),
			};
		});
		return NextResponse.json({ teams });
	} catch {
		return NextResponse.json({ teams: [] });
	}
}
