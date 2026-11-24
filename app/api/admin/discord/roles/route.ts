import { hasTournamentPermission } from "@/lib/tournament-admin";
import { isRolePickerConfigured, listGuildRoles } from "@/lib/discord-roles";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Server roles for the challenge role picker. `configured: false` means staff type the role ID by hand. */
export async function GET() {
	const staff = await hasTournamentPermission("tournament_admin");
	if (!staff) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
	if (!isRolePickerConfigured()) return NextResponse.json({ configured: false, roles: [] });
	try {
		return NextResponse.json({ configured: true, roles: await listGuildRoles() });
	} catch (error) {
		return NextResponse.json({ configured: true, roles: [], error: error instanceof Error ? error.message : "Discord-Rollen konnten nicht geladen werden." });
	}
}
