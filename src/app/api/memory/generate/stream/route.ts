import { getAuthCookie, verifyToken } from "@/lib/auth";
import { generateWellnessReportForUser } from "@/lib/report/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function formatPeriodLabel(periodType: "weekly" | "monthly", periodStart?: string): string {
  if (!periodStart) return periodType === "monthly" ? "本月月报" : "本周周报";
  const start = new Date(periodStart);
  if (periodType === "monthly") {
    return `${start.getUTCFullYear()}年${start.getUTCMonth() + 1}月月报`;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${start.getUTCMonth() + 1}/${start.getUTCDate()} - ${end.getUTCMonth() + 1}/${end.getUTCDate()} 周报`;
}

function buildDoneMessage(details: unknown): string {
  const report = details as {
    reportId?: string;
    version?: number;
    summary?: string | null;
    highlights?: unknown[];
    insights?: unknown[];
  } | null;
  const parts = [
    `报告已生成并保存${report?.version ? `（版本 v${report.version}）` : ""}。`,
  ];
  if (report?.summary) parts.push(report.summary);
  const highlightCount = report?.highlights?.length ?? 0;
  const insightCount = report?.insights?.length ?? 0;
  if (highlightCount > 0 || insightCount > 0) {
    parts.push(`本次生成了 ${highlightCount} 个亮点和 ${insightCount} 条 AI 洞察。`);
  }
  return parts.join("\n\n");
}

function reportDetails(report: Awaited<ReturnType<typeof generateWellnessReportForUser>>["report"]) {
  return {
    reportId: report.id,
    periodType: report.periodType,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    version: report.version,
    summary: report.summary,
    highlights: (report.data as { highlights?: unknown[] }).highlights ?? [],
    insights: report.insights.map((insight) => ({
      type: insight.type,
      title: insight.title,
      content: insight.content,
    })),
  };
}

export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  let body: { type?: string; periodStart?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const periodType = body.type === "monthly" ? "monthly" : "weekly";
  const periodStart = body.periodStart;

  const readable = new ReadableStream<string>({
    async start(controller) {
      controller.enqueue(sse({ type: "agent_start" }));
      controller.enqueue(sse({
        type: "text_delta",
        delta: `我会整理${formatPeriodLabel(periodType, periodStart)}的数据，并用报告主提示词生成新的报告版本。\n\n`,
      }));

      try {
        const result = await generateWellnessReportForUser({
          userId: payload.userId,
          periodType,
          periodStart: periodStart ? new Date(periodStart) : undefined,
          signal: request.signal,
          onProgress: (message) => {
            controller.enqueue(sse({ type: "text_delta", delta: `${message}\n\n` }));
          },
        });
        const details = reportDetails(result.report);
        controller.enqueue(sse({ type: "report_generated", report: details }));
        controller.enqueue(sse({ type: "text_delta", delta: buildDoneMessage(details) }));
        controller.enqueue(sse({ type: "message_end", message: { role: "assistant", text: "" } }));
        controller.enqueue(sse({ type: "agent_end" }));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成报告失败";
        controller.enqueue(sse({ type: "error", message }));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
