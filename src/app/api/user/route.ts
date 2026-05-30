import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, gender, birthday, heightCm, weightKg } = body;

    if (!id) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (gender !== undefined) data.gender = gender;
    if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null;
    if (heightCm !== undefined) data.heightCm = heightCm ? parseInt(heightCm, 10) : null;
    if (weightKg !== undefined) data.weightKg = weightKg ? parseFloat(weightKg) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    const user = await prisma.users.update({
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
