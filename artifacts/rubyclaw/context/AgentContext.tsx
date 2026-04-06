import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export type MessageRole = "user" | "assistant" | "tool_call" | "tool_result";

export interface CustomSkill {
  id: string;
  name: string;
  description: string;
  type: "api" | "action" | "prompt";
  endpoint?: string;
  action?: string;
  promptTemplate?: string;
  createdAt: number;
}

export interface Attachment {
  name: string;
  type: "image" | "file";
  uri: string;
  base64?: string;
}

export interface ToolEvent {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  toolEvent?: ToolEvent;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface AgentContextValue {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  webSearchEnabled: boolean;
  localServerUrl: string;
  setWebSearchEnabled: (v: boolean) => void;
  setLocalServerUrl: (url: string) => void;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  stopStreaming: () => void;
  newConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearMessages: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const STORAGE_KEY = "rubyclaw_v2_conversations";

let msgCounter = 0;
function genId(): string {
  msgCounter++;
  return `m-${Date.now()}-${msgCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [localServerUrl, setLocalServerUrl] = useState("");
  const abortRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef<Message[]>([]);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    loadAllConversations();
  }, []);

  async function loadAllConversations() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const convos: Conversation[] = JSON.parse(raw);
        setConversations(convos);
      }
    } catch {}
  }

  async function persist(convos: Conversation[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 50)));
    } catch {}
  }

  function newConversation() {
    const id = genId();
    const convo: Conversation = {
      id,
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };
    setActiveConversationId(id);
    setMessages([]);
    setConversations((prev) => {
      const updated = [convo, ...prev];
      persist(updated);
      return updated;
    });
  }

  function loadConversation(id: string) {
    const convo = conversations.find((c) => c.id === id);
    if (convo) {
      setActiveConversationId(id);
      setMessages(convo.messages);
    }
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      persist(updated);
      return updated;
    });
    if (activeConversationId === id) {
      setMessages([]);
      setActiveConversationId(null);
    }
  }

  function clearMessages() {
    newConversation();
  }

  function saveMessages(convId: string, msgs: Message[]) {
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        const firstUserMsg = msgs.find((m) => m.role === "user")?.content;
        return {
          ...c,
          messages: msgs,
          title: firstUserMsg ? firstUserMsg.slice(0, 50) : c.title,
        };
      });
      persist(updated);
      return updated;
    });
  }

  function stopStreaming() {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }

  const sendMessage = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (isStreaming) return;

      let convId = activeConversationId;
      if (!convId) {
        convId = genId();
        const convo: Conversation = {
          id: convId,
          title: text.slice(0, 50),
          messages: [],
          createdAt: Date.now(),
        };
        setActiveConversationId(convId);
        setConversations((prev) => {
          const updated = [convo, ...prev];
          persist(updated);
          return updated;
        });
      }

      const userMsg: Message = {
        id: genId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
        attachments,
      };

      const snapshot = [...messagesRef.current, userMsg];
      setMessages(snapshot);

      setIsStreaming(true);
      let aborted = false;
      abortRef.current = () => {
        aborted = true;
      };

      // Build history for backend — only user/assistant messages
      const chatHistory = snapshot
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.role === "user" && m.attachments?.length
            ? `${m.content}\n[Attached: ${m.attachments.map((a) => a.name).join(", ")}]`
            : m.content,
        }));

      // Use local llama.cpp server if configured, else Replit AI backend
      const endpoint = localServerUrl
        ? `${localServerUrl.replace(/\/$/, "")}/v1/chat/completions`
        : `${getApiBase()}/chat`;

      let currentMessages = [...snapshot];

      try {
        if (localServerUrl) {
          // llama.cpp server API (OpenAI-compatible)
          await streamLlamaServer(
            endpoint,
            chatHistory,
            (chunk) => {
              if (aborted) return;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.isStreaming && last.role === "assistant") {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + chunk,
                  };
                  currentMessages = updated;
                  return updated;
                } else {
                  const newMsg: Message = {
                    id: genId(),
                    role: "assistant",
                    content: chunk,
                    timestamp: Date.now(),
                    isStreaming: true,
                  };
                  currentMessages = [...prev, newMsg];
                  return currentMessages;
                }
              });
            }
          );
        } else {
          // Replit AI backend with tool calling
          await streamBackend(
            endpoint,
            chatHistory,
            webSearchEnabled,
            {
              onContent: (chunk) => {
                if (aborted) return;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.isStreaming && last.role === "assistant") {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + chunk,
                    };
                    currentMessages = updated;
                    return updated;
                  } else {
                    const newMsg: Message = {
                      id: genId(),
                      role: "assistant",
                      content: chunk,
                      timestamp: Date.now(),
                      isStreaming: true,
                    };
                    currentMessages = [...prev, newMsg];
                    return currentMessages;
                  }
                });
              },
              onToolCall: (toolEvent) => {
                if (aborted) return;
                const toolMsg: Message = {
                  id: genId(),
                  role: "tool_call",
                  content: `Calling ${toolEvent.name}...`,
                  timestamp: Date.now(),
                  toolEvent,
                };
                currentMessages = [...currentMessages, toolMsg];
                setMessages([...currentMessages]);
              },
              onToolResult: (toolEvent) => {
                if (aborted) return;
                const resultMsg: Message = {
                  id: genId(),
                  role: "tool_result",
                  content: toolEvent.result || "",
                  timestamp: Date.now(),
                  toolEvent,
                };
                currentMessages = [...currentMessages, resultMsg];
                setMessages([...currentMessages]);
              },
            }
          );
        }
      } catch (e) {
        if (!aborted) {
          const errMsg: Message = {
            id: genId(),
            role: "assistant",
            content: `Error: ${e instanceof Error ? e.message : String(e)}\n\nCheck your connection or try again.`,
            timestamp: Date.now(),
          };
          currentMessages = [...currentMessages, errMsg];
          setMessages(currentMessages);
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) => {
          const finalized = prev.map((m) =>
            m.isStreaming ? { ...m, isStreaming: false } : m
          );
          saveMessages(convId!, finalized);
          return finalized;
        });
      }
    },
    [isStreaming, activeConversationId, webSearchEnabled, localServerUrl]
  );

  return (
    <AgentContext.Provider
      value={{
        messages,
        conversations,
        activeConversationId,
        isStreaming,
        webSearchEnabled,
        localServerUrl,
        setWebSearchEnabled,
        setLocalServerUrl,
        sendMessage,
        stopStreaming,
        newConversation,
        loadConversation,
        deleteConversation,
        clearMessages,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

async function streamBackend(
  endpoint: string,
  messages: Array<{ role: string; content: string }>,
  webSearch: boolean,
  handlers: {
    onContent: (chunk: string) => void;
    onToolCall: (event: ToolEvent) => void;
    onToolResult: (event: ToolEvent) => void;
  }
) {
  const { fetch } = await import("expo/fetch");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ messages, webSearch }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`Server error ${res.status}: ${errText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw) as {
          content?: string;
          toolCall?: { name: string; args: Record<string, unknown> };
          toolResult?: { name: string; result: string };
          error?: string;
          done?: boolean;
        };
        if (parsed.content) handlers.onContent(parsed.content);
        if (parsed.toolCall) handlers.onToolCall(parsed.toolCall);
        if (parsed.toolResult) handlers.onToolResult(parsed.toolResult);
        if (parsed.error) throw new Error(parsed.error);
      } catch {}
    }
  }
}

async function streamLlamaServer(
  endpoint: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void
) {
  const { fetch } = await import("expo/fetch");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) throw new Error(`llama.cpp server error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") break;
      try {
        const parsed = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch {}
    }
  }
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}
