import { Uint8ArrayReader, ZipReader, Uint8ArrayWriter, type Entry } from "@zip.js/zip.js";
import type { HealthParser, ParseResult } from "./types";
import { appleHealthParser } from "./apple-health";
import { huaweiHealthParser } from "./huawei-health";
import { xiaomiHealthParser } from "./xiaomi-health";
import { samsungHealthParser } from "./samsung-health";
import { googleFitParser } from "./google-fit";

/** All registered parsers, checked in order (most specific first). */
const parsers: HealthParser[] = [
  appleHealthParser,
  samsungHealthParser,
  googleFitParser,
  huaweiHealthParser,
  xiaomiHealthParser,
];

/** Error thrown when a ZIP requires a password. */
export class PasswordRequiredError extends Error {
  code = "PASSWORD_REQUIRED" as const;
  constructor() {
    super("该文件需要密码才能解压。请输入密码后重试。");
  }
}

/** Error thrown when the password is incorrect. */
export class PasswordIncorrectError extends Error {
  code = "PASSWORD_INCORRECT" as const;
  constructor() {
    super("密码错误，请重新输入。");
  }
}

/** Abstraction over a ZIP entry for parsers to consume. */
export interface ZipFile {
  path: string;
  type: "File" | "Directory";
  buffer(): Promise<Buffer>;
}

/** Abstraction over a ZIP directory for parsers to consume. */
export interface ZipDirectory {
  files: ZipFile[];
}

/**
 * Open a ZIP buffer and return a ZipDirectory interface.
 * Handles both encrypted and non-encrypted ZIPs.
 */
export async function openZip(zipBuffer: Buffer, password?: string): Promise<{ directory: ZipDirectory; fileNames: string[] }> {
  const uint8 = new Uint8Array(zipBuffer.buffer, zipBuffer.byteOffset, zipBuffer.byteLength);
  const options = password ? { password } : {};
  const reader = new ZipReader(new Uint8ArrayReader(uint8), options);

  let entries: Entry[];
  try {
    entries = await reader.getEntries();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("encrypted")) {
      if (!password) throw new PasswordRequiredError();
      throw new PasswordIncorrectError();
    }
    throw err;
  }

  // Check if any entry is encrypted but no password was given
  const hasEncrypted = entries.some((e) => e.encrypted);
  if (hasEncrypted && !password) {
    await reader.close();
    throw new PasswordRequiredError();
  }

  // Build ZipFile wrappers
  const files: ZipFile[] = entries
    .filter((e) => !e.directory)
    .map((entry) => ({
      path: entry.filename,
      type: "File" as const,
      async buffer(): Promise<Buffer> {
        try {
          const writer = new Uint8ArrayWriter();
          const data = await entry.getData!(writer);
          return Buffer.from(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("password") || msg.includes("Invalid signature") || msg.includes("encrypted")) {
            throw new PasswordIncorrectError();
          }
          throw err;
        }
      },
    }));

  const fileNames = files.map((f) => f.path);
  return { directory: { files }, fileNames };
}

/**
 * Auto-detect the source format from a ZIP buffer and parse it.
 * @param zipBuffer - the ZIP file buffer
 * @param password - optional password for encrypted ZIPs
 */
export async function parseHealthExport(zipBuffer: Buffer, password?: string): Promise<ParseResult> {
  const { directory, fileNames } = await openZip(zipBuffer, password);

  for (const parser of parsers) {
    if (parser.detect(fileNames)) {
      return parser.parse(directory);
    }
  }

  throw new Error(
    "无法识别该文件格式。目前支持：Apple Health、华为运动健康、Samsung Health、小米/Zepp Life、Google Fit。请确认上传的是正确的健康数据导出文件。"
  );
}

export type { HealthParser, ParsedRecord, ParseResult, HealthMetric, HealthSource } from "./types";
