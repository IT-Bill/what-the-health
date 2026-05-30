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

    const existingUser = await prisma.users.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "该账号已被注册" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        username,
        passwordHash,
        name: "",
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
      },
    });

    const token = await signToken({ userId: user.id, username: user.username });
    await setAuthCookie(token);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
