import type { Db } from "mongodb";

export const newsCategories = ["youtube", "tournament", "applications", "kofi", "community"] as const;
export type NewsCategory = (typeof newsCategories)[number];
export type NewsItem = {
	id: string;
	category: NewsCategory;
	title: string;
	titleEn: string;
	body: string;
	bodyEn: string;
	href: string;
	published: boolean;
	pinned: boolean;
	createdAt: string;
};

export async function ensureNews(db: Db) {
	await db.collection("news").createIndex({ id: 1 }, { unique: true });
	await db.collection("news").updateOne(
		{ id: "team-applications-2026-10" },
		{
			$setOnInsert: {
				id: "team-applications-2026-10",
				category: "applications",
				title: "Dein Platz in Nachtaras Team",
				titleEn: "Your place on Nachtara's team",
				body: "Die Bewerbungen für Moderation und Cutter sind offen. Du möchtest die Community unterstützen oder aus Stream-Momenten schöne Videos machen? Wir freuen uns auf dich!",
				bodyEn: "Applications for moderators and video editors are open. Want to support the community or turn stream moments into lovely videos? We'd love to hear from you!",
				href: "/bewerbungen/jobs",
				published: true,
				pinned: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		{ upsert: true }
	);
}

export function cleanNews(body: Record<string, unknown>) {
	const value = (key: string, limit: number) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, limit) : "");
	const title = value("title", 120);
	const content = value("body", 1500);
	const href = value("href", 500);
	if (!title || !content || !newsCategories.includes(body.category as NewsCategory)) return null;
	if (href && !(href.startsWith("/") && !href.startsWith("//") && !href.includes("\\"))) {
		try {
			if (new URL(href).protocol !== "https:") return null;
		} catch {
			return null;
		}
	}
	return {
		title,
		titleEn: value("titleEn", 120),
		body: content,
		bodyEn: value("bodyEn", 1500),
		href,
		category: body.category as NewsCategory,
		published: body.published === true,
		pinned: body.pinned === true,
	};
}
