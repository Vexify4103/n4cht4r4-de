import { Db } from "mongodb";
import { enqueueDiscordNotification } from "@/lib/discord-queue";
import { TournamentNotification } from "@/lib/tournament-community";

export async function createTournamentNotification(db: Db, input: { userId: string; tournamentId: string; type: string; title: string; body: string; href?: string }) {
	const application = await db.collection("tournament_applications").findOne({ userId: input.userId, tournamentId: input.tournamentId });
	const discordEnabled = Boolean(process.env.DISCORD_BOT_TOKEN?.trim()) && application?.discordDmOptIn === true;
	const notification: TournamentNotification = {
		id: `notice_${crypto.randomUUID()}`,
		userId: input.userId,
		tournamentId: input.tournamentId,
		type: input.type,
		title: input.title,
		body: input.body,
		href: input.href || "/me",
		readAt: null,
		discordStatus: discordEnabled ? "pending" : "disabled",
		createdAt: new Date(),
	};
	await db.collection<TournamentNotification>("tournament_notifications").insertOne(notification);
	if (discordEnabled) await enqueueDiscordNotification(db, notification.id, input.tournamentId);
	return notification;
}
