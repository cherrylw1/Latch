# Latch

Latch is a personal relay for notes, links, images, PDFs, CSVs, and files that need to move between devices.

## Storage

Latch uses Vercel Blob for file contents and Vercel Postgres (Neon) for note and attachment metadata. Those services synchronize notes between every browser that opens the deployed app. IndexedDB remains a development fallback whenever the Vercel environment variables are absent.

Latch is protected by one shared password stored as the encrypted `LATCH_PASSWORD` environment variable in Vercel. It is never committed to GitHub. A session lasts for 30 days of activity, then requires the password again.

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

## Connect Vercel storage

After importing the project to Vercel:

1. Create a private Vercel Blob store and connect it to this project with the custom environment prefix `LATCH_FILES`. Vercel sets `LATCH_FILES_READ_WRITE_TOKEN`.
2. Create a Neon Postgres database from the Vercel Storage tab and connect it to this project. Vercel sets `DATABASE_URL`.
3. Redeploy. The database tables are created automatically the first time Latch loads.
4. Add a strong `LATCH_PASSWORD` value in **Project Settings → Environment Variables** for Production and Preview, then redeploy.

The public GitHub repository contains application code only. Notes are stored in Postgres and attachments are stored in Blob, never in GitHub.
