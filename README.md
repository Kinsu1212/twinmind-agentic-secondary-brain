# TwinMind Copilot — Live AI Meeting Assistant

A real-time meeting copilot that transcribes audio, generates context-aware suggestions, and lets you chat with your meeting via an AI assistant — all running entirely in the browser with your own Groq API key.

---

## Deployment (Vercel)

**Live demo:** https://twinmind-agentic-secondary-brain.vercel.app

---

## Local Setup

1. Get a free Groq API key at `console.groq.com`
2. `npm install && npm run dev`
3. Open `http://localhost:3000`
4. Click the Settings gear (pulsing yellow until configured) → paste your API key → Save
5. Click **Start Recording** in the left column — first suggestions appear after the first 30s chunk

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Zero-config Vercel deployment, SSR-free client components |
| State | Zustand + `persist` middleware | Lightweight, no prop-drilling; settings survive reload, session data doesn't |
| Styling | Tailwind CSS v4 + shadcn/ui | Dark-mode first, accessible primitives, fast to build with |
| Transcription | Groq `whisper-large-v3` | Best open-source ASR accuracy, ~100× real-time speed via Groq |
| Suggestions & Chat | Groq `llama-3.3-70b-versatile` | Fastest available 70B inference; reliable JSON mode for structured suggestions |
| Audio | Native `MediaRecorder` API | No dependencies, works in all modern browsers |

---

## Architecture

The app is entirely client-side. No backend, no database. The user's Groq API key is stored in `localStorage` and sent directly from the browser to `api.groq.com`. Session data (transcript, suggestions, chat) lives in Zustand runtime state and is intentionally cleared on page reload — one session, no persistence.

**Audio pipeline:**
`MediaRecorder` → 30s chunks → `Blob` → Groq Whisper → transcript text → Zustand → suggestions trigger

**Context window (sliding):**
Rather than sending the full transcript on every request, we slice the last N words. This keeps latency low and avoids hitting token limits. Two separate window sizes are configurable: smaller for suggestions (800 words, focused on recent context), larger for click-expanded answers (3000 words, full depth for comprehensive responses).

---

## Prompt Strategy

Three separate prompts serve distinct purposes. Each is tunable in Settings with a reset-to-default button.

### 1. Live Suggestion Prompt (`suggestionPrompt`)

**Goal:** Generate 3 varied, timely, grounded suggestions from recent transcript.

**Key decisions:**
- Uses `response_format: { type: "json_object" }` to guarantee parseable output — no fragile regex extraction.
- The model picks suggestion types dynamically from a menu of 5 (Action Item, Talking Point, Clarification, Fact-Check, Follow-up) rather than hardcoding one type per slot. This produces more natural, context-appropriate variety.
- The prompt explicitly forbids generic advice and requires every suggestion to be anchored to something actually said. Without this constraint, models default to surface-level platitudes.
- `expanded_prompt` in the JSON is the key bridge to the chat panel. It is prompted to be "rich and specific enough to get a comprehensive standalone answer" — this is what fires when the user clicks a card.
- `temperature: 0.7` — high enough for variety across refreshes, low enough for reliable JSON structure.
- **Context window: 800 words** — recent enough to be timely, small enough to keep suggestion latency under 2 seconds.

### 2. Detailed Answers On-Click Prompt (`clickPrompt`)

**Goal:** When a suggestion card is clicked, return a thorough, structured, actionable answer.

**Key decisions:**
- Entirely separate from the chat prompt. The mode is different: the user has explicitly asked for depth. The prompt instructs the model to use headers/bullets, reference specific transcript content, and anticipate follow-up questions.
- **Context window: 3000 words** — more of the session history is included so the answer is grounded in full context, not just the last chunk.
- Suggestion cards in the UI show a `✦ From suggestion` badge on click-triggered messages, so the user can distinguish detailed answers from quick chat replies.
- `max_tokens: 2048` — enough room for a structured, multi-section response.

### 3. Chat Prompt (`chatPrompt`)

**Goal:** Handle direct questions typed in the chat input — conversational, fast, focused.

**Key decisions:**
- Shorter and more directive than the click prompt. The user typed a quick question; they don't necessarily want a 500-word essay.
- Same sliding context window as suggestions (800 words) — keeps responses snappy.
- Full conversation history is included on every request so the model remembers what was already discussed in the session.

### Tradeoffs

| Decision | Alternative considered | Why we chose this |
|---|---|---|
| Two context window sizes | One universal size | Click answers benefit from 4× more context; using the large window for live suggestions would add ~1-2s latency per chunk |
| Dynamic suggestion types | Fixed 3 types per batch | Fixed types produce formulaic outputs; dynamic types let the model surface what actually matters |
| Streaming chat responses | Wait for full response | Streaming shows first token in ~300ms; waiting adds ~2-4s perceived latency |
| No backend / client-side API calls | Server-side proxy | Eliminates a server, but means the user's key is in `localStorage`. Acceptable because the key is theirs, and this is a single-user tool |
| Session state clears on reload | Persist session to localStorage | The spec says "no login, no data persistence" — clearing is the right behavior |

---

## Settings

All 5 settings are editable in the Settings modal (⚙ top-right):

| Setting | Default | Purpose |
|---|---|---|
| Groq API Key | — | User-provided, stored in localStorage |
| Context window — live suggestions | 800 words | Transcript words sent per suggestion request |
| Context window — expanded answers | 3000 words | Transcript words sent when a suggestion card is clicked |
| Live suggestion prompt | See store.ts | System prompt for the 3-card suggestion batch |
| Detailed answers on-click prompt | See store.ts | System prompt for suggestion card click responses |
| Chat prompt | See store.ts | System prompt for direct chat input |

Each prompt field has a ↺ reset button to restore the hardcoded optimal default.
