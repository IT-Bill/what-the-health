export {};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  source: string | null;
  actionUrl: string | null;
  metadata: JsonValue;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationListResponse = {
  notifications: NotificationItem[];
};

type NotificationMutationResponse = {
  notification: NotificationItem;
};

type PullNotificationResponse = {
  notification: NotificationItem | null;
};

type LoginResponse = {
  user: {
    id: string;
    username: string;
    name: string;
  };
};

type Mode = "smoke" | "full";

class TestFailure extends Error {}

class SessionClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {});
    if (this.cookies.size > 0) {
      headers.set("cookie", this.cookieHeader());
    }

    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers,
      redirect: "manual",
    });

    this.captureCookies(response);
    return response;
  }

  private cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private captureCookies(response: Response) {
    const rawHeaderBag = response.headers as Headers & {
      getSetCookie?: () => string[];
    };

    const rawCookies = rawHeaderBag.getSetCookie?.() ?? [];
    const cookieLines = rawCookies.length > 0
      ? rawCookies
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

    for (const cookieLine of cookieLines) {
      const firstPart = cookieLine.split(";", 1)[0];
      const separatorIndex = firstPart.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }
      const name = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      if (!name) {
        continue;
      }
      this.cookies.set(name, value);
    }
  }
}

function parseArgs(argv: string[]) {
  const full = argv.includes("--full");
  const help = argv.includes("--help") || argv.includes("-h");
  const useSecret = argv.includes("--use-secret");
  const keep = argv.includes("--keep");

  return {
    help,
    keep,
    useSecret,
    mode: full ? "full" as Mode : "smoke" as Mode,
  };
}

function printHelp() {
  console.log(`Notification API testbench

Usage:
  pnpm test:notifications
  pnpm test:notifications --full
  pnpm test:notifications --use-secret
  pnpm test:notifications --keep

Required environment variables:
  NOTIFICATION_TEST_USERNAME   Login username for the test account
  NOTIFICATION_TEST_PASSWORD   Login password for the test account

Optional environment variables:
  NOTIFICATION_TEST_BASE_URL   Base URL for the app (default: http://localhost:3000)
  NOTIFICATION_API_SECRET      Secret used by POST /api/notifications for cross-user sends

Modes:
  smoke  Non-destructive flow: auth guard, login, create, list, read, unread, delete
  full   Assumes a disposable test account: clears inbox, tests pull and clear-all too

Notes:
  --full will call POST /api/notifications/clear at the beginning and end.
  --keep leaves the created notification in the inbox for popup verification.
  Use a dedicated test account for full mode.
`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new TestFailure(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TestFailure(`Expected JSON response, received: ${text || "<empty>"}`);
  }
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status === expected) {
    return;
  }

  const bodyText = await response.text();
  throw new TestFailure(
    `${label} expected status ${expected}, received ${response.status}. Body: ${bodyText || "<empty>"}`
  );
}

function step(label: string) {
  console.log(`\n[step] ${label}`);
}

function pass(label: string) {
  console.log(`[pass] ${label}`);
}

function info(label: string) {
  console.log(`[info] ${label}`);
}

async function login(session: SessionClient, username: string, password: string) {
  const response = await session.request("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  await expectStatus(response, 200, "login");
  const data = await readJson<LoginResponse>(response);
  assert(data.user.username === username, "Login returned an unexpected user");
  pass(`Logged in as ${data.user.username}`);
  return data.user;
}

async function createNotification(
  session: SessionClient,
  baseUrl: string,
  options: {
    username: string;
    title: string;
    body: string;
    useSecret: boolean;
    secret?: string;
    metadata?: JsonValue;
  }
) {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const payload: Record<string, JsonValue> = {
    title: options.title,
    body: options.body,
    source: "notification-api-testbench",
    actionUrl: "/notifications",
    metadata: options.metadata ?? null,
  };

  if (options.useSecret) {
    assert(options.secret, "--use-secret requires NOTIFICATION_API_SECRET");
    headers.set("Authorization", `Bearer ${options.secret}`);
    payload.username = options.username;

    const response = await fetch(new URL("/api/notifications", baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    await expectStatus(response, 201, "create notification via secret");
    const data = await readJson<NotificationMutationResponse>(response);
    pass(`Created notification via secret: ${data.notification.id}`);
    return data.notification;
  }

  const response = await session.request("/api/notifications", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  await expectStatus(response, 201, "create notification via session");
  const data = await readJson<NotificationMutationResponse>(response);
  pass(`Created notification via session: ${data.notification.id}`);
  return data.notification;
}

async function listNotifications(session: SessionClient) {
  const response = await session.request("/api/notifications?limit=100");
  await expectStatus(response, 200, "list notifications");
  return readJson<NotificationListResponse>(response);
}

async function clearNotifications(session: SessionClient, label: string) {
  const response = await session.request("/api/notifications/clear", {
    method: "POST",
  });
  await expectStatus(response, 200, label);
  pass(label);
}

async function markNotification(session: SessionClient, id: string, action: "read" | "unread") {
  const response = await session.request(`/api/notifications/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  await expectStatus(response, 200, `mark notification ${action}`);
  const data = await readJson<NotificationMutationResponse>(response);
  pass(`Notification ${id} marked ${action}`);
  return data.notification;
}

async function deleteNotification(session: SessionClient, id: string) {
  const response = await session.request(`/api/notifications/${id}`, {
    method: "DELETE",
  });
  await expectStatus(response, 200, "delete notification");
  pass(`Deleted notification ${id}`);
}

async function pullNotification(session: SessionClient) {
  const response = await session.request("/api/notifications/pull", {
    method: "POST",
  });
  await expectStatus(response, 200, "pull notification");
  return readJson<PullNotificationResponse>(response);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = process.env.NOTIFICATION_TEST_BASE_URL ?? "http://localhost:3000";
  const username = process.env.NOTIFICATION_TEST_USERNAME;
  const password = process.env.NOTIFICATION_TEST_PASSWORD;
  const secret = process.env.NOTIFICATION_API_SECRET;

  assert(username, "Missing NOTIFICATION_TEST_USERNAME");
  assert(password, "Missing NOTIFICATION_TEST_PASSWORD");

  info(`Base URL: ${baseUrl}`);
  info(`Mode: ${args.mode}`);
  info(`Keep notification: ${args.keep ? "yes" : "no"}`);

  const anonymousResponse = await fetch(new URL("/api/notifications", baseUrl));
  await expectStatus(anonymousResponse, 401, "anonymous notifications GET");
  pass("Anonymous access is rejected");

  const session = new SessionClient(baseUrl);
  await login(session, username, password);

  if (args.mode === "full") {
    step("Reset inbox for deterministic full run");
    await clearNotifications(session, "clear notifications before full run");
    const emptied = await listNotifications(session);
    assert(emptied.notifications.length === 0, "Expected empty inbox after reset");
    pass("Inbox reset confirmed");
  }

  step("Create notification and verify list endpoint");
  const runId = crypto.randomUUID();
  const created = await createNotification(session, baseUrl, {
    username,
    title: `Testbench ${runId}`,
    body: `Notification API integration test run ${runId}`,
    useSecret: args.useSecret,
    secret,
    metadata: {
      runId,
      mode: args.mode,
      createdBy: "notification-api-testbench",
    },
  });

  const listed = await listNotifications(session);
  const listedCreated = listed.notifications.find((item) => item.id === created.id);
  assert(listedCreated, "Created notification was not returned by GET /api/notifications");
  assert(listedCreated.unread, "Newly created notification should start unread");
  pass("List endpoint returned the created notification");

  if (args.mode === "full") {
    step("Pull pending notification and verify delivery marker");
    const pulled = await pullNotification(session);
    assert(pulled.notification, "Expected a pending notification from pull endpoint");
    assert(pulled.notification.id === created.id, "Pull returned a different notification than the one just created");
    assert(pulled.notification.deliveredAt, "Pulled notification should have deliveredAt set");
    pass("Pull endpoint returned and marked the created notification as delivered");
  }

  step("Toggle read state");
  const readNotification = await markNotification(session, created.id, "read");
  assert(!readNotification.unread, "Notification should be read after PATCH action=read");
  const unreadNotification = await markNotification(session, created.id, "unread");
  assert(unreadNotification.unread, "Notification should be unread after PATCH action=unread");
  pass("Read/unread transitions succeeded");

  if (args.keep) {
    info(`Keeping notification ${created.id} in the inbox for manual popup verification.`);
    info("Open the app in a logged-in browser session for the same user and wait for /api/notifications/pull to display it.");
  } else {
    step("Delete notification and verify it disappears");
    await deleteNotification(session, created.id);
    const afterDelete = await listNotifications(session);
    assert(!afterDelete.notifications.some((item) => item.id === created.id), "Deleted notification still appears in the list");
    pass("Delete endpoint removed the test notification");
  }

  if (args.mode === "full") {
    step("Create a second notification and verify clear-all");
    await createNotification(session, baseUrl, {
      username,
      title: `Testbench clear ${runId}`,
      body: `Notification clear-all test run ${runId}`,
      useSecret: args.useSecret,
      secret,
      metadata: { runId, phase: "clear-all" },
    });
    await clearNotifications(session, "clear notifications after full run");
    const finalState = await listNotifications(session);
    assert(finalState.notifications.length === 0, "Expected empty inbox after clear-all verification");
    pass("Clear-all endpoint removed all notifications in the test inbox");
  }

  console.log("\n[done] Notification API testbench completed successfully.");
}

main().catch((error) => {
  if (error instanceof TestFailure) {
    console.error(`\n[fail] ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error("\n[fail] Unexpected error during notification API testbench.");
  console.error(error);
  process.exitCode = 1;
});