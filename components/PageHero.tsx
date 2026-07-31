export function PageHero({
	kicker,
	title,
	copy,
	icon,
	children,
	className = "",
	compact = false,
}: {
	kicker: string;
	title: string;
	copy: string;
	icon: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
	compact?: boolean;
}) {
	return (
		<section className={`page-hero ${compact ? "compact" : ""} ${className}`.trim()}>
			<div className="page-hero-copy">
				<span className="kicker">{kicker}</span>
				<h1>{title}</h1>
				<p>{copy}</p>
				{children}
			</div>
			<div className="page-hero-emblem" aria-hidden="true">
				{icon}
				<span>✿</span>
			</div>
		</section>
	);
}
