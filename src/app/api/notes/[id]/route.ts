import { NextResponse } from "next/server";
import { deleteNote, isStorageConfigured, updateNote } from "@/lib/server/storage";
import type { LatchNote } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

function unavailable() {
  return NextResponse.json({ error: "Vercel Blob and Postgres are not connected yet." }, { status: 503 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isStorageConfigured()) return unavailable();
  try {
    const [{ id }, { note }] = await Promise.all([params, request.json() as Promise<{ note?: LatchNote }>]);
    if (!note?.id || note.id !== id) return NextResponse.json({ error: "A valid note is required." }, { status: 400 });
    const saved = await updateNote(id, note);
    if (!saved) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    return NextResponse.json({ note: saved });
  } catch {
    return NextResponse.json({ error: "Latch could not update this note." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  if (!isStorageConfigured()) return unavailable();
  try {
    const { id } = await params;
    await deleteNote(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Latch could not delete this note." }, { status: 500 });
  }
}
