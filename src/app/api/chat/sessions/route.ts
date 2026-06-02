import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId: payload.userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 50,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, imageUrl: true, role: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title ?? "新对话",
        pinned: s.pinned,
        messageCount: s._count.messages,
        updatedAt: s.updatedAt.toISOString(),
        lastMessage: (s.messages[0]?.content.slice(0, 60) || (s.messages[0]?.imageUrl ? "[图片]" : null)) ?? null,
      })),
    });
  } catch (error) {
    console.error("Chat sessions error:", error);
    return NextResponse.json({ error: "获取会话列表失败" }, { status: 500 });
  }
}
