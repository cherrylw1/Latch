import { NextResponse } from "next/server";
import { createNote, isStorageConfigured, listNotes } from "@/lib/server/storage";
import type { LatchNote } from "@/lib/types";

function unavailable() {
  return NextResponse.json({ error: "Vercel Blob and Postgres are not connected yet." }, { status: 503 });
}

export async function GET() {
  if (!isStorageConfigured()) return unavailable();
  try {
    return NextResponse.json({ notes: await listNotes() });
  } catch {
    return NextResponse.json({ error: "Latch could not load cloud storage." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isStorageConfigured()) return unavailable();
  try {
    const { note } = (await request.json()) as { note?: LatchNote };
    if (!note?.id || !note.title || !Array.isArray(note.attachments)) {
      return NextResponse.json({ error: "A complete note is required." }, { status: 400 });
    }
    return NextResponse.json({ note: await createNote(note) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Latch could not save this note." }, { status: 500 });
  }
}
