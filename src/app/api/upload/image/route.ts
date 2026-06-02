import { getAuthCookie, verifyToken } from "@/lib/auth";
import { uploadImage, UploadError } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload/image
 * Generic image upload (posts, etc). Converts to JPEG, UUIDv7 naming.
 * Query param: ?prefix=posts (default "uploads")
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") || "uploads";

  // Only allow safe prefixes
  const allowedPrefixes = ["posts", "uploads", "chat"];
  if (!allowedPrefixes.includes(prefix)) {
    return Response.json({ error: "无效的上传类型" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "请选择图片" }, { status: 400 });
  }

  try {
    const { url } = await uploadImage(file, prefix);
    return Response.json({ url });
  } catch (err) {
    if (err instanceof UploadError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[image upload]", err);
    return Response.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
