// ---------------------------------------------------------------------------
// Chat Types — shared between store and components
// ---------------------------------------------------------------------------

export interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  lastMessage: string | null;
  pinned: boolean;
}

export interface SearchSource {
  title: string;
  url: string;
  content: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  label: string;
  status: "running" | "done" | "error";
  result?: string;
}

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  imageUrl?: string;
  reasoning?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
  preToolText?: string;
  turnCount?: number;
  sources?: SearchSource[];
  quickReplies?: string[];
}

export interface PendingImage {
  file: File;
  previewUrl: string;
  uploading: boolean;
  url?: string;
}

export type AgentState = "idle" | "thinking" | "tools";
