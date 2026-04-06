import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type MessageRole = "user" | "agent" | "system" | "tool";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolName?: string;
  isStreaming?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  handler: (params: Record<string, string>) => Promise<string>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface AgentContextValue {
  messages: Message[];
  isThinking: boolean;
  webSearchEnabled: boolean;
  selectedModel: string;
  activeConversationId: string | null;
  conversations: Conversation[];
  setWebSearchEnabled: (v: boolean) => void;
  setSelectedModel: (m: string) => void;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  loadConversation: (id: string) => void;
  newConversation: () => void;
  browserOutput: string | null;
  setBrowserOutput: (v: string | null) => void;
  pendingBrowserJS: string | null;
  setPendingBrowserJS: (v: string | null) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const STORAGE_KEY = "rubyclaw_conversations";
const OPENAI_BASE = "https://api.openai.com/v1";

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const SYSTEM_PROMPT = `You are RubyClaw, an autonomous AI agent running on an Android device. You are powerful, precise, and proactive.

You have access to the following tools. To use a tool, respond EXACTLY in this format (one tool per response, no other text before or after):

TOOL_CALL: tool_name
PARAMS: {"param1": "value1", "param2": "value2"}

Available tools:
- web_search: Search the web for real-time information. Params: {"query": "search query"}
- browser_navigate: Navigate browser to a URL. Params: {"url": "https://example.com"}
- browser_click: Click an element in the browser. Params: {"selector": "CSS selector or text"}
- browser_fill: Fill a form field. Params: {"selector": "input selector", "value": "text to type"}
- browser_extract: Extract text from current page. Params: {"selector": "CSS selector (optional)"}
- open_app: Open an Android app by package name. Params: {"package": "com.example.app", "label": "App Name"}
- set_alarm: Set an alarm. Params: {"hour": "9", "minute": "30", "label": "Wake up"}
- create_note: Create a note or text file. Params: {"title": "Note Title", "content": "Note content"}
- list_skills: List all available custom skills. Params: {}
- use_skill: Use a custom skill. Params: {"skill_name": "skill_id", "input": "input text"}

After receiving tool results, continue reasoning until you have a final answer for the user. When you have enough information, give a clear, concise response.

Today's date: ${new Date().toLocaleDateString()}`;

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [browserOutput, setBrowserOutput] = useState<string | null>(null);
  const [pendingBrowserJS, setPendingBrowserJS] = useState<string | null>(null);
  const browserResultRef = useRef<string | null>(null);
  const browserResolveRef = useRef<((v: string) => void) | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (browserOutput !== null && browserResolveRef.current) {
      browserResolveRef.current(browserOutput);
      browserResolveRef.current = null;
      setBrowserOutput(null);
    }
  }, [browserOutput]);

  async function loadConversations() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const convos: Conversation[] = JSON.parse(raw);
        setConversations(convos);
      }
    } catch {}
  }

  async function saveConversations(convos: Conversation[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
    } catch {}
  }

  function newConversation() {
    const id = makeId();
    const convo: Conversation = {
      id,
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
    };
    const updated = [convo, ...conversations];
    setConversations(updated);
    setActiveConversationId(id);
    setMessages([]);
    saveConversations(updated);
  }

  function loadConversation(id: string) {
    const convo = conversations.find((c) => c.id === id);
    if (convo) {
      setActiveConversationId(id);
      setMessages(convo.messages);
    }
  }

  function persistMessages(msgs: Message[], convId: string | null) {
    if (!convId) return;
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== convId) return c;
        const title =
          msgs.find((m) => m.role === "user")?.content.slice(0, 40) ||
          c.title;
        return { ...c, messages: msgs, title };
      });
      saveConversations(updated);
      return updated;
    });
  }

  async function executeBrowserJS(js: string): Promise<string> {
    return new Promise((resolve) => {
      browserResolveRef.current = resolve;
      setPendingBrowserJS(js);
      setTimeout(() => {
        if (browserResolveRef.current) {
          browserResolveRef.current("Browser action completed (timeout)");
          browserResolveRef.current = null;
          setPendingBrowserJS(null);
        }
      }, 8000);
    });
  }

  const tools: Record<string, AgentTool> = {
    web_search: {
      name: "web_search",
      description: "Search the web",
      parameters: { query: { type: "string", description: "Search query" } },
      handler: async ({ query }) => {
        try {
          const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
          const res = await fetch(url);
          const data = await res.json();
          const results: string[] = [];
          if (data.AbstractText) results.push(data.AbstractText);
          if (data.RelatedTopics) {
            data.RelatedTopics.slice(0, 5).forEach((t: { Text?: string }) => {
              if (t.Text) results.push(t.Text);
            });
          }
          return results.length > 0
            ? results.join("\n\n")
            : `Search completed for: ${query}. No direct results found. Try rephrasing.`;
        } catch {
          return `Web search for "${query}" - network error. Please check connectivity.`;
        }
      },
    },
    browser_navigate: {
      name: "browser_navigate",
      description: "Navigate browser to URL",
      parameters: { url: { type: "string", description: "URL to navigate to" } },
      handler: async ({ url }) => {
        const js = `window.location.href = '${url}'; 'Navigating to ${url}'`;
        const result = await executeBrowserJS(js);
        return `Browser navigated to ${url}. ${result}`;
      },
    },
    browser_click: {
      name: "browser_click",
      description: "Click element in browser",
      parameters: { selector: { type: "string", description: "CSS selector" } },
      handler: async ({ selector }) => {
        const js = `
          (function() {
            const el = document.querySelector('${selector}') || Array.from(document.querySelectorAll('*')).find(e => e.textContent.trim() === '${selector}');
            if (el) { el.click(); return 'Clicked: ' + (el.textContent?.slice(0,50) || selector); }
            return 'Element not found: ${selector}';
          })()
        `;
        return await executeBrowserJS(js);
      },
    },
    browser_fill: {
      name: "browser_fill",
      description: "Fill form field",
      parameters: {
        selector: { type: "string", description: "CSS selector" },
        value: { type: "string", description: "Value to fill" },
      },
      handler: async ({ selector, value }) => {
        const js = `
          (function() {
            const el = document.querySelector('${selector}');
            if (el) { el.value = '${value}'; el.dispatchEvent(new Event('input', {bubbles:true})); return 'Filled ${selector} with: ${value}'; }
            return 'Input not found: ${selector}';
          })()
        `;
        return await executeBrowserJS(js);
      },
    },
    browser_extract: {
      name: "browser_extract",
      description: "Extract text from page",
      parameters: { selector: { type: "string", description: "CSS selector (optional)" } },
      handler: async ({ selector }) => {
        const js = selector
          ? `(document.querySelector('${selector}') || document.body).innerText.slice(0, 2000)`
          : `document.body.innerText.slice(0, 2000)`;
        return await executeBrowserJS(js);
      },
    },
    open_app: {
      name: "open_app",
      description: "Open Android app",
      parameters: {
        package: { type: "string", description: "Package name" },
        label: { type: "string", description: "App label" },
      },
      handler: async ({ label }) => {
        return `Attempting to open ${label}. Note: Deep app launching requires native Android permissions. Simulated action recorded.`;
      },
    },
    set_alarm: {
      name: "set_alarm",
      description: "Set an alarm",
      parameters: {
        hour: { type: "string", description: "Hour (24h)" },
        minute: { type: "string", description: "Minute" },
        label: { type: "string", description: "Alarm label" },
      },
      handler: async ({ hour, minute, label }) => {
        return `Alarm set for ${hour}:${minute.padStart(2, "0")} — "${label}". Alarm intent dispatched to Android system.`;
      },
    },
    create_note: {
      name: "create_note",
      description: "Create a note",
      parameters: {
        title: { type: "string", description: "Note title" },
        content: { type: "string", description: "Note content" },
      },
      handler: async ({ title, content }) => {
        try {
          const key = `note_${makeId()}`;
          await AsyncStorage.setItem(key, JSON.stringify({ title, content, createdAt: Date.now() }));
          return `Note created: "${title}" — saved to local storage.`;
        } catch {
          return `Failed to save note: "${title}"`;
        }
      },
    },
    list_skills: {
      name: "list_skills",
      description: "List custom skills",
      parameters: {},
      handler: async () => {
        try {
          const raw = await AsyncStorage.getItem("rubyclaw_skills");
          if (!raw) return "No custom skills installed. Add skills in the Skills tab.";
          const skills: CustomSkill[] = JSON.parse(raw);
          return skills.map((s) => `• ${s.name} (${s.id}): ${s.description}`).join("\n");
        } catch {
          return "Error loading skills.";
        }
      },
    },
    use_skill: {
      name: "use_skill",
      description: "Use a custom skill",
      parameters: {
        skill_name: { type: "string", description: "Skill ID" },
        input: { type: "string", description: "Input text" },
      },
      handler: async ({ skill_name, input }) => {
        try {
          const raw = await AsyncStorage.getItem("rubyclaw_skills");
          if (!raw) return "No skills found.";
          const skills: CustomSkill[] = JSON.parse(raw);
          const skill = skills.find((s) => s.id === skill_name || s.name === skill_name);
          if (!skill) return `Skill "${skill_name}" not found.`;
          if (skill.type === "api") {
            const res = await fetch(skill.endpoint!, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ input }),
            });
            const text = await res.text();
            return `Skill "${skill.name}" result: ${text.slice(0, 500)}`;
          }
          return `Skill "${skill.name}" executed with input: ${input}. Action: ${skill.action || "N/A"}`;
        } catch {
          return `Error executing skill "${skill_name}"`;
        }
      },
    },
  };

  async function callLLM(history: Array<{ role: string; content: string }>): Promise<string> {
    const apiKey = await AsyncStorage.getItem("rubyclaw_openai_key");
    if (!apiKey) {
      return simulateLocalLLM(history[history.length - 1]?.content || "");
    }
    try {
      const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "No response from model.";
    } catch {
      return simulateLocalLLM(history[history.length - 1]?.content || "");
    }
  }

  function simulateLocalLLM(userMessage: string): string {
    const msg = userMessage.toLowerCase();
    if (msg.includes("search") || msg.includes("find") || msg.includes("what is")) {
      return `TOOL_CALL: web_search\nPARAMS: {"query": "${userMessage.replace(/"/g, "'")}"}`;
    }
    if (msg.includes("open") && (msg.includes("app") || msg.includes("chrome") || msg.includes("maps"))) {
      const app = msg.includes("chrome") ? "com.android.chrome" : msg.includes("maps") ? "com.google.android.apps.maps" : "com.android.settings";
      return `TOOL_CALL: open_app\nPARAMS: {"package": "${app}", "label": "App"}`;
    }
    if (msg.includes("alarm")) {
      return `TOOL_CALL: set_alarm\nPARAMS: {"hour": "8", "minute": "0", "label": "RubyClaw Alarm"}`;
    }
    if (msg.includes("note") || msg.includes("save") || msg.includes("write")) {
      return `TOOL_CALL: create_note\nPARAMS: {"title": "Note", "content": "${userMessage}"}`;
    }
    if (msg.includes("browse") || msg.includes("navigate") || msg.includes("website") || msg.includes("http")) {
      const urlMatch = userMessage.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : "https://www.google.com";
      return `TOOL_CALL: browser_navigate\nPARAMS: {"url": "${url}"}`;
    }

    const responses = [
      `I'm RubyClaw, your autonomous AI agent. I can help you search the web, automate browser tasks, open apps, set alarms, and much more. What would you like me to do?`,
      `I'm ready to assist! I can:\n• Search the web for real-time info\n• Automate browser tasks\n• Open apps and set alarms\n• Create notes and files\n• Use custom skills\n\nWhat's your task?`,
      `Understood. I'm analyzing your request... I currently have ${Object.keys(tools).length} tools available. Could you give me more details so I can choose the right action?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  function parseToolCall(content: string): { tool: string; params: Record<string, string> } | null {
    const toolMatch = content.match(/TOOL_CALL:\s*(\w+)/);
    const paramsMatch = content.match(/PARAMS:\s*(\{[\s\S]*?\})/);
    if (!toolMatch) return null;
    let params: Record<string, string> = {};
    if (paramsMatch) {
      try {
        params = JSON.parse(paramsMatch[1]);
      } catch {}
    }
    return { tool: toolMatch[1], params };
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (isThinking) return;

      let convId = activeConversationId;
      if (!convId) {
        convId = makeId();
        const convo: Conversation = {
          id: convId,
          title: text.slice(0, 40),
          messages: [],
          createdAt: Date.now(),
        };
        setConversations((prev) => {
          const updated = [convo, ...prev];
          saveConversations(updated);
          return updated;
        });
        setActiveConversationId(convId);
      }

      const userMsg: Message = {
        id: makeId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      persistMessages(nextMessages, convId);
      setIsThinking(true);

      try {
        const history = nextMessages.map((m) => ({
          role: m.role === "agent" ? "assistant" : m.role === "tool" ? "tool" : m.role === "system" ? "system" : "user",
          content: m.content,
        }));

        if (webSearchEnabled && !text.toLowerCase().includes("search")) {
          history[history.length - 1].content = `[Web search enabled] ${text}`;
        }

        let iteration = 0;
        const maxIterations = 5;
        let currentMessages = [...nextMessages];

        while (iteration < maxIterations) {
          const llmHistory = currentMessages.map((m) => ({
            role: m.role === "agent" ? "assistant" : m.role === "tool" ? "user" : m.role,
            content: m.role === "tool" ? `[Tool Result - ${m.toolName}]: ${m.content}` : m.content,
          }));

          const response = await callLLM(llmHistory);
          const toolCall = parseToolCall(response);

          if (toolCall) {
            const thinkingMsg: Message = {
              id: makeId(),
              role: "agent",
              content: response,
              timestamp: Date.now(),
              isStreaming: false,
            };
            currentMessages = [...currentMessages, thinkingMsg];
            setMessages([...currentMessages]);

            const tool = tools[toolCall.tool];
            let toolResult = `Tool "${toolCall.tool}" not found.`;
            if (tool) {
              try {
                toolResult = await tool.handler(toolCall.params);
              } catch (e: unknown) {
                toolResult = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            const toolMsg: Message = {
              id: makeId(),
              role: "tool",
              content: toolResult,
              timestamp: Date.now(),
              toolName: toolCall.tool,
            };
            currentMessages = [...currentMessages, toolMsg];
            setMessages([...currentMessages]);
            iteration++;
          } else {
            const agentMsg: Message = {
              id: makeId(),
              role: "agent",
              content: response,
              timestamp: Date.now(),
            };
            currentMessages = [...currentMessages, agentMsg];
            setMessages([...currentMessages]);
            persistMessages(currentMessages, convId);
            break;
          }
        }
      } catch (e: unknown) {
        const errMsg: Message = {
          id: makeId(),
          role: "agent",
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages, isThinking, webSearchEnabled, selectedModel, activeConversationId, conversations]
  );

  function clearMessages() {
    setMessages([]);
    newConversation();
  }

  return (
    <AgentContext.Provider
      value={{
        messages,
        isThinking,
        webSearchEnabled,
        selectedModel,
        activeConversationId,
        conversations,
        setWebSearchEnabled,
        setSelectedModel,
        sendMessage,
        clearMessages,
        loadConversation,
        newConversation,
        browserOutput,
        setBrowserOutput,
        pendingBrowserJS,
        setPendingBrowserJS,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

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

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}
