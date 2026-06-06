import { writeReportSimulationData } from "@/lib/report/simulation-writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySecret(request: Request): boolean {
  const expected = process.env.DEVICE_API_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-device-secret");
  return token === expected;
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return Response.json({ error: "无效的设备密钥" }, { status: 401 });
  }

  let body: {
    username?: string;
    user?: string;
    date?: string;
    scenario?: string;
    days?: number;
    replace?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  try {
    const result = await writeReportSimulationData({
      username: body.username ?? body.user ?? "bill2",
      date: body.date ?? new Date().toISOString().slice(0, 10),
      scenario: body.scenario ?? "balanced",
      days: body.days ?? 1,
      replace: body.replace ?? true,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "写入模拟数据失败";
    const status = message.includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
