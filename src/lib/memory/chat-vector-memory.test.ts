import assert from "node:assert/strict";
import { buildChatMessageVectorContent } from "./chat-vector-memory";

const content = buildChatMessageVectorContent({
  sessionId: "session-1",
  role: "user",
  content: "我最近睡不好，下午喝咖啡会不会影响？",
  createdAt: new Date("2026-06-01T08:00:00.000Z"),
});

assert.match(content, /来源：chat-message/);
assert.match(content, /会话：session-1/);
assert.match(content, /角色：user/);
assert.match(content, /睡不好/);

console.log("chat vector memory formatter ok");
