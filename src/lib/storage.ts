"use client";

import type { AttachmentMeta, LatchNote } from "@/lib/types";

const DATABASE_NAME = "latch-local";
const DATABASE_VERSION = 1;
const NOTE_STORE = "notes";
const ATTACHMENT_STORE = "attachments";

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

export async function getNotes(): Promise<LatchNote[]> {
  const database = await openDatabase();
  const transaction = database.transaction(NOTE_STORE, "readonly");
  const notes = await runRequest(transaction.objectStore(NOTE_STORE).getAll());
  database.close();
  return notes as LatchNote[];
}

export async function saveNote(note: LatchNote): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(NOTE_STORE, "readwrite");
  await runRequest(transaction.objectStore(NOTE_STORE).put(note));
  database.close();
}

export async function removeNote(id: string): Promise<void> {
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

export async function saveAttachments(noteId: string, files: File[]): Promise<AttachmentMeta[]> {
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

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readonly");
  const attachment = await runRequest(transaction.objectStore(ATTACHMENT_STORE).get(id));
  database.close();
  return attachment as StoredAttachment | undefined;
}

export async function getAllAttachments(): Promise<StoredAttachment[]> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readonly");
  const attachments = await runRequest(transaction.objectStore(ATTACHMENT_STORE).getAll());
  database.close();
  return attachments as StoredAttachment[];
}

export async function removeAttachment(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ATTACHMENT_STORE, "readwrite");
  await runRequest(transaction.objectStore(ATTACHMENT_STORE).delete(id));
  database.close();
}
