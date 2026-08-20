import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSession, isAuthConfigured, isValidSession, sessionCookieName, sessionDurationSeconds } from "@/lib/server/auth";

function withSession(response: NextResponse) {
  response.cookies.set({
    name: sessionCookieName,
    value: createSession(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const authenticated = isValidSession(request.cookies.get(sessionCookieName)?.value);
  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: isAuthConfigured() ? "Sign in required." : "Latch password is not configured yet." },
        { status: isAuthConfigured() ? 401 : 503 },
      );
    }
    if (pathname !== "/login") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
  return withSession(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next|icon|apple-icon|manifest.webmanifest).*)"],
};
