import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// AI provider is OPTIONAL — app works with local LLMs by default
// Only create client if credentials are provided
let openaiClient: OpenAI | null = null;

if (baseURL && apiKey) {
  openaiClient = new OpenAI({
    apiKey,
    baseURL,
  });
} else {
  // Log warning but don't crash — local LLM mode is the default
  console.info(
    "[RubyClaw] AI provider not configured. Server will handle local LLM routing only. " +
    "Set AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL to enable cloud AI."
  );
}

// Export a proxy that throws helpful errors when AI is used without config
export const openai: OpenAI = openaiClient || new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (prop === "chat") {
      return {
        completions: {
          create: async () => {
            throw new Error(
              "AI provider not configured. Please set AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL environment variables, or use local LLM mode in the app."
            );
          },
        },
      };
    }
    return undefined;
  },
});

export function isAIConfigured(): boolean {
  return openaiClient !== null;
}
