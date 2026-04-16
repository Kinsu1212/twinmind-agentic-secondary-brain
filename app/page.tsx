"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { useAppStore, Suggestion } from "@/lib/store";
import { useAudioCapture } from "@/hooks/useAudioCapture";

export default function Home() {
  const { groqApiKey } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<Suggestion | null>(null);

  const {
    isRecording,
    isPaused,
    audioLevelRef,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    flushChunk,
  } = useAudioCapture();

  useEffect(() => {
    if (!groqApiKey) setSettingsOpen(true);
  }, [groqApiKey]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        isRecording={isRecording}
        stopRecording={stopRecording}
      />

      <main className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        <div className="border-r border-gray-700/50 p-4 overflow-hidden flex flex-col">
          <TranscriptPanel
            isRecording={isRecording}
            isPaused={isPaused}
            audioLevelRef={audioLevelRef}
            startRecording={startRecording}
            stopRecording={stopRecording}
            pauseRecording={pauseRecording}
            resumeRecording={resumeRecording}
          />
        </div>

        <div className="border-r border-gray-700/50 p-4 overflow-hidden flex flex-col">
          <SuggestionsPanel
            onSuggestionClick={setPendingSuggestion}
            isRecording={isRecording}
            flushChunk={flushChunk}
          />
        </div>

        <div className="p-4 overflow-hidden flex flex-col">
          <ChatPanel
            pendingSuggestion={pendingSuggestion}
            onSuggestionHandled={() => setPendingSuggestion(null)}
          />
        </div>
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
