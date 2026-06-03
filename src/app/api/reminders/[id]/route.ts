import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.medicationReminder.findFirst({
    where: { id, userId: sessionUser.userId },
  });
  if (!existing) {
    return Response.json({ error: "提醒不存在" }, { status: 404 });
  }

  let body: {
    title?: string;
    description?: string;
    frequency?: string;
    reminderTimes?: string[];
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.frequency !== undefined) updateData.frequency = body.frequency;
  if (body.reminderTimes !== undefined) updateData.reminderTimes = body.reminderTimes;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

  const reminder = await prisma.medicationReminder.update({
    where: { id },
    data: updateData,
  });

  return Response.json({ reminder });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.medicationReminder.findFirst({
    where: { id, userId: sessionUser.userId },
  });
  if (!existing) {
    return Response.json({ error: "提醒不存在" }, { status: 404 });
  }

  await prisma.medicationReminder.delete({ where: { id } });

  return Response.json({ success: true });
}
