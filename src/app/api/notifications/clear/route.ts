import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  await prisma.notification.deleteMany({
    where: { userId: sessionUser.userId },
  });

  return Response.json({ ok: true });
}