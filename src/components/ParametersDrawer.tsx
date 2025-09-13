import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { RunParameters } from "@/types/logprob";

interface ParametersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
  modelSupportsTopK: boolean;
}

export const ParametersDrawer = ({ 
  isOpen, 
  parameters, 
  onParametersChange, 
  modelSupportsTopK 
}: ParametersDrawerProps) => {
  const updateParameter = (key: keyof RunParameters, value: number) => {
    onParametersChange({ ...parameters, [key]: value });
  };

  if (!isOpen) return null;

  return (
    <Collapsible open={isOpen}>
      <CollapsibleContent className="border-t bg-surface/30">
        <div className="px-6 py-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Generation Parameters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature: {parameters.temperature}</Label>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={[parameters.temperature]}
                onValueChange={([value]) => updateParameter("temperature", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness. Higher = more creative, lower = more focused.
              </p>
            </div>

            {/* Top-p */}
            <div className="space-y-2">
              <Label htmlFor="top-p">Top-p: {parameters.top_p}</Label>
              <Slider
                id="top-p"
                min={0}
                max={1}
                step={0.05}
                value={[parameters.top_p]}
                onValueChange={([value]) => updateParameter("top_p", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Nucleus sampling. Controls diversity by probability mass.
              </p>
            </div>

            {/* Max tokens */}
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min={1}
                max={256}
                value={parameters.max_tokens}
                onChange={(e) => updateParameter("max_tokens", Math.min(256, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum completion length (capped at 256).
              </p>
            </div>

            {/* Top logprobs */}
            <div className="space-y-2">
              <Label htmlFor="top-logprobs">Top alternatives: {parameters.top_logprobs}</Label>
              <Slider
                id="top-logprobs"
                min={1}
                max={10}
                step={1}
                value={[parameters.top_logprobs]}
                onValueChange={([value]) => updateParameter("top_logprobs", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of alternative tokens to show (max 10).
              </p>
            </div>

            {/* Top-k */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="top-k" className={!modelSupportsTopK ? "text-muted-foreground" : ""}>
                  Top-k: {parameters.top_k || "Off"}
                </Label>
                {!modelSupportsTopK && (
                  <span className="text-xs text-muted-foreground">Not supported</span>
                )}
              </div>
              <Input
                id="top-k"
                type="number"
                min={1}
                max={100}
                value={parameters.top_k || ""}
                onChange={(e) => updateParameter("top_k", parseInt(e.target.value) || undefined)}
                disabled={!modelSupportsTopK}
                placeholder="Off"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Limits to top-k most likely tokens.
              </p>
            </div>

            {/* Presence penalty */}
            <div className="space-y-2">
              <Label htmlFor="presence-penalty">Presence penalty: {parameters.presence_penalty}</Label>
              <Slider
                id="presence-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={[parameters.presence_penalty]}
                onValueChange={([value]) => updateParameter("presence_penalty", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalizes tokens that appear in the text so far.
              </p>
            </div>

            {/* Frequency penalty */}
            <div className="space-y-2">
              <Label htmlFor="frequency-penalty">Frequency penalty: {parameters.frequency_penalty}</Label>
              <Slider
                id="frequency-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={[parameters.frequency_penalty]}
                onValueChange={([value]) => updateParameter("frequency_penalty", value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Penalizes tokens based on their frequency.
              </p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};