export function getVoiceUnavailableMessage(): string | null {
  if (typeof window === "undefined") return null;

  if (!window.isSecureContext) {
    return "手机浏览器只允许在 HTTPS 或 localhost 页面使用麦克风。当前局域网 HTTP 地址无法录音，请改用 HTTPS 访问。";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "当前浏览器不支持麦克风录音，请换用支持录音权限的浏览器。";
  }

  return null;
}

export function getAsrWebSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ASR_WS_URL;
  if (configured) return configured;

  const { hostname, protocol } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost && protocol === "http:") {
    // Local dev without proxy: connect directly to ASR proxy
    return "ws://localhost:3001";
  }

  // LAN dev (via dev:lan) or production: proxy through /api/asr on same host
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.host}/api/asr`;
}
