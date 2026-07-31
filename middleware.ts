import { NextRequest, NextResponse } from "next/server";

function hasSessionCookie(request: NextRequest) {
	return ["authjs.session-token", "__Secure-authjs.session-token", "next-auth.session-token", "__Secure-next-auth.session-token"]
		.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function middleware(request: NextRequest) {
	const protectedRoutes = ["/me", "/admin"];
	const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

	// This only keeps anonymous visitors out of private screens. Every admin and
	// user API still verifies the signed session and permissions on the server.
	if (isProtected && !hasSessionCookie(request)) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
