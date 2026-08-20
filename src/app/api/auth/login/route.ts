import { NextResponse } from "next/server";
import { createSession, isAuthConfigured, passwordMatches, sessionCookieName, sessionDurationSeconds } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Latch password is not configured yet." }, { status: 503 });
  }
  try {
    const { password } = (await request.json()) as { password?: string };
    if (!password || password.length > 512 || !passwordMatches(password)) {
      return NextResponse.json({ error: "That password does not match." }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
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
  } catch {
    return NextResponse.json({ error: "Latch could not sign in." }, { status: 400 });
  }
}
