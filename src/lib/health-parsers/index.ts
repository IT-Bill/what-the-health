import AdmZip from "adm-zip";
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

/**
 * Auto-detect the source format from a ZIP buffer and parse it.
 * Throws if no parser matches the file contents.
 */
export async function parseHealthExport(zipBuffer: Buffer): Promise<ParseResult> {
  const zip = new AdmZip(zipBuffer);
  const fileNames = zip.getEntries().map((e) => e.entryName);

  for (const parser of parsers) {
    if (parser.detect(fileNames)) {
      return parser.parse(zipBuffer);
    }
  }

  throw new Error(
    "无法识别该文件格式。目前支持：Apple Health、华为运动健康、Samsung Health、小米/Zepp Life。请确认上传的是正确的健康数据导出文件。"
  );
}

export type { HealthParser, ParsedRecord, ParseResult, HealthMetric, HealthSource } from "./types";
