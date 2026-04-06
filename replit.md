# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### API Server
- **Path**: `artifacts/api-server/`
- **Routes**:
  - `GET /api/health` — health check
  - `POST /api/chat` — SSE streaming chat with OpenAI tool calling (web_search, fetch_url, create_note, set_alarm, open_app)
  - `POST /api/search` — standalone DuckDuckGo + Jina web search
- **AI**: Replit AI integration via `@workspace/integrations-openai-ai-server`, model `gpt-5.2`
- **Agent Loop**: Server-side ReAct loop (max 6 iterations), uses OpenAI native function calling (not regex parsing) to eliminate infinite loops
- **Web Search**: DuckDuckGo Instant Answers API + Jina Reader (https://r.jina.ai) for URL fetching

### RubyClaw (Mobile - Expo)
- **Path**: `artifacts/rubyclaw/`
- **Description**: Autonomous Agentic AI mobile app for Android with Claude-style UI
- **Architecture**:
  - AgentContext streams from backend `/api/chat` SSE endpoint (no client-side agent loop)
  - Messages: user, assistant (with streaming cursor), tool_call, tool_result
  - Conversation history persisted via AsyncStorage
  - Local llama.cpp server support (OpenAI-compatible `/v1/chat/completions`)
- **Screens**:
  - **Chat** (`app/(tabs)/index.tsx`): Claude-style UI with markdown rendering (headers, bold, code blocks, bullets), file attachment (image picker), Web search toggle toolbar, streaming response display, suggestion cards on empty state
  - **Models** (`app/(tabs)/models.tsx`): Real GGUF model downloads via `expo-file-system` (`createDownloadResumable`), pause/resume/delete, 5 models: Gemma 4 2B, Qwen 3.5 1.5B, DeepSeek R1 1.5B/7B, Phi 3.5 Mini
  - **Skills** (`app/(tabs)/skills.tsx`): Custom skill registry (API, action, prompt types) with AsyncStorage persistence
  - **Settings** (`app/(tabs)/settings.tsx`): Local llama.cpp server URL, web search toggle, Android permissions, background service toggle, quick app launcher
- **Colors**: Dark theme (#0a0c10 bg, #e53935 red primary, #00e5ff cyan accent)
- **Agent Tools (server-side)**: web_search (DuckDuckGo), fetch_url (Jina Reader), create_note, set_alarm, open_app
- **Local Model Support**: Configure llama.cpp server URL in Settings; chat auto-routes to local server when set
- **Model Downloads**: Real file downloads to `FileSystem.documentDirectory + 'rubyclaw_models/'`, tracked with progress callbacks
