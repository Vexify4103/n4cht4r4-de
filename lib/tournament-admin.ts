import { auth } from "@/auth";
import client from "@/lib/db";
import { resolveTournamentStaffRole, tournamentRoleRank, type TournamentStaffRole } from "@/lib/tournament-staff";
import { ObjectId } from "mongodb";

export type { TournamentStaffRole } from "@/lib/tournament-staff";

export type TournamentAdminContext = {
	userId: string;
	discordId: string | null;
	role: TournamentStaffRole;
};

export async function getTournamentAdminContext(): Promise<TournamentAdminContext | null> {
	const session = await auth();
	if (!session?.user?.id || !ObjectId.isValid(session.user.id)) return null;

	await client.connect();
	const db = client.db();
	const userId = session.user.id;
	const userObjectId = new ObjectId(userId);
	const discordAccount = await db.collection("accounts").findOne({ userId: userObjectId, provider: "discord" });
	const discordId = typeof discordAccount?.providerAccountId === "string" ? discordAccount.providerAccountId : null;
	const role = await resolveTournamentStaffRole(db, userId, discordId);
	return role ? { userId, discordId, role } : null;
}

export async function hasTournamentPermission(minimumRole: TournamentStaffRole = "viewer") {
	const context = await getTournamentAdminContext();
	return context && tournamentRoleRank[context.role] >= tournamentRoleRank[minimumRole] ? context : null;
}
