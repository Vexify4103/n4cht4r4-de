import Image from "next/image";

const sources = {
	white: "/brands/discord-symbol.svg",
	blurple: "/brands/discord-symbol-blurple.svg",
	black: "/brands/discord-symbol-black.svg",
} as const;

export function DiscordMark({
	size = 18,
	variant = "white",
	className = "",
}: {
	size?: number;
	variant?: keyof typeof sources;
	className?: string;
}) {
	return (
		<Image
			className={`discord-mark ${className}`.trim()}
			src={sources[variant]}
			alt=""
			aria-hidden="true"
			width={Math.round(size * 4 / 3)}
			height={size}
		/>
	);
}
