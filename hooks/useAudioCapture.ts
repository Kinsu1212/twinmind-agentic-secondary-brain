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

  // Audio level metering
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioLevelRef = useRef<number>(0);

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
        const transcribeStart = Date.now();
        const text = await transcribeAudio(blob, groqApiKey);
        if (!text.trim()) return;

        const chunk = {
          id: crypto.randomUUID(),
          text: text.trim(),
          timestamp: new Date().toISOString(),
          transcriptionMs: Date.now() - transcribeStart,
        };
        addTranscriptChunk(chunk);

        const allChunks = [...useAppStore.getState().transcriptChunks];
        if (allChunks.length > 0) {
          setIsGeneratingSuggestions(true);
          try {
            const suggestionStart = Date.now();
            const batch = await generateSuggestions(
              allChunks,
              contextWindowSize,
              suggestionPrompt,
              groqApiKey
            );
            batch.suggestionMs = Date.now() - suggestionStart;
            batch.triggeredByChunkId = chunk.id;
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

  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        audioLevelRef.current = Math.sqrt(sum / dataArray.length);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext not supported — meter silently disabled
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioLevelRef.current = 0;
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

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
    startLevelMeter(stream);
    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
  }, [groqApiKey, processAudioChunk, startNewChunk, setIsRecording, setIsPaused, startLevelMeter]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      if (recorder.state === "paused") recorder.resume();
      recorder.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopLevelMeter();
    setIsRecording(false);
    setIsPaused(false);
  }, [setIsRecording, setIsPaused, stopLevelMeter]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    recorder.pause();
    // Pause the level meter animation
    cancelAnimationFrame(animFrameRef.current);
    audioLevelRef.current = 0;
    setIsPaused(true);
  }, [setIsPaused]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    setIsPaused(false);

    // Resume level meter
    if (analyserRef.current) {
      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        audioLevelRef.current = Math.sqrt(sum / dataArray.length);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
  }, [startNewChunk, setIsPaused]);

  const flushChunk = useCallback((): boolean => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    recorder.stop();
    chunksRef.current = [];
    recorder.start();
    intervalRef.current = setInterval(startNewChunk, CHUNK_INTERVAL_MS);
    return true;
  }, [startNewChunk]);

  return {
    isRecording,
    isPaused,
    audioLevelRef,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    flushChunk,
  };
}
