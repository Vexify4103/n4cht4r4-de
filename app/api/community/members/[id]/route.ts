import client from "@/lib/db";
import { getPublicBadgeShowcases } from "@/lib/public-badges";
import { publicTournamentId } from "@/lib/tournament-slugs";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TeamMember = { userId?: string };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Community-Profil nicht gefunden." }, { status: 404 });

	await client.connect();
	const db = client.db();
	const user = await db.collection("users").findOne({ _id: new ObjectId(id) }, { projection: { name: 1, image: 1, createdAt: 1 } });
	if (!user) return NextResponse.json({ error: "Community-Profil nicht gefunden." }, { status: 404 });

	const [badgeMap, posts, teamDocuments] = await Promise.all([
		getPublicBadgeShowcases(db, [id]),
		db
			.collection("community_posts")
			.find({ userId: id, status: "published" })
			.project({ _id: 0, id: 1, kind: 1, title: 1, body: 1, mediaId: 1, publishedAt: 1 })
			.sort({ publishedAt: -1 })
			.limit(12)
			.toArray(),
		db
			.collection("tournament_teams")
			.find({ published: { $ne: false }, $or: [{ "publicMembers.userId": id }, { "members.userId": id }] })
			.project({ _id: 0, id: 1, tournamentId: 1, name: 1, publicName: 1, members: 1, publicMembers: 1 })
			.toArray(),
	]);

	const tournamentIds = [...new Set(teamDocuments.map((team) => String(team.tournamentId || "")).filter(Boolean))];
	const tournaments = tournamentIds.length
		? await db
				.collection("tournaments")
				.find({ id: { $in: tournamentIds } })
				.project({ _id: 0, id: 1, slug: 1, title: 1, status: 1, startsAt: 1, date: 1, championTeamId: 1 })
				.toArray()
		: [];
	const tournamentById = new Map(tournaments.map((tournament) => [String(tournament.id), tournament]));

	return NextResponse.json(
		{
			member: {
				id,
				name: typeof user.name === "string" && user.name.trim() ? user.name : "Community-Mitglied",
				image: typeof user.image === "string" ? user.image : null,
				memberSince: user.createdAt || null,
				badges: badgeMap.get(id) || [],
			},
			posts: posts.map(({ mediaId, ...post }) => ({ ...post, mediaUrl: mediaId ? `/api/community/media/${mediaId}` : null })),
			tournaments: teamDocuments
				.map((team) => {
					const tournament = tournamentById.get(String(team.tournamentId));
					if (!tournament) return null;
					const members = (Array.isArray(team.publicMembers) ? team.publicMembers : team.members) as TeamMember[] | undefined;
					if (!members?.some((member) => member.userId === id)) return null;
					return {
						id: String(tournament.id),
						title: String(tournament.title || "Turnier"),
						href: `/tournaments/${publicTournamentId(tournament)}`,
						status: String(tournament.status || "announcement"),
						date: tournament.startsAt || tournament.date || null,
						teamName: String(team.publicName || team.name || "Team"),
						won: tournament.championTeamId === team.id,
					};
				})
				.filter((entry) => entry !== null)
				.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
		},
		{ headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
	);
}
