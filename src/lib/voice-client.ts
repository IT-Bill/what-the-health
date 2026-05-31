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

  const { hostname, host, protocol } = window.location;
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalDev) return "ws://localhost:3001";

  if (protocol === "http:") {
    return `ws://${hostname}:3001`;
  }

  return `wss://${host}/api/asr`;
}
