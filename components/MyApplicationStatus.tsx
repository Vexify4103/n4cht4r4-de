"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { BellOff, CheckCircle2, Clock3, Users } from "lucide-react";
import { DiscordMark } from "@/components/DiscordMark";
import { useLocale } from "@/components/LocaleProvider";
import { site } from "@/lib/site";

// Shows the signed-in player's own application on the tournament pages, not only on /me.

export const MY_APPLICATIONS_KEY = "/api/user/tournaments";

type MyApplication = {
	tournamentId: string;
	tournamentSlug: string;
	status: "pending" | "accepted" | "waitlisted";
	teamId?: string | null;
	discordDmOptIn?: boolean;
};
type PublicTeam = { id: string; name: string; members: { profileHref?: string }[] };

const fetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.json() : null));

/** The signed-in user's active application for this tournament (route id or slug), or null. */
export function useMyApplication(tournamentId: string) {
	const { data: session } = useSession();
	const { data } = useSWR<{ applications: MyApplication[] } | null>(session?.user ? MY_APPLICATIONS_KEY : null, fetcher);
	return data?.applications?.find((application) => application.tournamentSlug === tournamentId || application.tournamentId === tournamentId) ?? null;
}

export function MyApplicationStatus({ tournamentId }: { tournamentId: string }) {
	const { text } = useLocale();
	const { data: session } = useSession();
	const application = useMyApplication(tournamentId);
	const { data: teamData } = useSWR<{ teams: PublicTeam[] } | null>(application ? `/api/tournaments/${tournamentId}/teams` : null, fetcher);
	if (!application) return null;
	const userId = (session?.user as { id?: string } | undefined)?.id;
	// A team is only shown once it is public with this player in it, so nobody sees a draft assignment.
	const team = userId ? teamData?.teams?.find((entry) => entry.members.some((member) => member.profileHref === `/community/members/${userId}`)) : undefined;

	return (
		<div className="my-application">
			<span className="kicker">{text("Your application", "Deine Anmeldung")}</span>
			<strong className="my-application-title">
				{team ? <Users size={18} /> : application.status === "waitlisted" ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}
				{team
					? text(`You play for ${team.name}`, `Du spielst bei ${team.name}`)
					: application.status === "waitlisted"
						? text("You are on the waiting list", "Du stehst auf der Warteliste")
						: text("You are registered", "Du bist angemeldet")}
			</strong>
			<p>
				{team
					? text("Your team is set. All details are on the team page and in your team channel on Discord.", "Dein Team steht. Alle Infos findest du auf der Teamseite und in eurem Teamchannel auf Discord.")
					: text(
							"Your application has arrived. Tournament staff will build the teams; as soon as the roster is published, you will see your team here.",
							"Deine Bewerbung ist angekommen. Die Turnierleitung stellt die Teams zusammen; sobald der Roster veröffentlicht ist, siehst du dein Team hier."
						)}
			</p>
			<p className="my-application-discord">
				<DiscordMark size={14} variant="blurple" />
				<span>
					{text(
						"Join the N4cht4r4 Discord server: only then can the bot message you and you can see your team channel.",
						"Tritt dem N4cht4r4-Discord-Server bei: Nur dann kann dir der Bot schreiben und du siehst euren Teamchannel."
					)}
				</span>
			</p>
			{application.discordDmOptIn === false && (
				<p className="my-application-discord">
					<BellOff size={14} />
					<span>
						{text("Discord messages from the bot are switched off. You can turn them on in", "Discord-Nachrichten vom Bot sind ausgeschaltet. Du kannst sie in")} <Link href="/me">{text("your profile", "deinem Profil")}</Link>
						{text(".", " einschalten.")}
					</span>
				</p>
			)}
			<div className="my-application-actions">
				<a className="button button-secondary" href={site.discordUrl} target="_blank" rel="noreferrer">
					<DiscordMark size={15} variant="white" /> {text("Join Discord", "Discord beitreten")}
				</a>
				{team ? (
					<Link className="button button-secondary" href={`/tournaments/${tournamentId}/teams`}>
						<Users size={15} /> {text("Team page", "Teamseite")}
					</Link>
				) : (
					<Link className="text-link" href="/me">
						{text("Manage in profile", "Im Profil verwalten")}
					</Link>
				)}
			</div>
		</div>
	);
}
