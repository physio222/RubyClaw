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

### RubyClaw (Mobile - Expo)
- **Path**: `artifacts/rubyclaw/`
- **Description**: Autonomous Agentic AI mobile app for Android
- **Features**:
  - Chat screen with ReAct agent loop (up to 5 tool calls per query)
  - Model Manager with GGUF model listings (Gemma 4, Qwen, DeepSeek, Phi)
  - Custom Skill Registry (API, action, prompt skill types)
  - Settings with permission toggles, API key management, foreground service toggle
  - Hidden WebView browser automation layer
  - Web search via DuckDuckGo API
  - AsyncStorage-based conversation history persistence
- **Colors**: Dark theme (#0a0c10 bg, #e53935 red primary, #00e5ff cyan accent)
- **AI**: Connects to OpenAI API (with built-in local simulation fallback)
- **Agent Tools**: web_search, browser_navigate, browser_click, browser_fill, browser_extract, open_app, set_alarm, create_note, list_skills, use_skill
