import { schedule } from "node-cron";

const API_URL = process.env.REMINDER_CHECK_URL || "http://localhost:3000/api/reminders/check";

console.log("[ReminderCron] Starting reminder cron job...");
console.log("[ReminderCron] API endpoint:", API_URL);

async function triggerCheck() {
  console.log("[ReminderCron] Checking reminders at", new Date().toISOString());
  try {
    const response = await fetch(API_URL, { method: "POST" });
    if (!response.ok) {
      console.error("[ReminderCron] HTTP error:", response.status, response.statusText);
      return;
    }
    const result = await response.json() as { checked: number; sent: number; errors: number };
    console.log(
      `[ReminderCron] Checked ${result.checked}, sent ${result.sent}, errors ${result.errors}`
    );
  } catch (err) {
    console.error("[ReminderCron] Error:", err);
  }
}

// Check every 5 minutes
schedule("*/5 * * * *", () => {
  void triggerCheck();
});

// Also run immediately on startup
void triggerCheck();

// Keep process alive
setInterval(() => {}, 60000);
