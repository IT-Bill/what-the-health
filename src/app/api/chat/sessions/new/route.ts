import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const session = await prisma.chatSession.create({
      data: { userId: payload.userId, title: "新对话" },
    });

    return NextResponse.json({ session: { id: session.id, title: session.title } });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
  }
}
