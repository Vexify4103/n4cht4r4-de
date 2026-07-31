import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	return NextResponse.json({
		challenge: {
			id,
			progress: 0,
			total: 10,
			completed: false,
		},
	});
}
