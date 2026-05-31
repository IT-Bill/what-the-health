import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as { title?: string; pinned?: boolean };

    const existing = await prisma.chatSession.findUnique({
      where: { id, userId: payload.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const data: { title?: string; pinned?: boolean } = {};
    if (typeof body.title === "string") {
      data.title = body.title.trim() || "新对话";
    }
    if (typeof body.pinned === "boolean") {
      data.pinned = body.pinned;
    }

    const session = await prisma.chatSession.update({
      where: { id },
      data,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title ?? "新对话",
        pinned: session.pinned,
        messageCount: session._count.messages,
        updatedAt: session.updatedAt.toISOString(),
        lastMessage: session.messages[0]?.content.slice(0, 60) ?? null,
      },
    });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json({ error: "更新会话失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.chatSession.findUnique({
      where: { id, userId: payload.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    await prisma.chatSession.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "删除会话失败" }, { status: 500 });
  }
}
