import { SuggestionBatch, Suggestion, TranscriptChunk } from "./store";

const GROQ_BASE = "https://api.groq.com/openai/v1";

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  const file = new File([audioBlob], "audio.webm", { type: audioBlob.type });
  formData.append("file", file);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "text");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transcription failed: ${err}`);
  }

  return res.text();
}

export async function generateSuggestions(
  transcriptChunks: TranscriptChunk[],
  contextWindowSize: number,
  systemPrompt: string,
  apiKey: string
): Promise<SuggestionBatch> {
  const words = transcriptChunks
    .map((c) => c.text)
    .join(" ")
    .split(" ");
  const context = words.slice(-contextWindowSize).join(" ");

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this meeting transcript and generate 3 suggestions:\n\n${context}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Suggestions failed: ${err}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  const suggestions: Suggestion[] = (parsed.suggestions || []).slice(0, 3);

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    suggestions,
  };
}

export async function* streamChatResponse(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  apiKey: string
): AsyncGenerator<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat failed: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") return;
      try {
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function buildChatContext(
  transcriptChunks: TranscriptChunk[],
  contextWindowSize: number,
  systemPrompt: string
): { role: "system"; content: string } {
  const words = transcriptChunks
    .map((c) => c.text)
    .join(" ")
    .split(" ");
  const context = words.slice(-contextWindowSize).join(" ");

  return {
    role: "system",
    content: `${systemPrompt}\n\n## Current Meeting Transcript:\n${context || "No transcript available yet."}`,
  };
}
