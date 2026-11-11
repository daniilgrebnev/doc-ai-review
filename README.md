# AgentFlow

Multi-agent document approval system powered by Claude (Anthropic), YandexGPT or DeepSeek. Upload a contract or specification — four AI experts (Lawyer, Finance, Security, PM) review it sequentially and produce a structured verdict.

## Demo

Deploy to Vercel **without API keys** — the app runs in demo mode with pre-generated responses.

With `ANTHROPIC_API_KEY` and/or `YC_API_KEY` + `YC_FOLDER_ID` configured, the user picks the model in the UI. Claude is locked for users located in Russia (by `x-vercel-ip-country` / `cf-ipcountry`); they get YandexGPT only.

## Features

- Sequential 4-agent pipeline with individual prompts and context passing
- Structured output: approved / rejected / revision + comments and issues
- Document upload (.txt, .docx) or paste text
- Auto-generated corrected contract with before/after diff view
- Review history (localStorage)
- Export report as Markdown or PDF
- Demo fallback when `ANTHROPIC_API_KEY` is missing

## Quick start

```bash
git clone <repo-url>
cd doc-ai-flow
npm install
cp .env.example .env.local   # optional — works without keys in demo mode
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **«Загрузить пример»**.

### Production (Claude)

1. Create an API key in the [Claude Console](https://platform.claude.com/settings/keys)
2. Add to `.env.local`:

```env
ANTHROPIC_API_KEY=your_api_key
# optional
ANTHROPIC_MODEL=claude-haiku-5-5  # or claude-sonnet-5-5 / claude-opus-5-5
ANTHROPIC_EFFORT=medium           # low | medium | high | xhigh | max
```

YandexGPT:

```env
YC_API_KEY=your_api_key
YC_FOLDER_ID=your_folder_id
YANDEX_CLOUD_MODEL=yandexgpt-5.1/latest
```

DeepSeek: `DEEPSEEK_API_KEY`, optionally `DEEPSEEK_MODEL` (`deepseek-chat` by default).

Geo lock: `CLAUDE_BLOCKED_COUNTRIES` (default `RU`). If the country is unknown in production, Claude is blocked too. Locally set `GEO_COUNTRY_OVERRIDE=RU` to test the lock.

Site geo block: `SITE_BLOCKED_COUNTRIES` (default `UA`, empty string turns it off). Requests from these countries get a 404 page on every route, including the API.

Claude requests use the official `@anthropic-ai/sdk` with streaming, adaptive thinking (depth set by `effort`) and, for Sonnet/Opus, server-side refusal fallback (`fallbacks: "default"`; Haiku has none).

## Tech stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | Framework |
| TypeScript (strict) | Types |
| Tailwind CSS | UI |
| Zustand | State + persist |
| Claude API (`@anthropic-ai/sdk`) | LLM |
| Vitest | Unit tests |

## Architecture

```mermaid
flowchart LR
  User[User] --> UI[ReviewView]
  UI --> Store[Zustand]
  Store --> Runner[Pipeline Runner]
  Runner --> Analyze["/api/analyze"]
  Analyze --> Demo{Demo mode?}
  Demo -->|yes| Mock[Sample responses]
  Demo -->|no| Claude[Claude API]
  Analyze --> Store
  Store --> Revise["/api/revise"]
  Revise --> Diff[Diff view]
```

### Design decisions

1. **Sequential pipeline** — each agent sees previous experts' comments for coherent review
2. **JSON parser + retry** — structured LLM output with automatic retry on parse failure
3. **Patch-fallback for revise** — if full rewrite fails, model returns find/replace JSON patches applied locally

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analyze` | POST | Single agent analysis |
| `/api/revise` | POST | Generate corrected document |
| `/api/read-document` | POST | Parse uploaded .txt/.docx |
| `/api/providers` | GET | Available models for this user (keys + geo lock) |
| `/api/demo-status` | GET | `{ demo: boolean }` |

## Project structure

```
app/
  api/                    # analyze, revise, read-document, demo-status
  page.tsx
components/
  review/                 # ReviewView (main screen)
  document/               # CorrectedDocumentModal, DocumentDiffView
  demo/                   # DemoBanner
  pipeline/               # AgentPipeline, PipelineSummary
lib/
  agents/                 # prompts, parser, patch revision
  demo/                   # sample contract, isDemoMode
  diff/                   # line diff
  claude/                 # Claude API client
  yandex-gpt/             # YandexGPT API client
  deepseek/               # DeepSeek API client (OpenAI-compatible)
  llm/                    # provider selection, geo lock, unified complete()
store/                    # Zustand stores
```

## Scripts

```bash
npm run dev        # development
npm run build      # production build
npm run test       # vitest
npm run ts:check   # typecheck
```

## Deploy on Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. **Demo only:** deploy without env vars
4. **Production:** add `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL` and `ANTHROPIC_EFFORT`

## License

MIT
