/**
 * Custom Next.js dev server with integrated ASR WebSocket proxy.
 *
 * Replaces running `next dev` + `asr-proxy` separately.
 * All traffic enters on port 3000:
 *   ws(s)://<host>/api/asr  → proxied to ASR proxy on localhost:3001
 *   everything else         → handled by Next.js
 *
 * Usage: tsx src/server/dev-server.ts
 */

import { createServer } from "http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { spawn } from "child_process";
import { resolve } from "path";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const ASR_PROXY_PORT = parseInt(process.env.ASR_PROXY_PORT ?? "3001", 10);
const dev = process.env.NODE_ENV !== "production";
const dir = resolve(process.cwd());

// ---------------------------------------------------------------------------
// Start ASR proxy as a child process (internal, not exposed)
// ---------------------------------------------------------------------------

function startAsrProxy() {
  const child = spawn(
    "npx",
    ["tsx", "src/server/asr-proxy.ts"],
    {
      env: { ...process.env },
      stdio: "inherit",
    }
  );
  child.on("error", (err) => {
    console.error("[dev-server] Failed to start ASR proxy:", err.message);
  });
  return child;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const asrProxy = startAsrProxy();

  process.on("exit", () => asrProxy.kill());
  process.on("SIGINT", () => { asrProxy.kill(); process.exit(0); });
  process.on("SIGTERM", () => { asrProxy.kill(); process.exit(0); });

  const app = next({ dev, dir });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Intercept WebSocket upgrades
  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    if (pathname === "/api/asr") {
      // Proxy to internal ASR proxy
      const upstream = new WebSocket(`ws://localhost:${ASR_PROXY_PORT}`, {
        headers: {
          "x-forwarded-for":
            req.headers["x-forwarded-for"] ??
            (req.socket.remoteAddress ?? ""),
        },
      });

      upstream.on("open", () => {
        const clientWss = new WebSocketServer({ noServer: true });
        clientWss.handleUpgrade(req, socket, head, (clientWs) => {
          clientWs.on("message", (data) => {
            if (upstream.readyState === WebSocket.OPEN) {
              upstream.send(data);
            }
          });
          clientWs.on("close", () => upstream.close());
          clientWs.on("error", () => upstream.close());

          upstream.on("message", (data) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data);
            }
          });
          upstream.on("close", () => clientWs.close());
          upstream.on("error", () => clientWs.close());
        });
      });

      upstream.on("error", (err) => {
        console.error("[dev-server] ASR upstream error:", err.message);
        socket.destroy();
      });

      return;
    }

    // All other upgrades (Next.js HMR, etc.) — let Next.js handle
    const upgradeHandler = app.getUpgradeHandler?.();
    if (upgradeHandler) {
      upgradeHandler(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[dev-server] Ready on http://localhost:${PORT}`);
    console.log(`[dev-server] ASR proxy forwarding /api/asr → localhost:${ASR_PROXY_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
