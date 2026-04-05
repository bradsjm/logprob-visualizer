import { KeyRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConnectionSettingsDialog } from "@/components/ConnectionSettingsDialog";
import { ModelSelector } from "@/components/ModelSelector";
import { PlaygroundWorkspace } from "@/components/PlaygroundWorkspace";
import { PresetChips } from "@/components/PresetChips";
import { Button } from "@/components/ui/button";
import { useRunParameters } from "@/features/playground/hooks/useRunParameters";
import { normalizeRunParameter } from "@/features/playground/lib/runParameters";
import type { RequestBlockState } from "@/features/playground/lib/types";
import { useConnectionSettings } from "@/hooks/useConnectionSettings";
import { useModelCapability } from "@/hooks/useModelCapability";
import { useModels } from "@/hooks/useModels";

/**
 * Main playground view combining chat, analysis, and parameter controls for logprob exploration.
 */
const Playground = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, connection, resolvedBaseUrl, hasSavedSettings, saveSettings, clearSettings } =
    useConnectionSettings();
  const { selectedModelId, setSelectedModelId, runParameters, setRunParameters, applyRunParameterPatch } =
    useRunParameters();
  const { models, isLoading: isModelsLoading, isError: isModelsError, errorMessage } =
    useModels(connection);
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  const capability = useModelCapability(connection, selectedModel?.id ?? null);

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

  return (
    <div className="flex h-screen flex-col">
      <ConnectionSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        resolvedBaseUrl={resolvedBaseUrl}
        onSave={(nextSettings) => {
          saveSettings(nextSettings);
          toast("Connection settings saved", {
            description: "Refreshing provider models.",
          });
        }}
        onClear={() => {
          clearSettings();
          setSelectedModelId(null);
          toast("Connection settings cleared");
        }}
      />
      <header className="flex items-center justify-between border-b bg-surface/50 px-6 py-4">
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
      <PlaygroundWorkspace
        key={connection.cacheKey}
        connection={connection}
        selectedModelId={selectedModel?.id ?? null}
        runParameters={runParameters}
        setRunParameters={setRunParameters}
        blockState={blockState}
        capabilityNotice={capabilityNotice}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );
};

export default Playground;
