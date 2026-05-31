import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ASSETS_DIR = path.join(__dirname, "../seed-assets");

/** MIME type from extension. */
function getMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

/** Upload all seed assets to MinIO. Skips files that already exist. */
export async function uploadSeedAssets() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET || "mindful";
  const region = process.env.S3_REGION || "us-east-1";

  if (!endpoint || !accessKey || !secretKey) {
    console.log("  ⚠ S3 env vars not set, skipping asset upload");
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  // Collect all files from seed-assets/
  const files: { localPath: string; key: string }[] = [];
  const subdirs = ["posts", "products", "pages"];

  for (const subdir of subdirs) {
    const dirPath = path.join(ASSETS_DIR, subdir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      files.push({
        localPath: path.join(dirPath, file),
        key: `static/${subdir}/${file}`,
      });
    }
  }

  let uploaded = 0;
  let skipped = 0;

  for (const { localPath, key } of files) {
    // Check if already exists
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      skipped++;
      continue;
    } catch {
      // Not found, upload it
    }

    const body = fs.readFileSync(localPath);
    const contentType = getMime(localPath);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    uploaded++;
  }

  console.log(`  assets: ${uploaded} uploaded, ${skipped} already exist (${files.length} total)`);
}
