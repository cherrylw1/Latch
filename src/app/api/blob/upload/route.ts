import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isStorageConfigured } from "@/lib/server/storage";

const maximumFileSize = 100 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Vercel Blob and Postgres are not connected yet." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        maximumSizeInBytes: maximumFileSize,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Latch could not prepare this upload." }, { status: 500 });
  }
}
