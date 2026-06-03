import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";
const APP_ID = process.env.ASR_APP_ID ?? "";
const ACCESS_TOKEN = process.env.ASR_ACCESS_TOKEN ?? "";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  if (!APP_ID || !ACCESS_TOKEN) {
    return Response.json({ error: "TTS not configured" }, { status: 503 });
  }

  const reqid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const ttsRes = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${ACCESS_TOKEN}`,
      "Resource-Id": "volc.tts.default",
    },
    body: JSON.stringify({
      app: { appid: APP_ID, token: ACCESS_TOKEN, cluster: "volcano_tts" },
      user: { uid: sessionUser.userId },
      audio: {
        voice_type: "BV001_streaming",
        encoding: "mp3",
        speed_ratio: 1.0,
        volume_ratio: 1.0,
        pitch_ratio: 1.0,
      },
      request: {
        reqid,
        text,
        text_type: "plain",
        operation: "query",
        with_frontend: 1,
        frontend_type: "unitTson",
      },
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text().catch(() => "");
    console.error("[TTS] API error:", ttsRes.status, err);
    return Response.json({ error: `TTS API error: ${ttsRes.status}` }, { status: 502 });
  }

  const data = await ttsRes.json() as { code?: number; data?: string; message?: string };

  if (data.code !== 3000 || !data.data) {
    console.error("[TTS] Bad response:", data);
    return Response.json({ error: data.message ?? "TTS failed" }, { status: 502 });
  }

  // data.data is base64-encoded mp3
  const audioBuffer = Buffer.from(data.data, "base64");
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
