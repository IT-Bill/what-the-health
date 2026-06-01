import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const favorites = await prisma.postFavorite.findMany({
      where: { authorId: payload.userId },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            excerpt: true,
            coverImage: true,
            category: true,
            categoryIcon: true,
            readMinutes: true,
            publishedAt: true,
            author: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    return NextResponse.json(
      { error: "获取收藏失败" },
      { status: 500 }
    );
  }
}
