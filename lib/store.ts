import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: string;
  transcriptionMs?: number;
}

export interface Suggestion {
  type: "Direct Answer" | "Question to Ask" | "Talking Point" | "Clarification" | "Fact-Check";
  title: string;
  body: string;
  expanded_prompt: string;
}

export interface SuggestionBatch {
  id: string;
  timestamp: string;
  suggestions: Suggestion[];
  suggestionMs?: number;
  triggeredByChunkId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isClick?: boolean;
}

interface SettingsState {
  groqApiKey: string;
  suggestionPrompt: string;
  clickPrompt: string;
  chatPrompt: string;
  contextWindowSize: number;
  expandedContextWindowSize: number;
}

interface AppState extends SettingsState {
  // Audio
  isRecording: boolean;
  isPaused: boolean;
  isProcessingChunk: boolean;

  // Transcript
  transcriptChunks: TranscriptChunk[];

  // Suggestions
  suggestionBatches: SuggestionBatch[];
  isGeneratingSuggestions: boolean;

  // Chat
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

  // Cross-panel scroll target
  targetChunkId: string | null;

  // Settings actions
  setGroqApiKey: (key: string) => void;
  setSuggestionPrompt: (prompt: string) => void;
  setClickPrompt: (prompt: string) => void;
  setChatPrompt: (prompt: string) => void;
  setContextWindowSize: (size: number) => void;
  setExpandedContextWindowSize: (size: number) => void;

  // Audio actions
  setIsRecording: (val: boolean) => void;
  setIsPaused: (val: boolean) => void;
  setIsProcessingChunk: (val: boolean) => void;

  // Transcript actions
  addTranscriptChunk: (chunk: TranscriptChunk) => void;
  clearTranscript: () => void;

  // Suggestion actions
  addSuggestionBatch: (batch: SuggestionBatch) => void;
  setIsGeneratingSuggestions: (val: boolean) => void;
  clearSuggestions: () => void;

  // Chat actions
  addChatMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  setIsChatLoading: (val: boolean) => void;
  clearChat: () => void;

  // Scroll actions
  setTargetChunkId: (id: string | null) => void;
}

// ── Optimal default prompts ───────────────────────────────────────────────────

export const DEFAULT_SUGGESTION_PROMPT = `You are a real-time AI conversation copilot. Your job is to surface the 3 most useful things the USER (the person wearing the mic) should do or say RIGHT NOW.

## Step 1 — Read the conversational moment
Before choosing suggestion types, identify what just happened in the last few lines:
- Was a QUESTION just asked TO the user? → prioritize a "Direct Answer" suggestion
- Was a claim, stat, or fact stated? → prioritize a "Fact-Check"
- Is something ambiguous or undefined? → prioritize a "Clarification"
- Is there a natural pause or topic shift? → prioritize a "Question to Ask"
- Is there an important point being glossed over? → prioritize a "Talking Point"

## Step 2 — Generate 3 suggestions using the right types for this moment

Available types — pick whichever 3 fit the current moment best (never repeat a type):
- "Direct Answer"  — the interviewer/other person just asked a question; write the actual answer content as bullet points the user can say out loud, in first person ("I would...", "My approach is...") — NOT instructions about what to do
- "Question to Ask" — a sharp, relevant question the user should ask right now
- "Talking Point"  — an important point worth raising or expanding on
- "Clarification"  — something that was said ambiguously that the user should clarify or ask about
- "Fact-Check"     — a claim or number that was stated and should be verified

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "type": "<one of the five types above>",
      "title": "<6–8 words, specific to what was actually said>",
      "body": "<2–3 sentences: what to say/do and WHY it matters right now in this conversation>",
      "expanded_prompt": "<A detailed, self-contained question that will produce the most useful answer when sent to an AI with full transcript context>"
    }
  ]
}

Rules:
- If a question was just asked TO the user, at least one suggestion MUST be a "Direct Answer" — this is the highest-priority case
- Every suggestion must reference something actually said — never generic advice
- For "Direct Answer": write the actual answer in first person as talking points ("I'd use...", "My approach would be..."). If the question is open-ended ("what options exist?", "what can you use?", "how would you approach?"), list ALL relevant options with a one-line reason for each — be comprehensive, not brief. If the question is specific, give a direct focused answer. NEVER say "you should" or reference the user by name — just be the voice in their head.
- expanded_prompt should be rich enough to get a comprehensive standalone answer
- Ask yourself: what would make the user's next 60 seconds more effective?`;

export const DEFAULT_CLICK_PROMPT = `You are an expert AI meeting analyst. A participant has clicked a live suggestion and wants a comprehensive, well-structured answer.

Your response must:
1. Directly address the specific question or topic raised
2. Ground your answer in the meeting transcript — reference what was actually said
3. Be structured: use headers, bullet points, or numbered steps where it adds clarity
4. Include concrete, actionable next steps or talking points where relevant
5. Anticipate follow-up questions and address them proactively
6. Be thorough but scannable — the participant may need to act on this immediately

The full meeting transcript is provided as context. Make every answer specific to THIS conversation, not generic advice.`;

export const DEFAULT_CHAT_PROMPT = `You are a helpful AI meeting assistant with full context of the ongoing conversation via the transcript provided.

Answer questions clearly, concisely, and practically. The user is in an active meeting — be direct and useful. Use markdown formatting when it helps readability. Reference specific things from the transcript when relevant. Keep responses focused.`;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Settings (persisted to LocalStorage)
      groqApiKey: "",
      suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
      clickPrompt: DEFAULT_CLICK_PROMPT,
      chatPrompt: DEFAULT_CHAT_PROMPT,
      contextWindowSize: 800,
      expandedContextWindowSize: 3000,

      // Runtime state (cleared on reload — no persistence by design)
      isRecording: false,
      isPaused: false,
      isProcessingChunk: false,
      transcriptChunks: [],
      suggestionBatches: [],
      isGeneratingSuggestions: false,
      chatMessages: [],
      isChatLoading: false,
      targetChunkId: null,

      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setSuggestionPrompt: (prompt) => set({ suggestionPrompt: prompt }),
      setClickPrompt: (prompt) => set({ clickPrompt: prompt }),
      setChatPrompt: (prompt) => set({ chatPrompt: prompt }),
      setContextWindowSize: (size) => set({ contextWindowSize: size }),
      setExpandedContextWindowSize: (size) => set({ expandedContextWindowSize: size }),

      setIsRecording: (val) => set({ isRecording: val }),
      setIsPaused: (val) => set({ isPaused: val }),
      setIsProcessingChunk: (val) => set({ isProcessingChunk: val }),

      addTranscriptChunk: (chunk) =>
        set((state) => ({ transcriptChunks: [...state.transcriptChunks, chunk] })),
      clearTranscript: () => set({ transcriptChunks: [] }),

      addSuggestionBatch: (batch) =>
        set((state) => ({ suggestionBatches: [batch, ...state.suggestionBatches] })),
      setIsGeneratingSuggestions: (val) => set({ isGeneratingSuggestions: val }),
      clearSuggestions: () => set({ suggestionBatches: [] }),

      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      updateLastAssistantMessage: (content) =>
        set((state) => {
          const msgs = [...state.chatMessages];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
            msgs[lastIdx] = { ...msgs[lastIdx], content };
          }
          return { chatMessages: msgs };
        }),
      setIsChatLoading: (val) => set({ isChatLoading: val }),
      clearChat: () => set({ chatMessages: [] }),

      setTargetChunkId: (id) => set({ targetChunkId: id }),
    }),
    {
      name: "twinmind-settings",
      partialize: (state) => ({
        groqApiKey: state.groqApiKey,
        suggestionPrompt: state.suggestionPrompt,
        clickPrompt: state.clickPrompt,
        chatPrompt: state.chatPrompt,
        contextWindowSize: state.contextWindowSize,
        expandedContextWindowSize: state.expandedContextWindowSize,
      }),
    }
  )
);
