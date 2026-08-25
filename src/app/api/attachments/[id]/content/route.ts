import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAuthenticatedRequest } from "@/lib/server/auth";
import { blobReadWriteToken, findAttachment } from "@/lib/server/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  if (!isAuthenticatedRequest(request)) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const attachment = await findAttachment(id);
  if (!attachment?.pathname) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const result = await get(attachment.pathname, { access: "private", token: blobReadWriteToken() });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json({ error: "Attachment is unavailable." }, { status: 404 });
  }

  const headers = new Headers({
    "content-type": result.blob.contentType || attachment.type,
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    "cache-control": "private, no-store",
  });
  // Private Blob responses can omit Content-Length. Never replace that unknown
  // length with zero, or browsers may save a valid stream as an empty file.
  const upstreamLength = result.headers.get("content-length");
  if (result.blob.size > 0) headers.set("content-length", String(result.blob.size));
  else if (upstreamLength && Number(upstreamLength) > 0) headers.set("content-length", upstreamLength);

  return new Response(result.stream, {
    headers,
  });
}
