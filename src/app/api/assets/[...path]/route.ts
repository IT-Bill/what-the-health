import { getObject } from "@/lib/s3";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Content-type mapping by extension. */
const MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
};

/**
 * GET /api/assets/[...path]
 * Proxy S3/MinIO objects through Next.js with caching headers.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join("/");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await getObject(key);

    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    // Determine content type from S3 metadata or file extension
    const ext = "." + key.split(".").pop()?.toLowerCase();
    const mime = contentType || MIME_MAP[ext] || "application/octet-stream";

    // Stream the response with cache headers
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (contentLength) {
      headers["Content-Length"] = String(contentLength);
    }

    // Convert S3 body stream to web ReadableStream
    const webStream = body.transformToWebStream();

    return new Response(webStream, { status: 200, headers });
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code === "NoSuchKey" || code === "NotFound") {
      return new Response("Not found", { status: 404 });
    }
    console.error("[assets proxy]", err);
    return new Response("Internal error", { status: 500 });
  }
}
