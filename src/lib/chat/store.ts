import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  Message,
  ChatSession,
  PendingImage,
  AgentState,
} from "./types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ChatState {
  messages: Message[];
  sessionId: string | undefined;
  sessions: ChatSession[];
  isStreaming: boolean;
  currentAgentState: AgentState;
  streamingMessageId: string | null;
  input: string;
  error: string | null;
  showSidebar: boolean;
  showAttachmentMenu: boolean;
  pendingImage: PendingImage | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface ChatActions {
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  insertMessage: (index: number, message: Message) => void;
  removeMessage: (id: string) => void;
  truncateMessagesFrom: (id: string) => Message[];
  clearMessages: () => void;

  setSessionId: (id: string | undefined) => void;
  setSessions: (sessions: ChatSession[]) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  removeSession: (id: string) => void;

  setIsStreaming: (v: boolean) => void;
  setCurrentAgentState: (state: AgentState) => void;
  setStreamingMessageId: (id: string | null) => void;

  setInput: (v: string) => void;
  setError: (error: string | null) => void;
  setShowSidebar: (v: boolean) => void;
  setShowAttachmentMenu: (v: boolean) => void;
  setPendingImage: (image: PendingImage | null) => void;

  getMessageById: (id: string) => Message | undefined;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const DEFAULT_INIT_MESSAGE =
  "欢迎回来。我是 Mindful，你的疗愈陪伴者。在这个当下，你感觉如何？";

const initialState: ChatState = {
  messages: [
    {
      id: "init",
      role: "agent",
      content: DEFAULT_INIT_MESSAGE,
    },
  ],
  sessionId: undefined,
  sessions: [],
  isStreaming: false,
  currentAgentState: "idle",
  streamingMessageId: null,
  input: "",
  error: null,
  showSidebar: false,
  showAttachmentMenu: false,
  pendingImage: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState & ChatActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Messages
    setMessages: (messages) =>
      set((state) => ({
        messages:
          typeof messages === "function"
            ? messages(state.messages)
            : messages,
      })),

    addMessage: (message) =>
      set((state) => ({ messages: [...state.messages, message] })),

    updateMessage: (id, updates) =>
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      })),

    insertMessage: (index, message) =>
      set((state) => ({
        messages: [
          ...state.messages.slice(0, index),
          message,
          ...state.messages.slice(index),
        ],
      })),

    removeMessage: (id) =>
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id),
      })),

    truncateMessagesFrom: (id) => {
      const state = get();
      const index = state.messages.findIndex((m) => m.id === id);
      if (index === -1) return [];
      const removed = state.messages.slice(index);
      set({ messages: state.messages.slice(0, index) });
      return removed;
    },

    clearMessages: () =>
      set({
        messages: [
          {
            id: "init",
            role: "agent",
            content: DEFAULT_INIT_MESSAGE,
          },
        ],
      }),

    // Session
    setSessionId: (id) => set({ sessionId: id }),

    setSessions: (sessions) => set({ sessions }),

    updateSession: (id, updates) =>
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),

    removeSession: (id) =>
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      })),

    // Streaming / Agent state
    setIsStreaming: (v) => set({ isStreaming: v }),

    setCurrentAgentState: (state) => set({ currentAgentState: state }),

    setStreamingMessageId: (id) => set({ streamingMessageId: id }),

    // UI / Input
    setInput: (v) => set({ input: v }),

    setError: (error) => set({ error }),

    setShowSidebar: (v) => set({ showSidebar: v }),

    setShowAttachmentMenu: (v) => set({ showAttachmentMenu: v }),

    setPendingImage: (image) => set({ pendingImage: image }),

    // Selector
    getMessageById: (id) => get().messages.find((m) => m.id === id),
  }))
);

export default useChatStore;
