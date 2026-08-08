import { auth } from "@/auth";
import client from "@/lib/db";
import { ACTIVE_APPLICATION_STATUSES, ensureTournamentCommunityIndexes, TournamentNotification, TournamentWishGroup } from "@/lib/tournament-community";
import { publicTournamentId } from "@/lib/tournament-slugs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
	const userId = session.user.id;
	await client.connect();
	const db = client.db();
	await ensureTournamentCommunityIndexes(db);
	const applications = await db
		.collection("tournament_applications")
		.find({ userId, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } })
		.project({ _id: 0 })
		.sort({ createdAt: -1 })
		.toArray();
	const tournamentIds = [...new Set(applications.map((application) => String(application.tournamentId)))];
	const [tournaments, groups, notifications] = await Promise.all([
		tournamentIds.length
			? db
					.collection("tournaments")
					.find({ id: { $in: tournamentIds } })
					.project({ _id: 0 })
					.toArray()
			: [],
		db.collection<TournamentWishGroup>("tournament_wish_groups").find({ memberUserIds: userId }).project({ _id: 0 }).toArray(),
		db.collection<TournamentNotification>("tournament_notifications").find({ userId }).project({ _id: 0 }).sort({ createdAt: -1 }).limit(30).toArray(),
	]);
	const tournamentById = new Map(tournaments.map((tournament) => [String(tournament.id), tournament]));
	const memberIds = [...new Set(groups.flatMap((group) => group.memberUserIds))];
	const memberApplications = memberIds.length
		? await db
				.collection("tournament_applications")
				.find({ userId: { $in: memberIds }, tournamentId: { $in: tournamentIds }, status: { $in: [...ACTIVE_APPLICATION_STATUSES] } })
				.project({ _id: 0, userId: 1, tournamentId: 1, riotId: 1 })
				.toArray()
		: [];
	const memberName = new Map(memberApplications.map((application) => [`${application.tournamentId}:${application.userId}`, String(application.riotId || "Unbekannt")]));

	return NextResponse.json({
		applications: applications.map((application) => {
			const tournament = tournamentById.get(String(application.tournamentId));
			return {
				...application,
				title: String(tournament?.title || "Turnier"),
				tournamentSlug: tournament ? publicTournamentId(tournament) : String(application.tournamentId),
				registrationOpen: tournament?.registrationOpen === true,
				wishGroupMode: tournament?.wishGroupMode || "disabled",
				wishGroupLimit: tournament ? (tournament.wishGroupMode === "duo" ? 2 : Number(tournament.teamSize || 5)) : 0,
			};
		}),
		groups: groups.map((group) => ({
			...group,
			members: group.memberUserIds.map((memberUserId: string) => ({ userId: memberUserId, riotId: memberName.get(`${group.tournamentId}:${memberUserId}`) || "Unbekannt" })),
			isOwner: group.ownerUserId === userId,
		})),
		notifications,
	});
}
