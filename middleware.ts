import { NextRequest, NextResponse } from "next/server";

function contentSecurityPolicy(nonce: string) {
	const development = process.env.NODE_ENV !== "production";
	return [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
		"script-src-attr 'none'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net https://static-cdn.jtvnw.net https://clips-media-assets2.twitch.tv https://*.twitch.tv https://ddragon.leagueoflegends.com",
		"font-src 'self' data:",
		"connect-src 'self'" + (development ? " ws: wss:" : ""),
		"frame-src https://player.twitch.tv",
		"media-src 'self' blob:",
		"worker-src 'self' blob:",
		"manifest-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		...(development ? [] : ["upgrade-insecure-requests"]),
	].join("; ");
}

function requestProtocol(request: NextRequest) {
	return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() || request.nextUrl.protocol.replace(":", "");
}

function publicHostname(request: NextRequest) {
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
	const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
	return host.split(":")[0].toLowerCase();
}

function hasSessionCookie(request: NextRequest) {
	return ["authjs.session-token", "__Secure-authjs.session-token", "next-auth.session-token", "__Secure-next-auth.session-token"].some((name) =>
		Boolean(request.cookies.get(name)?.value)
	);
}

export function middleware(request: NextRequest) {
	const hostname = publicHostname(request);
	const productionHostname = hostname === "n4cht4r4.de" || hostname === "www.n4cht4r4.de";
	if (process.env.NODE_ENV === "production" && productionHostname && requestProtocol(request) !== "https") {
		const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `https://${hostname}`);
		return NextResponse.redirect(destination, 308);
	}

	const protectedRoutes = ["/me", "/admin"];
	const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

	// This only keeps anonymous visitors out of private screens. Every admin and
	// user API still verifies the signed session and permissions on the server.
	if (isProtected && !hasSessionCookie(request)) {
		const publicOrigin = productionHostname ? `https://${hostname}` : request.nextUrl.origin;
		return NextResponse.redirect(new URL("/login", publicOrigin));
	}

	const nonce = btoa(crypto.randomUUID());
	const csp = contentSecurityPolicy(nonce);
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("Content-Security-Policy", csp);

	const response = NextResponse.next({ request: { headers: requestHeaders } });
	response.headers.set("Content-Security-Policy", csp);
	return response;
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
