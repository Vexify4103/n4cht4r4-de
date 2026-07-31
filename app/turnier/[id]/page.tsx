import { redirect } from "next/navigation";

export default async function LegacyTournamentDetail({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	redirect(`/tournaments/${id}`);
}
