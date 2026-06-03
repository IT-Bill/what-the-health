import { checkAndSendReminders } from "@/lib/reminder-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await checkAndSendReminders();
  return Response.json(result);
}
