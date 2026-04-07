import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT = `You are RubyClaw, a powerful autonomous AI agent. You are helpful, precise, and honest.

You have access to tools. Use them when needed to answer accurately. Always think step by step.

Today's date: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
You can respond in any language the user uses (Hindi, English, Hinglish, etc.)`;

const TOOLS: Parameters<typeof openai.chat.completions.create>[0]["tools"] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information, news, or facts. Use this when the user asks for current information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch and read the content of a specific URL. Use this to get information from a website.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a note or reminder for the user with a title and content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the note" },
          content: { type: "string", description: "Content of the note" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_alarm",
      description: "Set an alarm for the user at a specific time.",
      parameters: {
        type: "object",
        properties: {
          hour: { type: "string", description: "Hour in 24h format (0-23)" },
          minute: { type: "string", description: "Minute (0-59)" },
          label: { type: "string", description: "Alarm label" },
        },
        required: ["hour", "minute", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_app",
      description: "Open an Android application.",
      parameters: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the app to open (e.g., Chrome, Maps, Gmail)" },
          package: { type: "string", description: "Android package name (e.g., com.android.chrome)" },
        },
        required: ["app_name"],
      },
    },
  },
];

async function executeToolCall(name: string, args: Record<string, string>): Promise<string> {
  try {
    if (name === "web_search") {
      const query = args.query || "";
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
      const data = await res.json() as {
        AbstractText?: string;
        AbstractSource?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        Answer?: string;
        Definition?: string;
      };
      const parts: string[] = [];
      if (data.Answer) parts.push(`Answer: ${data.Answer}`);
      if (data.AbstractText) parts.push(`${data.AbstractText}\nSource: ${data.AbstractSource} (${data.AbstractURL})`);
      if (data.Definition) parts.push(`Definition: ${data.Definition}`);
      if (data.RelatedTopics?.length) {
        const topics = data.RelatedTopics
          .filter((t: { Text?: string; FirstURL?: string }) => t.Text)
          .slice(0, 5)
          .map((t: { Text?: string; FirstURL?: string }) => `• ${t.Text}`)
          .join("\n");
        if (topics) parts.push(`Related:\n${topics}`);
      }
      if (parts.length === 0) {
        return `Search completed for "${query}". For more detailed results, try fetching a specific URL.`;
      }
      return parts.join("\n\n");
    }

    if (name === "fetch_url") {
      const url = args.url || "";
      const jinaUrl = `https://r.jina.ai/${url}`;
      const res = await fetch(jinaUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { "Accept": "text/plain" },
      });
      const text = await res.text();
      return text.slice(0, 3000);
    }

    if (name === "create_note") {
      return `Note "${args.title}" created successfully with content: ${args.content}`;
    }

    if (name === "set_alarm") {
      const h = String(args.hour || "0").padStart(2, "0");
      const m = String(args.minute || "0").padStart(2, "0");
      return `Alarm set for ${h}:${m} — "${args.label}". The alarm intent has been dispatched to the Android system.`;
    }

    if (name === "open_app") {
      return `Opening ${args.app_name}... The app launch intent has been sent to Android.`;
    }

    return `Tool "${name}" executed.`;
  } catch (e) {
    logger.error({ err: e, tool: name }, "Tool execution failed");
    return `Tool "${name}" error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

router.post("/chat", async (req, res) => {
  const { messages, webSearch, skills, systemPrompt } = req.body as {
    messages: Array<{ role: string; content: string }>;
    webSearch?: boolean;
    skills?: string[];
    systemPrompt?: string;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const sysContent = [
      systemPrompt || SYSTEM_PROMPT,
      skills?.length ? `\nUser has these custom skills available: ${skills.join(", ")}` : "",
      webSearch ? "\nWeb search is enabled — use the web_search tool for current information." : "",
    ].join("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatMessages: any[] = [
      { role: "system", content: sysContent },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const tools = webSearch ? TOOLS : TOOLS.filter((t) => (t as { function: { name: string } }).function.name !== "web_search");

    let iterCount = 0;
    const MAX_ITER = 6;

    while (iterCount < MAX_ITER) {
      iterCount++;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: chatMessages,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 8192,
        stream: false,
      });

      const msg = response.choices[0]?.message;
      if (!msg) break;

      chatMessages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls,
      });

      if (!msg.tool_calls?.length) {
        // Final text response — stream it
        const finalContent = msg.content || "";
        const chunkSize = 8;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          sendEvent({ content: finalContent.slice(i, i + chunkSize) });
          await new Promise((r) => setTimeout(r, 5));
        }
        break;
      }

      // Execute tool calls
      for (const rawTc of msg.tool_calls) {
        const tc = rawTc as { id: string; function: { name: string; arguments: string } };
        let toolArgs: Record<string, string> = {};
        try {
          toolArgs = JSON.parse(tc.function.arguments);
        } catch {}

        sendEvent({ toolCall: { name: tc.function.name, args: toolArgs } });

        const result = await executeToolCall(tc.function.name, toolArgs);

        sendEvent({ toolResult: { name: tc.function.name, result: result.slice(0, 500) } });

        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result,
        });
      }
    }

    sendEvent({ done: true });
    res.end();
  } catch (e) {
    logger.error({ err: e }, "Chat route error");
    sendEvent({ error: e instanceof Error ? e.message : "Unknown error" });
    res.end();
  }
});

router.post("/search", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query) {
    res.status(400).json({ error: "query required" });
    return;
  }
  try {
    const result = await executeToolCall("web_search", { query });
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
