import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/server/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: sessionCookieName, value: "", path: "/", maxAge: 0 });
  return response;
}
