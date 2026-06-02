import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidAgentRole } from "@/lib/agent-role";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { normalizePrimaryGoals, toLegacyPrimaryGoal } from "@/lib/primary-goals";

export async function PATCH(request: NextRequest) {
  try {
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      gender,
      birthday,
      heightCm,
      weightKg,
      targetWeightKg,
      targetBodyFatPct,
      dailyActiveCalories,
      dailyExerciseMinutes,
      dailyStepGoal,
      dailyActiveHours,
      agentRole,
      primaryGoals,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 400 }
      );
    }

    if (payload.userId !== id) {
      return NextResponse.json(
        { error: "无权修改该用户信息" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (gender !== undefined) data.gender = gender;
    if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null;
    if (heightCm !== undefined) data.heightCm = heightCm ? parseInt(heightCm, 10) : null;
    if (weightKg !== undefined) data.weightKg = weightKg ? parseFloat(weightKg) : null;
    if (targetWeightKg !== undefined) data.targetWeightKg = targetWeightKg ? parseFloat(targetWeightKg) : null;
    if (targetBodyFatPct !== undefined) data.targetBodyFatPct = targetBodyFatPct ? parseFloat(targetBodyFatPct) : null;
    if (dailyActiveCalories !== undefined) data.dailyActiveCalories = dailyActiveCalories ? parseInt(dailyActiveCalories, 10) : null;
    if (dailyExerciseMinutes !== undefined) data.dailyExerciseMinutes = dailyExerciseMinutes ? parseInt(dailyExerciseMinutes, 10) : null;
    if (dailyStepGoal !== undefined) data.dailyStepGoal = dailyStepGoal ? parseInt(dailyStepGoal, 10) : null;
    if (dailyActiveHours !== undefined) data.dailyActiveHours = dailyActiveHours ? parseFloat(dailyActiveHours) : null;
    if (primaryGoals !== undefined) {
      if (!Array.isArray(primaryGoals)) {
        return NextResponse.json(
          { error: "目标格式不正确" },
          { status: 400 }
        );
      }

      const normalizedPrimaryGoals = normalizePrimaryGoals(primaryGoals);
      if (normalizedPrimaryGoals.length === 0) {
        return NextResponse.json(
          { error: "请至少选择一个目标" },
          { status: 400 }
        );
      }

      data.primaryGoals = normalizedPrimaryGoals;
      data.primaryGoal = toLegacyPrimaryGoal(normalizedPrimaryGoals);
    }
    if (agentRole !== undefined) {
      if (agentRole && !isValidAgentRole(agentRole)) {
        return NextResponse.json(
          { error: "无效的 AI 陪伴风格" },
          { status: 400 }
        );
      }
      data.agentRole = agentRole || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        memberSince: true,
        gender: true,
        birthday: true,
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
        agentRole: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "更新失败，请稍后重试" },
      { status: 500 }
    );
  }
}
