import { getTournamentAdminContext } from "@/lib/tournament-admin";
import { NextResponse } from "next/server";

export async function GET() {
	const context = await getTournamentAdminContext();
	if (!context) return NextResponse.json({ error: "Kein Turnierzugriff." }, { status: 403 });
	return NextResponse.json({ role: context.role, discordId: context.discordId });
}
