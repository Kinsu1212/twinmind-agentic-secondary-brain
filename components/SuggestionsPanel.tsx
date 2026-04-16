"use client";

import { useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore, Suggestion } from "@/lib/store";
import { generateSuggestions } from "@/lib/groq";
import { Lightbulb, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface Props {
  onSuggestionClick: (suggestion: Suggestion) => void;
  isRecording: boolean;
  flushChunk: () => boolean;
}

const TYPE_COLORS: Record<string, string> = {
  "Action Item": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Clarification: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Fact-Check": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Insight: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Follow-up": "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const TYPE_ICONS: Record<string, string> = {
  "Action Item": "✅",
  Clarification: "❓",
  "Fact-Check": "🔍",
  Insight: "💡",
  "Follow-up": "↩️",
};

export function SuggestionsPanel({ onSuggestionClick, isRecording, flushChunk }: Props) {
  const {
    suggestionBatches,
    isGeneratingSuggestions,
    isProcessingChunk,
    transcriptChunks,
    groqApiKey,
    suggestionPrompt,
    contextWindowSize,
    addSuggestionBatch,
    setIsGeneratingSuggestions,
  } = useAppStore();

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleRefresh = useCallback(async () => {
    if (isGeneratingSuggestions || isProcessingChunk) return;

    // If actively recording, flush the current audio chunk early.
    // This triggers transcription → then suggestions automatically via the hook.
    if (isRecording) {
      flushChunk();
      return;
    }

    // Not recording — re-generate suggestions from existing transcript directly.
    if (!groqApiKey || transcriptChunks.length === 0) return;
    setIsGeneratingSuggestions(true);
    try {
      const batch = await generateSuggestions(
        transcriptChunks,
        contextWindowSize,
        suggestionPrompt,
        groqApiKey
      );
      addSuggestionBatch(batch);
    } catch (err) {
      console.error("Refresh suggestions error:", err);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [
    isRecording,
    isGeneratingSuggestions,
    isProcessingChunk,
    flushChunk,
    groqApiKey,
    transcriptChunks,
    contextWindowSize,
    suggestionPrompt,
    addSuggestionBatch,
    setIsGeneratingSuggestions,
  ]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Live Suggestions
        </h2>
        <div className="flex items-center gap-2">
          {isGeneratingSuggestions && (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={
              isGeneratingSuggestions ||
              isProcessingChunk ||
              (!isRecording && (!groqApiKey || transcriptChunks.length === 0))
            }
            title={
              isRecording
                ? "Flush audio now — transcribe immediately and generate fresh suggestions"
                : "Re-generate suggestions from current transcript"
            }
            className="h-7 px-2 gap-1.5 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isGeneratingSuggestions || isProcessingChunk ? "animate-spin" : ""}`} />
            Reload Suggestions
          </Button>
        </div>
      </div>

      {/* Scrollable area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          <div className="space-y-4 pb-2">
            {suggestionBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Sparkles className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">
                  Suggestions appear after each transcript chunk
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Or hit <span className="text-indigo-400">Reload Suggestions</span> to generate manually
                </p>
              </div>
            ) : (
              suggestionBatches.map((batch, batchIdx) => (
                <div key={batch.id} className={batchIdx > 0 ? "opacity-50" : ""}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-gray-700/50" />
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTime(batch.timestamp)}
                      {batchIdx === 0 && (
                        <span className="ml-1 text-indigo-400/70">· latest</span>
                      )}
                    </span>
                    <div className="h-px flex-1 bg-gray-700/50" />
                  </div>

                  <div className="space-y-2">
                    {batch.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="w-full text-left rounded-lg border border-gray-700/50 bg-gray-800/40 p-3 hover:bg-gray-700/50 hover:border-indigo-500/50 transition-all duration-150 group"
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className="text-sm leading-none mt-0.5">
                            {TYPE_ICONS[suggestion.type] || "💬"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 border ${
                                  TYPE_COLORS[suggestion.type] || "text-gray-400 border-gray-600"
                                }`}
                              >
                                {suggestion.type}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-gray-200 group-hover:text-white leading-snug">
                              {suggestion.title}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed pl-6 group-hover:text-gray-300">
                          {suggestion.body}
                        </p>
                        <p className="text-xs text-indigo-400/60 mt-1.5 pl-6 group-hover:text-indigo-400 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          Click to explore in chat
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
