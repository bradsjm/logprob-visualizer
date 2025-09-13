import { useState } from "react";
import { ChatTranscript } from "@/components/ChatTranscript";
import { Composer } from "@/components/Composer";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ModelSelector } from "@/components/ModelSelector";
import { ParameterBadges } from "@/components/ParameterBadges";
import { BranchBadge } from "@/components/BranchBadge";
import type { CompletionLP, BranchContext, ModelInfo, RunParameters } from "@/types/logprob";

const Playground = () => {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; tokens?: any[] }>>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo>({ 
    id: "gpt-4o", 
    name: "GPT-4", 
    supportsTopK: false 
  });
  const [branchContext, setBranchContext] = useState<BranchContext | null>(null);
  const [currentCompletion, setCurrentCompletion] = useState<CompletionLP | null>(null);
  const [runParameters, setRunParameters] = useState<RunParameters>({
    temperature: 0.7,
    top_p: 1.0,
    max_tokens: 128,
    top_logprobs: 5,
    presence_penalty: 0,
    frequency_penalty: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage = { role: "user" as const, content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Mock API call - replace with actual OpenAI API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock response with token probabilities
      const mockResponse: CompletionLP = {
        text: "The Burj Khalifa in Dubai is currently the world's tallest building, measuring 828 meters (2,717 feet) in height.",
        tokens: [
          { index: 0, token: "The", logprob: -0.5, prob: 0.6065, top_logprobs: [
            { token: "The", logprob: -0.5, prob: 0.6065 },
            { token: "A", logprob: -1.2, prob: 0.3012 },
            { token: "Currently", logprob: -2.1, prob: 0.1224 }
          ]},
          { index: 1, token: " Burj", logprob: -0.1, prob: 0.9048, top_logprobs: [
            { token: " Burj", logprob: -0.1, prob: 0.9048 },
            { token: " tallest", logprob: -2.5, prob: 0.0821 }
          ]},
          { index: 2, token: " Khalifa", logprob: -0.05, prob: 0.9512, top_logprobs: [
            { token: " Khalifa", logprob: -0.05, prob: 0.9512 }
          ]},
          { index: 3, token: " in", logprob: -0.3, prob: 0.7408, top_logprobs: [
            { token: " in", logprob: -0.3, prob: 0.7408 },
            { token: " is", logprob: -1.1, prob: 0.3329 }
          ]},
          { index: 4, token: " Dubai", logprob: -0.2, prob: 0.8187, top_logprobs: [
            { token: " Dubai", logprob: -0.2, prob: 0.8187 },
            { token: " UAE", logprob: -1.8, prob: 0.1653 }
          ]},
          { index: 5, token: " is", logprob: -0.4, prob: 0.6703, top_logprobs: [
            { token: " is", logprob: -0.4, prob: 0.6703 },
            { token: " stands", logprob: -0.9, prob: 0.4066 }
          ]},
          { index: 6, token: " currently", logprob: -0.8, prob: 0.4493, top_logprobs: [
            { token: " currently", logprob: -0.8, prob: 0.4493 },
            { token: " the", logprob: -1.0, prob: 0.3679 }
          ]},
          { index: 7, token: " the", logprob: -0.3, prob: 0.7408, top_logprobs: [
            { token: " the", logprob: -0.3, prob: 0.7408 }
          ]},
          { index: 8, token: " world", logprob: -0.2, prob: 0.8187, top_logprobs: [
            { token: " world", logprob: -0.2, prob: 0.8187 }
          ]},
          { index: 9, token: "'s", logprob: -0.1, prob: 0.9048, top_logprobs: [
            { token: "'s", logprob: -0.1, prob: 0.9048 }
          ]},
          { index: 10, token: " tallest", logprob: -0.15, prob: 0.8607, top_logprobs: [
            { token: " tallest", logprob: -0.15, prob: 0.8607 },
            { token: " largest", logprob: -2.2, prob: 0.1108 }
          ]},
          { index: 11, token: " building", logprob: -0.1, prob: 0.9048, top_logprobs: [
            { token: " building", logprob: -0.1, prob: 0.9048 },
            { token: " structure", logprob: -2.5, prob: 0.0821 }
          ]},
          { index: 12, token: ",", logprob: -0.5, prob: 0.6065, top_logprobs: [
            { token: ",", logprob: -0.5, prob: 0.6065 },
            { token: " in", logprob: -1.2, prob: 0.3012 }
          ]},
          { index: 13, token: " measuring", logprob: -0.88, prob: 0.4141, top_logprobs: [
            { token: " measuring", logprob: -0.88, prob: 0.4141 },
            { token: " standing", logprob: -1.15, prob: 0.3180 },
            { token: " with", logprob: -2.45, prob: 0.0862 },
            { token: " reaching", logprob: -2.51, prob: 0.0813 },
            { token: " at", logprob: -2.66, prob: 0.0701 }
          ]},
          { index: 14, token: " 828", logprob: -0.3, prob: 0.7408, top_logprobs: [
            { token: " 828", logprob: -0.3, prob: 0.7408 }
          ]},
          { index: 15, token: " meters", logprob: -0.4, prob: 0.6703, top_logprobs: [
            { token: " meters", logprob: -0.4, prob: 0.6703 },
            { token: " m", logprob: -1.1, prob: 0.3329 }
          ]}
        ],
        finish_reason: "stop",
        usage: { prompt_tokens: 12, completion_tokens: 16, total_tokens: 28 },
        model: selectedModel.id,
        latency: 1240
      };

      const assistantMessage = { 
        role: "assistant" as const, 
        content: mockResponse.text,
        tokens: mockResponse.tokens
      };
      
      setMessages([...newMessages, assistantMessage]);
      setCurrentCompletion(mockResponse);
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranch = (tokenIndex: number, newToken: string) => {
    if (!currentCompletion) return;
    
    const prefix = currentCompletion.tokens
      .slice(0, tokenIndex)
      .map(t => t.token)
      .join("");
    
    setBranchContext({
      tokenIndex,
      newToken,
      prefix: prefix + newToken,
      originalToken: currentCompletion.tokens[tokenIndex]?.token || ""
    });
  };

  const clearBranch = () => {
    setBranchContext(null);
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <header className="border-b bg-surface/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">Logprob Visualizer</h1>
          <ModelSelector 
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
        <div className="flex items-center gap-2">
          <ParameterBadges parameters={runParameters} />
          {branchContext && (
            <BranchBadge 
              branchContext={branchContext}
              onClear={clearBranch}
            />
          )}
        </div>
      </header>

      {/* Main workspace */}
      <main className="workspace-main">
        {/* Chat transcript */}
        <div className="transcript-panel">
          <ChatTranscript 
            messages={messages}
            isLoading={isLoading}
            onTokenClick={handleBranch}
            currentCompletion={currentCompletion}
          />
          <Composer 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            branchContext={branchContext}
            parameters={runParameters}
            onParametersChange={setRunParameters}
            modelSupportsTopK={selectedModel.supportsTopK}
          />
        </div>

        {/* Analysis panel */}
        <AnalysisPanel 
          completion={currentCompletion}
          onTokenClick={(tokenIndex) => {
            // Scroll to token and highlight
            const tokenElement = document.querySelector(`[data-token-index="${tokenIndex}"]`);
            tokenElement?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </main>
    </div>
  );
};

export default Playground;