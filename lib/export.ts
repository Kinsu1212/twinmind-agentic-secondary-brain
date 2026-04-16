import { TranscriptChunk, SuggestionBatch, ChatMessage } from "./store";

// ── Layout constants ──────────────────────────────────────────────────────────
const COL_W = 36; // content width per column
// Full row: "| " + col + " | " + col + " | " + col + " |" = 3*(COL_W+3)+1 = 118 chars

const TYPE_ICONS: Record<string, string> = {
  "Action Item": "[Action]",
  Clarification: "[Clarify]",
  "Fact-Check": "[Fact]",
  Insight: "[Insight]",
  "Follow-up": "[Follow-up]",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Word-wrap text to lines of max `width` characters. */
function wrap(text: string, width: number): string[] {
  if (!text.trim()) return [""];
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= width) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // long word: hard-break it
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.slice(0, width));
          remaining = remaining.slice(width);
        }
        current = remaining;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

/** Pad a string to exactly `width` chars. */
function pad(s: string, width: number) {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

/** Render one table row from three columns (each is a string[]). */
function tableRow(c1: string[], c2: string[], c3: string[]): string {
  const h = Math.max(c1.length, c2.length, c3.length, 1);
  const rows: string[] = [];
  for (let i = 0; i < h; i++) {
    rows.push(
      `| ${pad(c1[i] ?? "", COL_W)} | ${pad(c2[i] ?? "", COL_W)} | ${pad(c3[i] ?? "", COL_W)} |`
    );
  }
  return rows.join("\n");
}

const DIVIDER = `+${"-".repeat(COL_W + 2)}+${"-".repeat(COL_W + 2)}+${"-".repeat(COL_W + 2)}+`;
const HEADER_ROW = tableRow(
  [pad("TRANSCRIPT", COL_W)],
  [pad("SUGGESTIONS", COL_W)],
  [pad("CHAT Q&A", COL_W)]
);

// ── Build column content helpers ──────────────────────────────────────────────

function buildTranscriptCell(chunk: TranscriptChunk): string[] {
  const lines: string[] = [];
  lines.push(...wrap(`[${fmtTime(chunk.timestamp)}]`, COL_W));
  lines.push(...wrap(chunk.text, COL_W));
  return lines;
}

function buildSuggestionsCell(batch: SuggestionBatch | undefined): string[] {
  if (!batch || batch.suggestions.length === 0) return wrap("—", COL_W);
  const lines: string[] = [];
  batch.suggestions.forEach((s, i) => {
    if (i > 0) lines.push(""); // blank separator
    const icon = TYPE_ICONS[s.type] || "[?]";
    lines.push(...wrap(`${icon} ${s.title}`, COL_W));
    lines.push(...wrap(s.body, COL_W));
  });
  return lines;
}

function buildChatCell(messages: ChatMessage[]): string[] {
  if (messages.length === 0) return wrap("—", COL_W);
  const lines: string[] = [];
  // Group into Q/A pairs
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (i > 0) lines.push("");
    if (m.role === "user") {
      lines.push(...wrap(`Q: ${m.content}`, COL_W));
    } else {
      // Strip markdown for plain text
      const plain = m.content
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/^\s*[-*]\s+/gm, "• ")
        .replace(/^\s*\d+\.\s+/gm, "• ")
        .trim();
      lines.push(...wrap(`A: ${plain}`, COL_W));
    }
  }
  return lines;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportSession(
  transcriptChunks: TranscriptChunk[],
  suggestionBatches: SuggestionBatch[],
  chatMessages: ChatMessage[]
) {
  const now = new Date();
  const lines: string[] = [];

  // Title block
  const titleWidth = DIVIDER.length;
  const title = "TWINMIND COPILOT — SESSION NOTES";
  const exported = `Exported: ${fmtDate(now.toISOString())}`;
  lines.push("=".repeat(titleWidth));
  lines.push(title.padStart(Math.floor((titleWidth + title.length) / 2)));
  lines.push(exported.padStart(Math.floor((titleWidth + exported.length) / 2)));
  lines.push("=".repeat(titleWidth));
  lines.push("");

  if (transcriptChunks.length === 0) {
    lines.push("No transcript recorded in this session.");
    lines.push("");
  } else {
    // Table header
    lines.push(DIVIDER);
    lines.push(HEADER_ROW);
    lines.push(DIVIDER);

    // One row per transcript chunk
    for (let i = 0; i < transcriptChunks.length; i++) {
      const chunk = transcriptChunks[i];
      const nextChunkTime = transcriptChunks[i + 1]?.timestamp ?? new Date(9999, 0).toISOString();

      // Find the suggestion batch generated closest after this chunk
      // (suggestionBatches is stored newest-first, so reverse to find first match)
      const matchedBatch = [...suggestionBatches]
        .reverse()
        .find(
          (b) => b.timestamp >= chunk.timestamp && b.timestamp < nextChunkTime
        );

      // Find chat messages that occurred in this chunk's time window
      const matchedChats = chatMessages.filter(
        (m) => m.timestamp >= chunk.timestamp && m.timestamp < nextChunkTime
      );

      const c1 = buildTranscriptCell(chunk);
      const c2 = buildSuggestionsCell(matchedBatch);
      const c3 = buildChatCell(matchedChats);

      lines.push(tableRow(c1, c2, c3));
      lines.push(DIVIDER);
    }

    // Any chat messages after the last transcript chunk
    const lastChunkTime = transcriptChunks[transcriptChunks.length - 1]?.timestamp ?? "";
    const tailChats = chatMessages.filter((m) => m.timestamp > lastChunkTime);
    if (tailChats.length > 0) {
      lines.push(tableRow(
        wrap("(after last chunk)", COL_W),
        wrap("—", COL_W),
        buildChatCell(tailChats)
      ));
      lines.push(DIVIDER);
    }
  }

  // Footer
  lines.push("");
  lines.push(`Session stats: ${transcriptChunks.length} transcript chunk(s), ` +
    `${suggestionBatches.length} suggestion batch(es), ` +
    `${chatMessages.filter(m => m.role === "user").length} question(s) asked`);
  lines.push("=".repeat(DIVIDER.length));

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twinmind-session-${now.toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
