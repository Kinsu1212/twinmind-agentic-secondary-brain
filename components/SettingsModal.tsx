"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAppStore,
  DEFAULT_SUGGESTION_PROMPT,
  DEFAULT_CLICK_PROMPT,
  DEFAULT_CHAT_PROMPT,
} from "@/lib/store";
import { Eye, EyeOff, RotateCcw, Settings } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionLabel({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

export function SettingsModal({ open, onOpenChange }: Props) {
  const {
    groqApiKey, setGroqApiKey,
    suggestionPrompt, setSuggestionPrompt,
    clickPrompt, setClickPrompt,
    chatPrompt, setChatPrompt,
    contextWindowSize, setContextWindowSize,
    expandedContextWindowSize, setExpandedContextWindowSize,
  } = useAppStore();

  const [localKey, setLocalKey] = useState(groqApiKey);
  const [localSuggPrompt, setLocalSuggPrompt] = useState(suggestionPrompt);
  const [localClickPrompt, setLocalClickPrompt] = useState(clickPrompt);
  const [localChatPrompt, setLocalChatPrompt] = useState(chatPrompt);
  const [localCtxSize, setLocalCtxSize] = useState(String(contextWindowSize));
  const [localExpandedCtxSize, setLocalExpandedCtxSize] = useState(String(expandedContextWindowSize));
  const [showKey, setShowKey] = useState(false);

  // Re-sync local state when modal opens (in case store was updated externally)
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setLocalKey(groqApiKey);
      setLocalSuggPrompt(suggestionPrompt);
      setLocalClickPrompt(clickPrompt);
      setLocalChatPrompt(chatPrompt);
      setLocalCtxSize(String(contextWindowSize));
      setLocalExpandedCtxSize(String(expandedContextWindowSize));
    }
    onOpenChange(val);
  };

  const handleSave = () => {
    setGroqApiKey(localKey.trim());
    setSuggestionPrompt(localSuggPrompt.trim() || DEFAULT_SUGGESTION_PROMPT);
    setClickPrompt(localClickPrompt.trim() || DEFAULT_CLICK_PROMPT);
    setChatPrompt(localChatPrompt.trim() || DEFAULT_CHAT_PROMPT);
    setContextWindowSize(Math.min(8000, Math.max(100, Number(localCtxSize) || 800)));
    setExpandedContextWindowSize(Math.min(8000, Math.max(100, Number(localExpandedCtxSize) || 3000)));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Settings className="w-5 h-5 text-indigo-400" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            All settings are stored locally in your browser — nothing is sent to any server except Groq.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* ── API Key ── */}
          <div className="space-y-2">
            <SectionLabel
              title="Groq API Key *"
              description="Your personal key used for transcription and AI. Get one free at console.groq.com."
            />
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="gsk_..."
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* ── Context Windows ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <SectionLabel
                title="Context window — live suggestions"
                description="Words of transcript sent when generating suggestions. Default: 800."
              />
              <Input
                type="number"
                value={localCtxSize}
                onChange={(e) => setLocalCtxSize(e.target.value)}
                min={100}
                max={8000}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <SectionLabel
                title="Context window — expanded answers"
                description="Words sent when a suggestion is clicked for a detailed answer. Default: 3000."
              />
              <Input
                type="number"
                value={localExpandedCtxSize}
                onChange={(e) => setLocalExpandedCtxSize(e.target.value)}
                min={100}
                max={8000}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* ── Live Suggestion Prompt ── */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <SectionLabel
                title="Live suggestion prompt"
                description="System prompt used to generate the 3 suggestion cards after each transcript chunk."
              />
              <button
                type="button"
                onClick={() => setLocalSuggPrompt(DEFAULT_SUGGESTION_PROMPT)}
                title="Reset to default"
                className="text-gray-500 hover:text-indigo-400 mt-0.5 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <Textarea
              value={localSuggPrompt}
              onChange={(e) => setLocalSuggPrompt(e.target.value)}
              rows={8}
              className="bg-gray-800 border-gray-600 text-white text-xs font-mono resize-y"
            />
          </div>

          {/* ── Detailed Answers On-Click Prompt ── */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <SectionLabel
                title="Detailed answers on-click prompt"
                description="System prompt used when a suggestion card is clicked. Produces a longer, structured response using the expanded context window."
              />
              <button
                type="button"
                onClick={() => setLocalClickPrompt(DEFAULT_CLICK_PROMPT)}
                title="Reset to default"
                className="text-gray-500 hover:text-indigo-400 mt-0.5 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <Textarea
              value={localClickPrompt}
              onChange={(e) => setLocalClickPrompt(e.target.value)}
              rows={6}
              className="bg-gray-800 border-gray-600 text-white text-xs font-mono resize-y"
            />
          </div>

          {/* ── Chat Prompt ── */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <SectionLabel
                title="Chat prompt"
                description="System prompt for questions typed directly in the chat input. Kept concise — normal context window applies."
              />
              <button
                type="button"
                onClick={() => setLocalChatPrompt(DEFAULT_CHAT_PROMPT)}
                title="Reset to default"
                className="text-gray-500 hover:text-indigo-400 mt-0.5 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <Textarea
              value={localChatPrompt}
              onChange={(e) => setLocalChatPrompt(e.target.value)}
              rows={4}
              className="bg-gray-800 border-gray-600 text-white text-xs font-mono resize-y"
            />
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!localKey.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
