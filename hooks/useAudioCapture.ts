"use client";

import { useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { transcribeAudio, generateSuggestions } from "@/lib/groq";

const CHUNK_INTERVAL_MS = 30000;

export function useAudioCapture() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");

  const {
    groqApiKey,
    suggestionPrompt,
    contextWindowSize,
    isRecording,
    isPaused,
    setIsRecording,
    setIsPaused,
    setIsProcessingChunk,
    addTranscriptChunk,
    addSuggestionBatch,
    setIsGeneratingSuggestions,
  } = useAppStore();

  const processAudioChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1000) return;
      setIsProcessingChunk(true);
      try {
        const text = await transcribeAudio(blob, groqApiKey);
        if (!text.trim()) return;

        const chunk = {
          id: crypto.randomUUID(),
          text: text.trim(),
          timestamp: new Date().toISOString(),
        };
        addTranscriptChunk(chunk);

        const allChunks = [...useAppStore.getState().transcriptChunks];
        if (allChunks.length > 0) {
          setIsGeneratingSuggestions(true);
          try {
            const batch = await generateSuggestions(
              allChunks,
              contextWindowSize,
              suggestionPrompt,
              groqApiKey
            );
            addSuggestionBatch(batch);
          } catch (err) {
            console.error("Suggestion generation error:", err);
          } finally {
            setIsGeneratingSuggestions(false);
          }
        }
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsProcessingChunk(false);
      }
    },
    [
      groqApiKey,
      suggestionPrompt,
      contextWindowSize,
      addTranscriptChunk,
      addSuggestionBatch,
      setIsProcessingChunk,
      setIsGeneratingSuggestions,
    ]
  );

  const startNewChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
    chunksRef.current = [];
    recorder.start();
  }, []);

  const startRecording = useCallback(async () => {
    if (!groqApiKey) throw new Error("No Groq API key configured");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      processAudioChunk(blob);
    };

    recorder.start();
    setIsRecording(true);
    setIsPaused(false);
    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
  }, [groqApiKey, processAudioChunk, startNewChunk, setIsRecording, setIsPaused]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // If paused, resume first so onstop fires with accumulated data
      if (recorder.state === "paused") recorder.resume();
      recorder.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, [setIsRecording, setIsPaused]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    // Stop the auto-chunk interval while paused
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    recorder.pause();
    setIsPaused(true);
  }, [setIsPaused]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;

    recorder.resume();
    setIsPaused(false);

    // Restart the auto-chunk interval from this moment
    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
  }, [startNewChunk, setIsPaused]);

  const flushChunk = useCallback((): boolean => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    recorder.stop();
    chunksRef.current = [];
    recorder.start();

    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
    return true;
  }, [startNewChunk]);

  return {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    flushChunk,
  };
}
