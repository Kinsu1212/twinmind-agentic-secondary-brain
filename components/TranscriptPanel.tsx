"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { Loader2, Mic, MicOff, Pause, Play } from "lucide-react";

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function TranscriptPanel({
  isRecording,
  isPaused,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
}: Props) {
  const { transcriptChunks, isProcessingChunk, groqApiKey } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptChunks]);

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Determine status badge
  const statusBadge = !isRecording ? (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
      <MicOff className="w-3 h-3" />
      Idle
    </span>
  ) : isPaused ? (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
      <Pause className="w-3 h-3" />
      Paused
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
      Live
    </span>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Live Transcript
        </h2>
        <div className="flex items-center gap-2">
          {isProcessingChunk && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transcribing...
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 flex-shrink-0 space-y-2">
        {!isRecording ? (
          // IDLE → single Start button
          <Button
            onClick={handleStart}
            disabled={!groqApiKey}
            title={!groqApiKey ? "Configure API key in settings first" : ""}
            className="w-full gap-2 font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </Button>
        ) : isPaused ? (
          // PAUSED → Resume (primary) + Stop (secondary)
          <div className="flex gap-2">
            <Button
              onClick={resumeRecording}
              className="flex-1 gap-2 font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Play className="w-4 h-4" />
              Resume
            </Button>
            <Button
              onClick={stopRecording}
              variant="outline"
              className="flex-1 gap-2 font-medium border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-red-400 hover:border-red-500/50"
            >
              <MicOff className="w-4 h-4" />
              Stop
            </Button>
          </div>
        ) : (
          // LIVE → Pause (primary) + Stop (secondary)
          <div className="flex gap-2">
            <Button
              onClick={pauseRecording}
              className="flex-1 gap-2 font-medium bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button
              onClick={stopRecording}
              variant="outline"
              className="flex-1 gap-2 font-medium border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-red-400 hover:border-red-500/50"
            >
              <MicOff className="w-4 h-4" />
              Stop
            </Button>
          </div>
        )}

        {isRecording && !isPaused && (
          <p className="text-xs text-gray-500 text-center">
            Auto-chunks every 30s &mdash; hit <span className="text-indigo-400">Reload Suggestions</span> to flush early
          </p>
        )}
        {isRecording && isPaused && (
          <p className="text-xs text-yellow-500/60 text-center">
            Recording paused — audio is not being captured
          </p>
        )}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        {!groqApiKey && (
          <p className="text-xs text-yellow-500/70 text-center">Set your API key in Settings first</p>
        )}
      </div>

      {/* Scrollable transcript */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          <div className="space-y-3 pb-2">
            {transcriptChunks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Mic className="w-10 h-10 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm">No transcript yet</p>
                <p className="text-gray-600 text-xs mt-1">Audio is chunked every 30s and transcribed</p>
              </div>
            ) : (
              transcriptChunks.map((chunk) => (
                <div key={chunk.id} className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3">
                  <p className="text-xs text-indigo-400/70 mb-1 font-mono">{formatTime(chunk.timestamp)}</p>
                  <p className="text-sm text-gray-200 leading-relaxed">{chunk.text}</p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {transcriptChunks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/50 flex-shrink-0">
          <p className="text-xs text-gray-500">
            {transcriptChunks.length} chunk{transcriptChunks.length !== 1 ? "s" : ""} &bull;{" "}
            {transcriptChunks.reduce((acc, c) => acc + c.text.split(" ").length, 0)} words
          </p>
        </div>
      )}
    </div>
  );
}
