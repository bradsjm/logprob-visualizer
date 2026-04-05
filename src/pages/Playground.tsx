import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ChatTranscript } from "@/components/ChatTranscript";
import { Composer, type ComposerHandle } from "@/components/Composer";
import { ConnectionSettingsDialog } from "@/components/ConnectionSettingsDialog";
import { ModelSelector } from "@/components/ModelSelector";
import { PresetChips } from "@/components/PresetChips";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePlaygroundSession } from "@/features/playground/hooks/usePlaygroundSession";
import { useRunParameters } from "@/features/playground/hooks/useRunParameters";
import { useTokenNavigation } from "@/features/playground/hooks/useTokenNavigation";
import { normalizeRunParameter } from "@/features/playground/lib/runParameters";
import type { RequestBlockState } from "@/features/playground/lib/types";
import { useConnectionSettings } from "@/hooks/useConnectionSettings";
import { useModelCapability } from "@/hooks/useModelCapability";
import { useModels } from "@/hooks/useModels";
import { StreamTransport } from "@/lib/transport/stream";

/**
 * Main playground view combining chat, analysis, and parameter controls for logprob exploration.
 */
const Playground = () => {
  const composerRef = useRef<ComposerHandle>(null);
  const resetTokenNavigationRef = useRef<() => void>(() => undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showWhitespaceOverlays, setShowWhitespaceOverlays] = useState(false);
  const [showPunctuationOverlays, setShowPunctuationOverlays] = useState(false);
  const { settings, connection, resolvedBaseUrl, hasSavedSettings, saveSettings, clearSettings } =
    useConnectionSettings();
  const { selectedModelId, setSelectedModelId, runParameters, setRunParameters, applyRunParameterPatch } =
    useRunParameters();
  const { models, isLoading: isModelsLoading, isError: isModelsError, errorMessage } =
    useModels(connection);
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  const capability = useModelCapability(connection, selectedModel?.id ?? null);
  const transport = useMemo(() => new StreamTransport(connection), [connection]);

  useEffect(() => {
    if (!hasSavedSettings || models.length === 0) {
      return;
    }

    const hasSelectedModel = selectedModelId
      ? models.some((model) => model.id === selectedModelId)
      : false;
    if (hasSelectedModel) {
      return;
    }

    const nextModel = models[0] ?? null;
    if (!nextModel) {
      setSelectedModelId(null);
      return;
    }

    setSelectedModelId(nextModel.id);
    if (selectedModelId) {
      toast("Model updated", {
        description: `Selected ${nextModel.name}`,
      });
    }
  }, [hasSavedSettings, models, selectedModelId, setSelectedModelId]);

  const lastCapabilityToastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedModel || capability.status !== "unsupported") {
      return;
    }

    const nextKey = `${resolvedBaseUrl}:${selectedModel.id}`;
    if (lastCapabilityToastRef.current === nextKey) {
      return;
    }

    lastCapabilityToastRef.current = nextKey;
    toast("Selected model is incompatible", {
      description:
        capability.message ??
        "This model does not return logprobs and cannot be used here.",
    });
  }, [capability.message, capability.status, resolvedBaseUrl, selectedModel]);

  const blockState = useMemo<RequestBlockState | null>(() => {
    if (!hasSavedSettings) {
      return {
        title: "Connection settings required",
        description:
          "Add an API key before loading models or generating completions.",
        kind: "missing-settings",
      };
    }

    if (isModelsLoading) {
      return {
        title: "Loading models",
        description: "Fetching models from the configured provider.",
        kind: "loading-models",
      };
    }

    if (isModelsError) {
      return {
        title: "Model discovery failed",
        description:
          errorMessage ??
          "The provider did not return a usable models response.",
        kind: "model-error",
      };
    }

    if (!selectedModel) {
      return {
        title: "No model selected",
        description: "Choose a provider model before sending a prompt.",
        kind: "missing-model",
      };
    }

    if (capability.status === "checking") {
      return {
        title: "Checking logprobs support",
        description: "Verifying that the selected model supports logprobs.",
        kind: "checking-capability",
      };
    }

    if (capability.status === "unsupported") {
      return {
        title: "Selected model does not support logprobs",
        description:
          capability.message ??
          "Choose a different model. This app requires logprobs for analysis.",
        kind: "unsupported-model",
      };
    }

    return null;
  }, [
    capability.message,
    capability.status,
    errorMessage,
    hasSavedSettings,
    isModelsError,
    isModelsLoading,
    selectedModel,
  ]);

  const capabilityNotice = useMemo(() => {
    if (capability.status !== "unknown-transient") {
      return null;
    }

    return {
      title: "Unable to verify logprobs support",
      description:
        capability.message ??
        "Capability probing failed. You can still try a generation request.",
    };
  }, [capability.message, capability.status]);

  const session = usePlaygroundSession({
    transport,
    selectedModelId: selectedModel?.id ?? null,
    runParameters,
    blockState,
    onRequireSettings: () => setIsSettingsOpen(true),
    onFocusComposer: () => composerRef.current?.focus(),
    onResetTokenNavigation: () => resetTokenNavigationRef.current(),
  });
  const tokenNavigation = useTokenNavigation({
    composerRef,
    currentCompletion: session.currentCompletion,
    activeCompletionMessageId: session.activeCompletionMessageId,
    lastLowIndex: session.lastLowIndex,
    onLastLowIndexChange: session.setLastLowIndex,
    onAnnounce: session.setLiveMessage,
  });
  resetTokenNavigationRef.current = tokenNavigation.resetTokenNavigation;
  const deferredCompletion = useDeferredValue(session.currentCompletion);

  return (
    <div className="workspace-container">
      <ConnectionSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        resolvedBaseUrl={resolvedBaseUrl}
        onSave={(nextSettings) => {
          session.abortActiveStream(true);
          session.resetAnalysisState();
          saveSettings(nextSettings);
          toast("Connection settings saved", {
            description: "Refreshing provider models.",
          });
        }}
        onClear={() => {
          session.abortActiveStream(true);
          clearSettings();
          setSelectedModelId(null);
          session.clearHistory();
          toast("Connection settings cleared");
        }}
      />
      <div aria-live="polite" className="sr-only" role="status">
        {session.liveMessage}
      </div>

      <header className="border-b bg-surface/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">
            Logprob Visualizer
          </h1>
          <ModelSelector
            models={models}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            temperature={runParameters.temperature}
            disabled={!hasSavedSettings}
            isLoading={isModelsLoading}
            onTemperatureChange={(value) =>
              applyRunParameterPatch({
                temperature: normalizeRunParameter("temperature", value),
              })
            }
          />
          <PresetChips onApplyPreset={applyRunParameterPatch} />
        </div>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            variant={hasSavedSettings ? "outline" : "default"}
            className="h-8 px-2 text-xs"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {hasSavedSettings ? "Connection Settings" : "Set API Key"}
          </Button>
        </div>
      </header>

      <main className="workspace-main">
        <div className="transcript-panel">
          {blockState ?? capabilityNotice ? (
            <div className="px-6 pt-4">
              <Alert
                variant={
                  blockState?.kind === "unsupported-model" ||
                    blockState?.kind === "model-error"
                    ? "destructive"
                    : "default"
                }
              >
                {blockState?.kind === "checking-capability" ||
                  blockState?.kind === "loading-models" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{(blockState ?? capabilityNotice)?.title}</AlertTitle>
                <AlertDescription>
                  {(blockState ?? capabilityNotice)?.description}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          <ChatTranscript
            messages={session.messages}
            isLoading={session.isLoading}
            onTokenClick={tokenNavigation.handleBranch}
            onRegenerateMessage={session.regenerateMessage}
            regenerableMessageId={session.regenerableMessageId}
            isRegenerateDisabled={session.isLoading || blockState !== null}
            activeCompletionMessageId={session.activeCompletionMessageId}
            showWhitespaceOverlays={showWhitespaceOverlays}
            showPunctuationOverlays={showPunctuationOverlays}
          />
          <Composer
            ref={composerRef}
            onSendMessage={session.sendMessage}
            isLoading={session.isLoading}
            isStreaming={session.isStreaming}
            canSubmit={blockState === null}
            blockedSendMessage={blockState?.description ?? null}
            onBlockedSend={() => {
              if (blockState?.kind === "missing-settings") {
                setIsSettingsOpen(true);
              }
              if (blockState) {
                toast("Cannot send request", {
                  description: blockState.description,
                });
              }
            }}
            onCancel={session.cancelStream}
            parameters={runParameters}
            onParametersChange={setRunParameters}
            showWhitespaceOverlays={showWhitespaceOverlays}
            showPunctuationOverlays={showPunctuationOverlays}
            onReadabilityChange={(patch) => {
              if (typeof patch.showWhitespace === "boolean") {
                setShowWhitespaceOverlays(patch.showWhitespace);
              }
              if (typeof patch.showPunctuation === "boolean") {
                setShowPunctuationOverlays(patch.showPunctuation);
              }
            }}
            onClearHistory={session.clearHistory}
          />
        </div>

        <AnalysisPanel
          completion={deferredCompletion}
          isLoadingChart={session.isChartPending}
          onTokenClick={(tokenIndex) => tokenNavigation.scrollToToken(tokenIndex)}
          onTokenHover={tokenNavigation.handleChartHover}
        />
      </main>
    </div>
  );
};

export default Playground;
