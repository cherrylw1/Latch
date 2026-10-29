import { del } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import type { AttachmentMeta, LatchNote } from "@/lib/types";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  source_url: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  note_id: string;
  name: string;
  content_type: string;
  size: string | number;
  url: string;
  pathname: string;
  relative_path: string | null;
  created_at: string;
};

let schemaPromise: Promise<void> | undefined;

function database() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return neon(connectionString);
}

export function isStorageConfigured() {
  return Boolean((process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL) && process.env.LATCH_FILES_READ_WRITE_TOKEN);
}

export function blobReadWriteToken() {
  const token = process.env.LATCH_FILES_READ_WRITE_TOKEN;
  if (!token) throw new Error("LATCH_FILES_READ_WRITE_TOKEN is not configured.");
  return token;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = database();
      await sql`CREATE TABLE IF NOT EXISTS latch_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        source_url TEXT,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS latch_attachments (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL REFERENCES latch_notes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size BIGINT NOT NULL,
        url TEXT NOT NULL,
        pathname TEXT NOT NULL,
        relative_path TEXT,
        created_at TIMESTAMPTZ NOT NULL
      )`;
      await sql`ALTER TABLE latch_attachments ADD COLUMN IF NOT EXISTS relative_path TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS latch_attachments_note_id_idx ON latch_attachments(note_id)`;
    })();
  }
  return schemaPromise;
}

function attachmentFromRow(row: AttachmentRow): AttachmentMeta {
  return {
    id: row.id,
    name: row.name,
    type: row.content_type,
    size: Number(row.size),
    createdAt: new Date(row.created_at).toISOString(),
    relativePath: row.relative_path ?? undefined,
    pathname: row.pathname,
  };
}

export async function findAttachment(id: string): Promise<AttachmentMeta | undefined> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`SELECT id, note_id, name, content_type, size, url, pathname, relative_path, created_at FROM latch_attachments WHERE id = ${id}`;
  const row = (rows as AttachmentRow[])[0];
  return row ? attachmentFromRow(row) : undefined;
}

function noteFromRow(row: NoteRow, attachments: AttachmentMeta[]): LatchNote {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    sourceUrl: row.source_url ?? undefined,
    attachments,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listNotes(): Promise<LatchNote[]> {
  await ensureSchema();
  const sql = database();
  const [noteRows, attachmentRows] = await Promise.all([
    sql`SELECT id, title, body, source_url, pinned, archived, created_at, updated_at FROM latch_notes ORDER BY updated_at DESC`,
    sql`SELECT id, note_id, name, content_type, size, url, pathname, relative_path, created_at FROM latch_attachments ORDER BY created_at ASC`,
  ]);
  const attachmentsByNote = new Map<string, AttachmentMeta[]>();
  (attachmentRows as AttachmentRow[]).forEach((row) => {
    const attachments = attachmentsByNote.get(row.note_id) ?? [];
    attachments.push(attachmentFromRow(row));
    attachmentsByNote.set(row.note_id, attachments);
  });
  return (noteRows as NoteRow[]).map((row) => noteFromRow(row, attachmentsByNote.get(row.id) ?? []));
}

export async function createNote(note: LatchNote): Promise<LatchNote> {
  await ensureSchema();
  const sql = database();
  await sql`INSERT INTO latch_notes (id, title, body, source_url, pinned, archived, created_at, updated_at)
    VALUES (${note.id}, ${note.title}, ${note.body}, ${note.sourceUrl ?? null}, ${note.pinned}, ${note.archived}, ${note.createdAt}, ${note.updatedAt})`;
  if (note.attachments.length) {
    await sql.transaction(
      note.attachments.map((attachment) =>
        sql`INSERT INTO latch_attachments (id, note_id, name, content_type, size, url, pathname, relative_path, created_at)
          VALUES (${attachment.id}, ${note.id}, ${attachment.name}, ${attachment.type}, ${attachment.size}, ${attachment.url ?? ""}, ${attachment.pathname ?? ""}, ${attachment.relativePath ?? attachment.name}, ${attachment.createdAt})`,
      ),
    );
  }
  return note;
}

export async function updateNote(id: string, note: LatchNote): Promise<LatchNote | undefined> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`UPDATE latch_notes
    SET title = ${note.title}, body = ${note.body}, source_url = ${note.sourceUrl ?? null}, pinned = ${note.pinned}, archived = ${note.archived}, updated_at = ${note.updatedAt}
    WHERE id = ${id}
    RETURNING id, title, body, source_url, pinned, archived, created_at, updated_at`;
  const row = (rows as NoteRow[])[0];
  if (!row) return undefined;
  const attachments = await sql`SELECT id, note_id, name, content_type, size, url, pathname, relative_path, created_at FROM latch_attachments WHERE note_id = ${id} ORDER BY created_at ASC`;
  return noteFromRow(row, (attachments as AttachmentRow[]).map(attachmentFromRow));
}

export async function deleteNote(id: string) {
  await ensureSchema();
  const sql = database();
  const attachmentRows = await sql`SELECT pathname FROM latch_attachments WHERE note_id = ${id}`;
  await sql`DELETE FROM latch_notes WHERE id = ${id}`;
  await Promise.all(
    (attachmentRows as Array<{ pathname: string }>).map(({ pathname }) =>
      pathname ? del(pathname, { token: blobReadWriteToken() }).catch(() => undefined) : undefined,
    ),
  );
}

export async function deleteAttachment(id: string): Promise<boolean> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`DELETE FROM latch_attachments WHERE id = ${id} RETURNING pathname`;
  const pathname = (rows as Array<{ pathname: string }>)[0]?.pathname;
  if (!pathname) return false;
  await del(pathname, { token: blobReadWriteToken() }).catch(() => undefined);
  return true;
}
