import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { buildGoalParameterChatWelcome } from "@/lib/goal-parameter-setup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    let mode: "standard" | "profile-setup" = "standard";
    try {
      const body = (await request.json()) as { mode?: "standard" | "profile-setup" };
      if (body.mode === "profile-setup") {
        mode = "profile-setup";
      }
    } catch {
      // Allow empty request bodies for standard session creation.
    }

    if (mode === "profile-setup") {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          gender: true,
          heightCm: true,
          weightKg: true,
          targetWeightKg: true,
          targetBodyFatPct: true,
          dailyActiveCalories: true,
          dailyExerciseMinutes: true,
          dailyStepGoal: true,
          dailyActiveHours: true,
          primaryGoal: true,
          primaryGoals: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "登录已过期" }, { status: 401 });
      }

      const welcomeMessage = buildGoalParameterChatWelcome(user);
      if (!welcomeMessage) {
        return NextResponse.json({ session: null });
      }

      const existingSession = await prisma.chatSession.findFirst({
        where: {
          userId: payload.userId,
          messages: {
            some: { role: "assistant", content: welcomeMessage },
            none: { role: "user" },
          },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      });

      if (existingSession) {
        return NextResponse.json({
          session: { id: existingSession.id, title: existingSession.title ?? "完善目标参数" },
        });
      }

      const setupSession = await prisma.chatSession.create({
        data: {
          userId: payload.userId,
          title: "完善目标参数",
          messages: {
            create: {
              role: "assistant",
              content: welcomeMessage,
            },
          },
        },
        select: { id: true, title: true },
      });

      return NextResponse.json({
        session: { id: setupSession.id, title: setupSession.title ?? "完善目标参数" },
      });
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
