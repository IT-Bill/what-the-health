export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ZIP import is temporarily unavailable. Do not read or parse request bodies.
export async function POST() {
  return Response.json(
    { code: "HEALTH_IMPORT_DISABLED", error: "健康数据文件导入暂未开放" },
    { status: 503 },
  );
}
