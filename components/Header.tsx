"use client";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { exportSession } from "@/lib/export";
import { FileDown, Settings, Trash2, Zap } from "lucide-react";

interface Props {
  onOpenSettings: () => void;
  isRecording: boolean;
  stopRecording: () => void;
}

export function Header({ onOpenSettings, isRecording, stopRecording }: Props) {
  const {
    groqApiKey,
    transcriptChunks,
    suggestionBatches,
    chatMessages,
    clearTranscript,
    clearSuggestions,
    clearChat,
  } = useAppStore();

  const handleClearSession = () => {
    stopRecording();
    clearTranscript();
    clearSuggestions();
    clearChat();
  };

  const hasContent =
    transcriptChunks.length > 0 ||
    suggestionBatches.length > 0 ||
    chatMessages.length > 0;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <Zap className="w-5 h-5 text-indigo-400" />
        <span className="font-bold text-white text-lg tracking-tight">TwinMind</span>
        <span className="text-gray-500 text-lg font-light">Copilot</span>
        {isRecording && (
          <span className="ml-2 flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            Recording
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => exportSession(transcriptChunks, suggestionBatches, chatMessages)}
          disabled={!hasContent}
          title="Download session notes as a readable text file"
          className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <FileDown className="w-4 h-4" />
          Export
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleClearSession}
          disabled={!hasContent}
          title="Clear session"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onOpenSettings}
          title="Settings"
          className={`border-gray-600 hover:bg-gray-800 hover:text-white ${
            groqApiKey ? "text-gray-300" : "text-yellow-400 border-yellow-500/50 animate-pulse"
          }`}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
