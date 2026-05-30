import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "账号和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { username },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const token = await signToken({ userId: user.id, username: user.username });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        memberSince: user.memberSince,
        gender: user.gender,
        birthday: user.birthday,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
