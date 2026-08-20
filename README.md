# Latch

Latch is a personal relay for notes, links, images, PDFs, CSVs, and files that need to move between devices.

## Current release

This first release is a complete browser-local app. It uses IndexedDB, so notes and attachments persist across refreshes in the same browser while the Vercel storage integration is intentionally deferred.

- Capture text, links, and files in one place.
- Upload any normal file type up to 100 MB per file.
- Preview images, PDFs, text files, JSON, and CSV files.
- Download individual attachments with their original filename.
- Download a complete ZIP backup containing all local files and `notes.json`.
- Search notes and attachment names.
- Pin, edit, archive, and delete notes.
- Use a responsive phone layout and light or dark canvas.

## Run locally

Use Node.js 20 or newer.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Production storage step

The interface and local data boundary are ready for the next step:

1. Import this repository into Vercel.
2. Enable Vercel Blob for files.
3. Add a Postgres database through the Vercel dashboard.
4. Move the IndexedDB adapter in `src/lib/storage.ts` behind server APIs backed by Blob and Postgres.

The public GitHub repository contains application code only. Files and notes will be stored outside GitHub once the Vercel services are connected.
