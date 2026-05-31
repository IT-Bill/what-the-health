/**
 * Independent WebSocket proxy server for Volcano Engine (Doubao) ASR.
 *
 * This server runs alongside the Next.js dev server and proxies audio
 * data between the frontend and Doubao ASR service.
 *
 * Start alongside Next.js dev server:
 *   pnpm dev          (in terminal 1)
 *   pnpm asr-proxy    (in terminal 2)
 *
 * The frontend connects to ws://localhost:3001 and this server
 * forwards to Doubao ASR via wss://openspeech.bytedance.com.
 */

import { config } from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { gzipSync, gunzipSync } from "zlib";

// Load .env for standalone script execution
config({ path: ".env" });

const PORT = process.env.ASR_PROXY_PORT ? parseInt(process.env.ASR_PROXY_PORT, 10) : 3001;
const ASR_API_KEY = process.env.ASR_API_KEY ?? "";
const ASR_APP_ID = process.env.ASR_APP_ID ?? "";
const ASR_ACCESS_TOKEN = process.env.ASR_ACCESS_TOKEN ?? "";
const ASR_RESOURCE_ID = process.env.ASR_RESOURCE_ID ?? "volc.seedasr.sauc.duration";
const ASR_BASE_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";

// ---------------------------------------------------------------------------
// Doubao Binary Protocol
// ---------------------------------------------------------------------------

const ProtocolVersion = {
  V1: 0b0001,
};

const MessageType = {
  CLIENT_FULL_REQUEST: 0b0001,
  CLIENT_AUDIO_ONLY_REQUEST: 0b0010,
  SERVER_FULL_RESPONSE: 0b1001,
  SERVER_ERROR_RESPONSE: 0b1111,
};

const MessageTypeSpecificFlags = {
  NO_SEQUENCE: 0b0000,
  POS_SEQUENCE: 0b0001,
  NEG_SEQUENCE: 0b0010,
  NEG_WITH_SEQUENCE: 0b0011,
};

const SerializationType = {
  NO_SERIALIZATION: 0b0000,
  JSON: 0b0001,
};

const CompressionType = {
  NO_COMPRESSION: 0b0000,
  GZIP: 0b0001,
};

function encodeDoubaoFrame(
  messageType: number,
  seq: number,
  payload: Buffer,
  messageSpecificFlags = MessageTypeSpecificFlags.POS_SEQUENCE
): Buffer {
  const headerSizeValue = 1; // 1 x 4 = 4 bytes for the base header
  const serializationType = SerializationType.JSON;
  const compressionType = CompressionType.GZIP;

  // Base header: 4 bytes
  // [version(4bit) | header_size(4bit)] [msg_type(4bit) | flags(4bit)] [serialization(4bit) | compression(4bit)] [reserved(8bit)]
  const header = Buffer.alloc(4);
  header[0] = (ProtocolVersion.V1 << 4) | headerSizeValue;
  header[1] = (messageType << 4) | messageSpecificFlags;
  header[2] = (serializationType << 4) | compressionType;
  header[3] = 0x00; // reserved

  const compressedPayload = gzipSync(payload);
  const hasSeq = messageSpecificFlags !== MessageTypeSpecificFlags.NO_SEQUENCE;
  const seqBytes = hasSeq ? 4 : 0;
  const frame = Buffer.alloc(4 + seqBytes + 4 + compressedPayload.length);
  header.copy(frame, 0);
  let offset = 4;
  if (hasSeq) {
    frame.writeInt32BE(seq, offset);
    offset += 4;
  }
  frame.writeUInt32BE(compressedPayload.length, offset);
  compressedPayload.copy(frame, offset + 4);
  return frame;
}

function decodeDoubaoFrame(data: Buffer): { messageType: number; payload: Buffer; isLast: boolean; code: number } | null {
  if (data.length < 4) return null;

  const headerSizeValue = data[0] & 0x0f;
  const messageType = (data[1] >> 4) & 0x0f;
  const messageTypeSpecificFlags = data[1] & 0x0f;
  const serializationMethod = (data[2] >> 4) & 0x0f;
  const messageCompression = data[2] & 0x0f;

  let payload = data.subarray(headerSizeValue * 4);
  let isLast = false;
  let code = 0;

  // Parse message_type_specific_flags
  if (messageTypeSpecificFlags & 0x01) {
    // Has sequence number
    payload = payload.subarray(4);
  }
  if (messageTypeSpecificFlags & 0x02) {
    isLast = true;
  }
  if (messageTypeSpecificFlags & 0x04) {
    // Has event
    payload = payload.subarray(4);
  }

  // Parse message_type
  if (messageType === MessageType.SERVER_FULL_RESPONSE) {
    const payloadSize = payload.readUInt32BE(0);
    payload = payload.subarray(4, 4 + payloadSize);
  } else if (messageType === MessageType.SERVER_ERROR_RESPONSE) {
    code = payload.readInt32BE(0);
    const payloadSize = payload.readUInt32BE(4);
    payload = payload.subarray(8, 8 + payloadSize);
  }

  if (payload.length === 0) {
    return { messageType, payload: Buffer.alloc(0), isLast, code };
  }

  // Decompress
  if (messageCompression === CompressionType.GZIP) {
    try {
      payload = gunzipSync(payload);
    } catch {
      return null;
    }
  }

  // Parse JSON if applicable
  if (serializationMethod === SerializationType.JSON) {
    return { messageType, payload, isLast, code };
  }

  return { messageType, payload, isLast, code };
}

// ---------------------------------------------------------------------------
// Client Connection Handler
// ---------------------------------------------------------------------------

function handleClientConnection(clientWs: WebSocket) {
  let asrWs: WebSocket | null = null;
  let sessionStarted = false;
  let language = "zh-CN";
  let bufferedAudio: Buffer[] = [];
  let asrConnected = false;
  let seq = 1;

  function sendToClient(data: unknown) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(data));
    }
  }

  function sendError(message: string) {
    sendToClient({ type: "error", message });
  }

  function buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "X-Api-Resource-Id": ASR_RESOURCE_ID,
      "X-Api-Request-Id": crypto.randomUUID(),
      "X-Api-Sequence": "-1",
    };
    if (ASR_API_KEY) {
      headers["X-Api-Key"] = ASR_API_KEY;
    } else {
      headers["X-Api-App-Key"] = ASR_APP_ID;
      headers["X-Api-Access-Key"] = ASR_ACCESS_TOKEN;
    }
    return headers;
  }

  function buildFullClientRequest(seqNum: number): Buffer {
    const payload = {
      user: {
        uid: "user_" + crypto.randomUUID().slice(0, 8),
      },
      audio: {
        format: "pcm",
        codec: "raw",
        rate: 16000,
        bits: 16,
        channel: 1,
        language,
      },
      request: {
        model_name: "bigmodel",
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
        enable_nonstream: false,
      },
    };

    const payloadBytes = Buffer.from(JSON.stringify(payload), "utf-8");
    return encodeDoubaoFrame(
      MessageType.CLIENT_FULL_REQUEST,
      seqNum,
      payloadBytes,
      MessageTypeSpecificFlags.NO_SEQUENCE
    );
  }

  function buildAudioRequest(seqNum: number, segment: Buffer, isLast: boolean): Buffer {
    const flags = isLast ? MessageTypeSpecificFlags.NEG_WITH_SEQUENCE : MessageTypeSpecificFlags.POS_SEQUENCE;
    const effectiveSeq = isLast ? -seqNum : seqNum;
    return encodeDoubaoFrame(MessageType.CLIENT_AUDIO_ONLY_REQUEST, effectiveSeq, segment, flags);
  }

  function connectToAsr() {
    if (asrWs) return;

    const headers = buildAuthHeaders();

    console.log("[ASR] Connecting with headers:", {
      resourceId: ASR_RESOURCE_ID,
      hasApiKey: !!ASR_API_KEY,
    });

    const ws = new WebSocket(ASR_BASE_URL, { headers });
    asrWs = ws;

    ws.on("unexpected-response", (_req, res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => console.error("[ASR] Unexpected response:", res.statusCode, body));
    });

    ws.on("open", () => {
      asrConnected = true;
      console.log("[ASR] Connected successfully");

      const fullRequest = buildFullClientRequest(seq);
      seq++;
      ws.send(fullRequest);
      console.log("[ASR] Sent full client request, seq:", seq - 1);

      for (const chunk of bufferedAudio) {
        const audioFrame = buildAudioRequest(seq, chunk, false);
        seq++;
        ws.send(audioFrame);
      }
      bufferedAudio = [];
    });

    ws.on("message", (data: Buffer) => {
      const frame = decodeDoubaoFrame(data);
      if (!frame) {
        console.log("[ASR] Failed to decode frame, length:", data.length);
        return;
      }

      console.log("[ASR] Received message type:", frame.messageType, "isLast:", frame.isLast, "code:", frame.code);

      if (frame.messageType === MessageType.SERVER_FULL_RESPONSE) {
        try {
          const result = JSON.parse(frame.payload.toString("utf-8"));
          const fullText: string = result.result?.text ?? "";
          const utterances: { text: string; definite: boolean }[] = result.result?.utterances ?? [];
          const lastWithText = [...utterances].reverse().find(u => u.text);
          if (fullText || lastWithText) {
            sendToClient({
              type: "result",
              text: fullText,
              isFinal: lastWithText?.definite === true,
            });
          }
        } catch {
          // ignore malformed response
        }
      } else if (frame.messageType === MessageType.SERVER_ERROR_RESPONSE) {
        const text = frame.payload.toString("utf-8");
        console.error("[ASR] Server error:", frame.code, text);
        sendError(`ASR server error: ${text}`);
      }
    });

    ws.on("error", (err: Error & { response?: { statusCode?: number; headers?: Record<string, string> } }) => {
      console.error("[ASR] WebSocket error:", err.message, err.response?.statusCode, err.response?.headers);
      sendError("ASR connection error");
    });

    ws.on("close", () => {
      asrConnected = false;
      asrWs = null;
    });
  }

  function sendAudioChunk(chunk: Buffer) {
    if (!asrConnected || !asrWs) {
      bufferedAudio.push(chunk);
      return;
    }
    const frame = buildAudioRequest(seq, chunk, false);
    seq++;
    asrWs.send(frame);
  }

  function closeAsr() {
    if (asrWs && asrWs.readyState === WebSocket.OPEN) {
      // Send last audio frame with NEG_WITH_SEQUENCE flag
      const closeFrame = buildAudioRequest(seq, Buffer.alloc(0), true);
      asrWs.send(closeFrame);
      console.log("[ASR] Sent close frame, seq:", seq);
      asrWs.close();
    }
    asrWs = null;
  }

  clientWs.on("message", (data: Buffer | ArrayBuffer | string) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    // Detect JSON control messages (start/end) vs binary audio
    if (buf[0] === 0x7b) {
      try {
        const msg = JSON.parse(buf.toString("utf-8"));
        if (msg.type === "start") {
          if (sessionStarted) { sendError("Session already started"); return; }
          sessionStarted = true;
          language = msg.language ?? "zh-CN";
          connectToAsr();
        } else if (msg.type === "end") {
          closeAsr();
          clientWs.close();
        }
        return;
      } catch { /* not JSON, fall through to audio */ }
    }

    if (!sessionStarted) { sendError("Session not started"); return; }
    sendAudioChunk(buf);
  });

  clientWs.on("close", () => {
    closeAsr();
  });

  clientWs.on("error", (err) => {
    console.error("[ASR] Client error:", err);
    closeAsr();
  });
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", handleClientConnection);

wss.on("listening", () => {
  console.log(`[ASR Proxy] WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on("error", (err) => {
  console.error("[ASR Proxy] Server error:", err);
});
