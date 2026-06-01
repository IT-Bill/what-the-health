import { v7 as uuidv7 } from "uuid";
import sharp from "sharp";
import { putObject } from "./s3";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload an image to S3/MinIO with UUIDv7 naming.
 * Converts to JPEG (quality 85) for consistency.
 *
 * @param file - The uploaded File object
 * @param prefix - S3 key prefix (e.g. "avatars", "posts")
 * @returns The S3 key and public URL
 */
export async function uploadImage(
  file: File,
  prefix: string
): Promise<UploadResult> {
  if (file.size > MAX_SIZE) {
    throw new UploadError("图片大小不能超过 10MB");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError("仅支持 JPEG、PNG、WebP、GIF 格式");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Convert to JPEG for uniform storage
  const jpegBuffer = await sharp(buffer)
    .jpeg({ quality: 85 })
    .toBuffer();

  const id = uuidv7();
  const key = `${prefix}/${id}.jpg`;

  await putObject(key, jpegBuffer, "image/jpeg");

  return {
    key,
    url: `/api/assets/${key}`,
  };
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}
