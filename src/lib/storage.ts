"use client";

import { upload } from "@vercel/blob/client";
import type { AttachmentMeta, LatchNote } from "@/lib/types";

const DATABASE_NAME = "latch-local";
const DATABASE_VERSION = 1;
const NOTE_STORE = "notes";
const ATTACHMENT_STORE = "attachments";
const maximumFileSize = 100 * 1024 * 1024;

type StorageMode = "remote" | "local";

let storageMode: StorageMode = "remote";
const remoteNoteIds = new Set<string>();
const remoteAttachments = new Map<string, AttachmentMeta>();

function rememberRemoteNotes(notes: LatchNote[]) {
  remoteNoteIds.clear();
  remoteAttachments.clear();
  notes.forEach((note) => {
    remoteNoteIds.add(note.id);
    note.attachments.forEach((attachment) => remoteAttachments.set(attachment.id, attachment));
  });
}

async function readRemote<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(`Latch storage request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export function getStorageMode(): StorageMode {
  return storageMode;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NOTE_STORE)) {
        database.createObjectStore(NOTE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ATTACHMENT_STORE)) {
        database.createObjectStore(ATTACHMENT_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLocalNotes(): Promise<LatchNote[]> {
  const database = await openDatabase();
  const transaction = database.transaction(NOTE_STORE, "readonly");
  const notes = await runRequest(transaction.objectStore(NOTE_STORE).getAll());
  database.close();
  return notes as LatchNote[];
}

async function saveLocalNote(note: LatchNote): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(NOTE_STORE, "readwrite");
  await runRequest(transaction.objectStore(NOTE_STORE).put(note));
  database.close();
}

async function removeLocalNote(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([NOTE_STORE, ATTACHMENT_STORE], "readwrite");
  await runRequest(transaction.objectStore(NOTE_STORE).delete(id));
  const attachmentStore = transaction.objectStore(ATTACHMENT_STORE);
  const attachments = await runRequest(attachmentStore.getAll());
  await Promise.all(
    (attachments as StoredAttachment[])
      .filter((attachment) => attachment.noteId === id)
      .map((attachment) => runRequest(attachmentStore.delete(attachment.id))),
  );
  database.close();
}

type StoredAttachment = AttachmentMeta & {
  noteId: string;
  blob: Blob;
};

async function saveLocalAttachments(noteId: string, files: File[]): Promise<AttachmentMeta[]> {
  if (!files.length) return [];

  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readwrite");
  const store = transaction.objectStore(ATTACHMENT_STORE);
  const attachments = files.map<AttachmentMeta>((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
  }));

  await Promise.all(
    attachments.map((attachment, index) =>
      runRequest(
        store.put({
          ...attachment,
          noteId,
          blob: files[index],
        } satisfies StoredAttachment),
      ),
    ),
  );
  database.close();
  return attachments;
}

async function getLocalAttachment(id: string): Promise<StoredAttachment | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readonly");
  const attachment = await runRequest(transaction.objectStore(ATTACHMENT_STORE).get(id));
  database.close();
  return attachment as StoredAttachment | undefined;
}

async function getLocalAttachments(): Promise<StoredAttachment[]> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readonly");
  const attachments = await runRequest(transaction.objectStore(ATTACHMENT_STORE).getAll());
  database.close();
  return attachments as StoredAttachment[];
}

async function removeLocalAttachment(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readwrite");
  await runRequest(transaction.objectStore(ATTACHMENT_STORE).delete(id));
  database.close();
}

export async function getNotes(): Promise<LatchNote[]> {
  try {
    const result = await readRemote<{ notes: LatchNote[] }>("/api/notes", { cache: "no-store" });
    storageMode = "remote";
    rememberRemoteNotes(result.notes);
    return result.notes;
  } catch {
    storageMode = "local";
    return getLocalNotes();
  }
}

export async function saveNote(note: LatchNote): Promise<void> {
  if (storageMode === "local") return saveLocalNote(note);

  const isExisting = remoteNoteIds.has(note.id);
  const result = await readRemote<{ note: LatchNote }>(isExisting ? `/api/notes/${note.id}` : "/api/notes", {
    method: isExisting ? "PATCH" : "POST",
    body: JSON.stringify({ note }),
  });
  remoteNoteIds.add(result.note.id);
  result.note.attachments.forEach((attachment) => remoteAttachments.set(attachment.id, attachment));
}

export async function removeNote(id: string): Promise<void> {
  if (storageMode === "local") return removeLocalNote(id);
  await readRemote(`/api/notes/${id}`, { method: "DELETE" });
  remoteNoteIds.delete(id);
  [...remoteAttachments.entries()].forEach(([attachmentId, attachment]) => {
    if (!attachment.pathname?.startsWith(`attachments/${id}/`)) return;
    remoteAttachments.delete(attachmentId);
  });
}

export async function saveAttachments(noteId: string, files: File[]): Promise<AttachmentMeta[]> {
  if (!files.length) return [];
  if (storageMode === "local") return saveLocalAttachments(noteId, files);

  const attachments = await Promise.all(
    files.map(async (file) => {
      if (file.size > maximumFileSize) throw new Error(`${file.name} is over the 100 MB limit.`);
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const blob = await upload(`attachments/${noteId}/${id}-${file.name}`, file, {
        access: "public",
        contentType: file.type || "application/octet-stream",
        handleUploadUrl: "/api/blob/upload",
      });
      const attachment: AttachmentMeta = {
        id,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        createdAt,
        url: blob.url,
        pathname: blob.pathname,
      };
      remoteAttachments.set(id, attachment);
      return attachment;
    }),
  );
  return attachments;
}

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  if (storageMode === "local") return getLocalAttachment(id);
  const attachment = remoteAttachments.get(id);
  if (!attachment?.url) return undefined;
  const response = await fetch(attachment.url);
  if (!response.ok) return undefined;
  return { ...attachment, noteId: "", blob: await response.blob() };
}

export async function getAllAttachments(): Promise<StoredAttachment[]> {
  if (storageMode === "local") return getLocalAttachments();
  const attachments = await Promise.all(
    [...remoteAttachments.values()].map(async (attachment) => {
      const stored = await getAttachment(attachment.id);
      return stored;
    }),
  );
  return attachments.filter((attachment): attachment is StoredAttachment => Boolean(attachment));
}

export async function removeAttachment(id: string): Promise<void> {
  if (storageMode === "local") return removeLocalAttachment(id);
  await readRemote(`/api/attachments/${id}`, { method: "DELETE" });
  remoteAttachments.delete(id);
}
