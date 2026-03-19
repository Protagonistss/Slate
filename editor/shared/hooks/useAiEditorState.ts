import { useEffect, useRef, useState } from "react";

export type AiStatus = "idle" | "generating" | "diff";

export function useAiEditorState() {
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [selectedModel, setSelectedModel] = useState("claude-3.5-sonnet");
  const generationTimerRef = useRef<number | null>(null);

  const clearGenerationTimer = () => {
    if (generationTimerRef.current !== null) {
      window.clearTimeout(generationTimerRef.current);
      generationTimerRef.current = null;
    }
  };

  const resetAiState = (clearPrompt = false) => {
    clearGenerationTimer();
    setAiStatus("idle");
    if (clearPrompt) {
      setPrompt("");
    }
  };

  const handleAiSubmit = () => {
    clearGenerationTimer();
    setAiStatus("generating");
    generationTimerRef.current = window.setTimeout(() => {
      setAiStatus("diff");
      generationTimerRef.current = null;
    }, 2200);
  };

  const handleAcceptOrDiscard = () => {
    resetAiState(true);
  };

  useEffect(() => {
    return () => {
      clearGenerationTimer();
    };
  }, []);

  return {
    prompt,
    setPrompt,
    aiStatus,
    selectedModel,
    setSelectedModel,
    resetAiState,
    handleAiSubmit,
    handleAcceptOrDiscard,
  };
}
