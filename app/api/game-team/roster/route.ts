import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const roster = [
		{
			name: "Nachtara",
			role: "Support",
			opgg: "https://op.gg/summoners/euw/Nachtara-EUW",
			champs: ["Lulu", "Nami", "Janna"],
		},
		{ name: "Platz offen", role: "Top", opgg: null, champs: ["-", "-", "-"] },
		{ name: "Platz offen", role: "Jungle", opgg: null, champs: ["-", "-", "-"] },
		{ name: "Platz offen", role: "Mid", opgg: null, champs: ["-", "-", "-"] },
		{ name: "Platz offen", role: "ADC", opgg: null, champs: ["-", "-", "-"] },
	];

	return NextResponse.json({ roster });
}
