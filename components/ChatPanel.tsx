"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore, Suggestion } from "@/lib/store";
import { streamChatResponse, buildChatContext } from "@/lib/groq";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  pendingSuggestion: Suggestion | null;
  onSuggestionHandled: () => void;
}

export function ChatPanel({ pendingSuggestion, onSuggestionHandled }: Props) {
  const {
    chatMessages,
    isChatLoading,
    groqApiKey,
    chatPrompt,
    clickPrompt,
    contextWindowSize,
    expandedContextWindowSize,
    transcriptChunks,
    addChatMessage,
    updateLastAssistantMessage,
    setIsChatLoading,
  } = useAppStore();

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  /**
   * isClick=true  → use clickPrompt + expandedContextWindowSize (detailed, structured)
   * isClick=false → use chatPrompt + contextWindowSize (conversational, concise)
   */
  const sendMessage = useCallback(
    async (userContent: string, isClick = false) => {
      if (!userContent.trim() || isChatLoading || !groqApiKey) return;

      const userMsg = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: userContent.trim(),
        timestamp: new Date().toISOString(),
        isClick,
      };
      addChatMessage(userMsg);

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: "",
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);
      setIsChatLoading(true);

      try {
        const systemPrompt = isClick ? clickPrompt : chatPrompt;
        const ctxSize = isClick ? expandedContextWindowSize : contextWindowSize;

        const systemMsg = buildChatContext(transcriptChunks, ctxSize, systemPrompt);

        // Build history excluding the placeholder assistant message we just added
        const history = useAppStore
          .getState()
          .chatMessages.slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }));

        const messages = [
          systemMsg,
          ...history,
          { role: "user" as const, content: userContent.trim() },
        ];

        let accumulated = "";
        for await (const delta of streamChatResponse(messages, groqApiKey)) {
          accumulated += delta;
          updateLastAssistantMessage(accumulated);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        updateLastAssistantMessage(`Error: ${errMsg}`);
      } finally {
        setIsChatLoading(false);
      }
    },
    [
      groqApiKey,
      chatPrompt,
      clickPrompt,
      contextWindowSize,
      expandedContextWindowSize,
      transcriptChunks,
      isChatLoading,
      addChatMessage,
      updateLastAssistantMessage,
      setIsChatLoading,
    ]
  );

  // Suggestion click → detailed answer mode
  useEffect(() => {
    if (pendingSuggestion) {
      sendMessage(pendingSuggestion.expanded_prompt, true);
      onSuggestionHandled();
    }
  }, [pendingSuggestion, sendMessage, onSuggestionHandled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, false);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input, false);
      setInput("");
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          AI Assistant
        </h2>
        {isChatLoading && (
          <span className="flex items-center gap-1 text-xs text-indigo-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking...
          </span>
        )}
      </div>

      {/* Scrollable messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          <div className="space-y-3 pb-2">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <MessageSquare className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">Ask questions about the meeting</p>
                <p className="text-gray-600 text-xs mt-1">
                  Or click a suggestion for a detailed answer
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-800 text-gray-200 border border-gray-700/50 rounded-bl-sm"
                    }`}
                  >
                    {/* Badge for click-expanded messages */}
                    {msg.role === "user" && msg.isClick && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-300 mb-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        From suggestion
                      </span>
                    )}
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{msg.content || "▌"}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="leading-relaxed">{msg.content}</p>
                    )}
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === "user" ? "text-indigo-300" : "text-gray-500"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the meeting... (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={isChatLoading || !groqApiKey}
            className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm resize-none"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isChatLoading || !groqApiKey}
            size="icon"
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-[58px] w-10 flex-shrink-0"
          >
            {isChatLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
