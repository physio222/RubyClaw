# 🔴 RubyClaw — Autonomous Agentic AI for Android

<p align="center">
  <strong>A powerful Agentic AI mobile app with Claude-style UI, real-time streaming, local LLM support, and autonomous tool execution.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white" />
  <img src="https://img.shields.io/badge/Framework-Expo%20React%20Native-000020?logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-GPT--5.2%20%2B%20Local%20LLMs-8A2BE2" />
  <img src="https://img.shields.io/badge/Version-2.0.0-e53935" />
  <img src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## ✨ Features

### 🤖 Agentic AI Chat
- **Claude-style UI** with streaming responses and markdown rendering
- **Server-side ReAct agent loop** (max 6 iterations) with OpenAI native function calling
- **Real-time SSE streaming** for instant response display
- **Conversation history** persisted via AsyncStorage

### 🛠️ Agent Tools (Server-Side)
| Tool | Description |
|------|-------------|
| `web_search` | DuckDuckGo + Jina Reader web search |
| `fetch_url` | Fetch and parse any URL content |
| `create_note` | Create notes autonomously |
| `set_alarm` | Set device alarms |
| `open_app` | Launch installed apps |

### 📱 Screens
- **Chat** — Full-featured chat with markdown (headers, bold, code blocks, bullets), file attachments, web search toggle, suggestion cards
- **Models** — Download and manage GGUF models: Gemma 4 2B, Qwen 3.5 1.5B, DeepSeek R1 1.5B/7B, Phi 3.5 Mini
- **Skills** — Custom skill registry (API, action, prompt types) with persistence
- **Settings** — Local llama.cpp server URL, web search toggle, Android permissions, background service, quick app launcher

### 🧠 Local LLM Support
- Run AI **completely offline** with local llama.cpp server
- Download real GGUF model files directly to device
- Pause/resume/delete model downloads with progress tracking
- OpenAI-compatible `/v1/chat/completions` endpoint support

---

## 🏗️ Architecture

```
RubyClaw/
├── artifacts/
│   ├── rubyclaw/          # 📱 Expo React Native Mobile App
│   │   ├── app/           # Tab-based screens (Chat, Models, Skills, Settings)
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # AgentContext (SSE streaming, state management)
│   │   ├── constants/     # Theme colors, config
│   │   └── server/        # Local server utilities
│   └── api-server/        # 🖥️ Express 5 Backend API
│       └── src/           # Routes, AI integration, tool handlers
├── lib/                   # 📦 Shared Libraries
│   ├── api-client-react/  # React API client hooks (Orval codegen)
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Zod validation schemas
│   ├── db/                # PostgreSQL + Drizzle ORM
│   └── integrations*/     # OpenAI AI SDK integrations
└── package.json           # pnpm workspace root
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 24+
- **pnpm** package manager
- **Android device** or emulator (for mobile app)

### Installation

```bash
# Clone the repo
git clone https://github.com/physio222/RubyClaw.git
cd RubyClaw

# Install dependencies
pnpm install

# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the mobile app
cd artifacts/rubyclaw
npx expo start
```

### Local LLM Setup (Optional)
1. Download a GGUF model from the **Models** tab in the app
2. Or set up a local [llama.cpp](https://github.com/ggerganov/llama.cpp) server
3. Configure the server URL in **Settings**
4. Chat will auto-route to your local model

---

## 🎨 Design

- **Dark Theme**: `#0a0c10` background
- **Primary**: `#e53935` (Ruby Red)
- **Accent**: `#00e5ff` (Cyan)
- Built with premium glassmorphism and smooth animations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo React Native (TypeScript) |
| Backend | Express 5 (Node.js) |
| AI | GPT-5.2 + Local LLMs (llama.cpp) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 |
| API Codegen | Orval (OpenAPI) |
| Build | esbuild (CJS bundle) |
| Monorepo | pnpm workspaces |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/physio222">physio222</a>
</p>
