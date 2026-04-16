import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: string;
}

export interface Suggestion {
  type: "Action Item" | "Clarification" | "Fact-Check" | "Talking Point" | "Follow-up";
  title: string;
  body: string;
  expanded_prompt: string;
}

export interface SuggestionBatch {
  id: string;
  timestamp: string;
  suggestions: Suggestion[];
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
}

// ── Optimal default prompts ───────────────────────────────────────────────────

export const DEFAULT_SUGGESTION_PROMPT = `You are a real-time AI meeting copilot. Surface the 3 most valuable things a participant should act on or be aware of RIGHT NOW based on the conversation.

Analyze the transcript and output exactly 3 suggestions. Each must be SPECIFIC to what was actually discussed — never generic advice.

Choose each suggestion type based on what serves the conversation best:
- "Action Item"   — something concrete that needs to happen
- "Talking Point" — something worth raising or exploring further
- "Clarification" — something ambiguous that needs to be defined
- "Fact-Check"    — a claim, number, or statement that should be verified
- "Follow-up"     — something that was skipped or deserves more depth

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "type": "<one of the five types above>",
      "title": "<6–8 words, specific to the conversation>",
      "body": "<1–2 sentences: what it is and why it matters right now>",
      "expanded_prompt": "<A detailed, self-contained question that will produce the most useful answer when sent to an AI with full transcript context>"
    }
  ]
}

Rules:
- Vary the types — do not repeat the same type twice
- Every suggestion must be anchored to something actually said in the transcript
- expanded_prompt should be rich and specific enough to get a comprehensive standalone answer
- Ask yourself: what would make this conversation more productive in the next 5 minutes?`;

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
