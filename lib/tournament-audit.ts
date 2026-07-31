import { Db } from "mongodb";
import { TournamentAdminContext } from "@/lib/tournament-admin";

export async function recordTournamentAudit(db: Db, context: TournamentAdminContext, tournamentId: string, action: string, details: Record<string, unknown> = {}) {
	await db.collection("tournament_audit_log").insertOne({
		tournamentId,
		actorUserId: context.userId,
		actorDiscordId: context.discordId,
		actorRole: context.role,
		action,
		details,
		createdAt: new Date(),
	});
}
