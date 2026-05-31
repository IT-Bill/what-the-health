import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { putObject } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/upload/avatar
 * Upload user avatar to S3/MinIO.
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

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

  if (file.size > MAX_SIZE) {
    return Response.json({ error: "图片大小不能超过 5MB" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "仅支持 JPEG、PNG、WebP、GIF 格式" }, { status: 400 });
  }

  // Determine extension from MIME type
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `avatars/${userId}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, file.type);

    // Update user's avatarUrl in DB (store the S3 key)
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/api/assets/${key}` },
    });

    return Response.json({ url: `/api/assets/${key}` });
  } catch (err) {
    console.error("[avatar upload]", err);
    return Response.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
