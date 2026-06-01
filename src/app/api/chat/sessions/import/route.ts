import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportMessage {
  role: string;
  content: string;
}

interface ImportPayload {
  title?: string;
  messages: ImportMessage[];
}

/**
 * POST /api/chat/sessions/import
 * Import a chat session from a JSON export file.
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "登录已过期" }, { status: 401 });

  let body: ImportPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON 格式" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "消息列表不能为空" }, { status: 400 });
  }

  const validRoles = ["user", "assistant"];
  const messages = body.messages.filter(
    (m) => validRoles.includes(m.role) && typeof m.content === "string" && m.content.trim()
  );

  if (messages.length === 0) {
    return NextResponse.json({ error: "没有有效的消息" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim().slice(0, 100)
    : messages[0].content.slice(0, 30);

  const session = await prisma.chatSession.create({
    data: {
      userId: payload.userId,
      title,
      messages: {
        create: messages.map((m, i) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content.trim(),
          createdAt: new Date(Date.now() + i),
        })),
      },
    },
  });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title ?? title,
      messageCount: messages.length,
      updatedAt: session.updatedAt.toISOString(),
    },
  }, { status: 201 });
}
