import { NextResponse } from "next/server";
import { deleteAttachment, isStorageConfigured } from "@/lib/server/storage";
import { isAuthenticatedRequest } from "@/lib/server/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isAuthenticatedRequest(request)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Vercel Blob and Postgres are not connected yet." }, { status: 503 });
  }
  try {
    const { id } = await params;
    const deleted = await deleteAttachment(id);
    if (!deleted) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Latch could not delete this attachment." }, { status: 500 });
  }
}
