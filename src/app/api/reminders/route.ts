import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import type { ReminderFrequency } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const reminders = await prisma.medicationReminder.findMany({
    where: { userId: sessionUser.userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ reminders });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let body: {
    title?: string;
    description?: string;
    frequency?: ReminderFrequency;
    reminderTimes?: string[];
    startDate?: string;
    endDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return Response.json({ error: "title 为必填项" }, { status: 400 });
  }
  if (!body.frequency || !body.reminderTimes?.length) {
    return Response.json({ error: "frequency 和 reminderTimes 为必填项" }, { status: 400 });
  }

  const reminder = await prisma.medicationReminder.create({
    data: {
      userId: sessionUser.userId,
      title,
      description: body.description?.trim() || null,
      frequency: body.frequency,
      reminderTimes: body.reminderTimes,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  return Response.json({ reminder }, { status: 201 });
}
