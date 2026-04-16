"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { Loader2, Mic, MicOff, Pause, Play, Zap } from "lucide-react";

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  audioLevelRef: React.RefObject<number>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

const BAR_COUNT = 5;

export function TranscriptPanel({
  isRecording,
  isPaused,
  audioLevelRef,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
}: Props) {
  const { transcriptChunks, isProcessingChunk, groqApiKey, targetChunkId, setTargetChunkId } =
    useAppStore();
  const [error, setError] = useState<string | null>(null);

  // Scroll refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Audio level bar refs — direct DOM manipulation, no re-renders
  const barRefs = useRef<(HTMLDivElement | null)[]>(Array(BAR_COUNT).fill(null));
  const smoothed = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const animRef = useRef<number>(0);

  // Auto-scroll to newest chunk
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptChunks]);

  // Scroll to targeted chunk (from suggestion link click)
  useEffect(() => {
    if (!targetChunkId) return;
    const el = chunkRefs.current.get(targetChunkId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-indigo-400");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-indigo-400");
        setTargetChunkId(null);
      }, 2000);
    }
  }, [targetChunkId, setTargetChunkId]);

  // Audio level meter animation (direct DOM, zero React re-renders)
  useEffect(() => {
    if (!isRecording || isPaused) {
      cancelAnimationFrame(animRef.current);
      barRefs.current.forEach((b) => {
        if (b) b.style.height = "3px";
      });
      smoothed.current = Array(BAR_COUNT).fill(0);
      return;
    }

    const tick = () => {
      const level = audioLevelRef.current ?? 0;
      barRefs.current.forEach((bar, i) => {
        if (!bar) return;
        const variance = 0.6 + Math.random() * 0.8;
        const target = Math.min(1, level * 10 * variance);
        smoothed.current[i] = smoothed.current[i] * 0.65 + target * 0.35;
        bar.style.height = `${3 + smoothed.current[i] * 22}px`;
      });
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, isPaused, audioLevelRef]);

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

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

      {/* Controls + audio meter */}
      <div className="mb-3 flex-shrink-0 space-y-2">
        {!isRecording ? (
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

        {/* Audio level meter */}
        {isRecording && !isPaused && (
          <div className="flex items-end justify-center gap-1 h-7 py-1">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <div
                key={i}
                ref={(el) => { barRefs.current[i] = el; }}
                className="w-1.5 rounded-full bg-indigo-400 transition-none"
                style={{ height: "3px" }}
              />
            ))}
          </div>
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

      {/* Transcript list */}
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
                <div
                  key={chunk.id}
                  ref={(el) => {
                    if (el) chunkRefs.current.set(chunk.id, el);
                    else chunkRefs.current.delete(chunk.id);
                  }}
                  className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-indigo-400/70 font-mono">
                      {formatTime(chunk.timestamp)}
                    </p>
                    {chunk.transcriptionMs !== undefined && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/70">
                        <Zap className="w-2.5 h-2.5" />
                        {(chunk.transcriptionMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
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
