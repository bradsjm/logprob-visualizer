import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  getRunParameterDefinition,
  normalizeRunParameter,
} from "@/features/playground/lib/runParameters";
import type { RunParameters } from "@/types/logprob";

interface ParametersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
  onReadabilityChange?: (patch: {
    showWhitespace?: boolean;
    showPunctuation?: boolean;
  }) => void;
}

/**
 * Provides a modal drawer for editing sampling parameters and readability overlays.
 */
export const ParametersDrawer = ({
  isOpen,
  parameters,
  onParametersChange,
  onClose,
  showWhitespaceOverlays = false,
  showPunctuationOverlays = false,
  onReadabilityChange,
}: ParametersDrawerProps) => {
  const updateParameter = (key: keyof RunParameters, value: number) => {
    onParametersChange({ ...parameters, [key]: value });
  };
  const temperatureDefinition = getRunParameterDefinition("temperature");
  const topPDefinition = getRunParameterDefinition("top_p");
  const maxCompletionTokensDefinition = getRunParameterDefinition(
    "max_completion_tokens",
  );
  const topLogprobsDefinition = getRunParameterDefinition("top_logprobs");
  const presencePenaltyDefinition = getRunParameterDefinition("presence_penalty");
  const frequencyPenaltyDefinition = getRunParameterDefinition(
    "frequency_penalty",
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl bg-background">
        <DialogHeader className="relative">
          <DialogTitle>Generation Parameters</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="temperature">
                {temperatureDefinition.label}:{" "}
                {temperatureDefinition.formatValue(parameters.temperature)}
              </Label>
              <Slider
                id="temperature"
                min={temperatureDefinition.min}
                max={temperatureDefinition.max}
                step={temperatureDefinition.step}
                value={[parameters.temperature]}
                onValueChange={([value]) =>
                  updateParameter("temperature", value)
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {temperatureDefinition.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="top-p">
                {topPDefinition.label}: {topPDefinition.formatValue(parameters.top_p)}
              </Label>
              <Slider
                id="top-p"
                min={topPDefinition.min}
                max={topPDefinition.max}
                step={topPDefinition.step}
                value={[parameters.top_p]}
                onValueChange={([value]) => updateParameter("top_p", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {topPDefinition.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-completion-tokens">
                {maxCompletionTokensDefinition.label}
              </Label>
              <Input
                id="max-completion-tokens"
                type="number"
                min={maxCompletionTokensDefinition.min}
                max={maxCompletionTokensDefinition.max}
                value={parameters.max_completion_tokens}
                onChange={(e) =>
                  updateParameter(
                    "max_completion_tokens",
                    normalizeRunParameter(
                      "max_completion_tokens",
                      parseInt(e.target.value, 10) || 1,
                    ),
                  )
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {maxCompletionTokensDefinition.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="top-logprobs">
                {topLogprobsDefinition.label}:{" "}
                {topLogprobsDefinition.formatValue(parameters.top_logprobs)}
              </Label>
              <Slider
                id="top-logprobs"
                min={topLogprobsDefinition.min}
                max={topLogprobsDefinition.max}
                step={topLogprobsDefinition.step}
                value={[parameters.top_logprobs]}
                onValueChange={([value]) =>
                  updateParameter("top_logprobs", value)
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {topLogprobsDefinition.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presence-penalty">
                {presencePenaltyDefinition.label}:{" "}
                {presencePenaltyDefinition.formatValue(parameters.presence_penalty)}
              </Label>
              <Slider
                id="presence-penalty"
                min={presencePenaltyDefinition.min}
                max={presencePenaltyDefinition.max}
                step={presencePenaltyDefinition.step}
                value={[parameters.presence_penalty]}
                onValueChange={([value]) =>
                  updateParameter("presence_penalty", value)
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {presencePenaltyDefinition.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency-penalty">
                {frequencyPenaltyDefinition.label}:{" "}
                {frequencyPenaltyDefinition.formatValue(parameters.frequency_penalty)}
              </Label>
              <Slider
                id="frequency-penalty"
                min={frequencyPenaltyDefinition.min}
                max={frequencyPenaltyDefinition.max}
                step={frequencyPenaltyDefinition.step}
                value={[parameters.frequency_penalty]}
                onValueChange={([value]) =>
                  updateParameter("frequency_penalty", value)
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {frequencyPenaltyDefinition.description}
              </p>
            </div>
          </div>
          {/* Readability */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Readability</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="toggle-whitespace">
                    Show whitespace overlays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display overlays for spaces and newlines to make gaps
                    visible.
                  </p>
                </div>
                <Switch
                  id="toggle-whitespace"
                  checked={showWhitespaceOverlays}
                  onCheckedChange={(v) =>
                    onReadabilityChange?.({ showWhitespace: v })
                  }
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="toggle-punct">
                    Show punctuation overlays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display overlays for punctuation tokens (., !, ?, etc.).
                  </p>
                </div>
                <Switch
                  id="toggle-punct"
                  checked={showPunctuationOverlays}
                  onCheckedChange={(v) =>
                    onReadabilityChange?.({ showPunctuation: v })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
