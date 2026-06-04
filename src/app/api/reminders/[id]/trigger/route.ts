import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const reminder = await prisma.medicationReminder.findFirst({
    where: { id, userId: sessionUser.userId },
  });

  if (!reminder) {
    return Response.json({ error: "提醒不存在" }, { status: 404 });
  }

  await prisma.medicationReminder.update({
    where: { id },
    data: { lastRemindedAt: new Date() },
  });

  return Response.json({ ok: true });
}
