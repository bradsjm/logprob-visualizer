import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ModelInfo } from "@/types/logprob";

interface ModelSelectorProps {
  readonly models: readonly ModelInfo[];
  readonly selectedModelId: string | null;
  readonly onModelChange: (modelId: string) => void;
  readonly temperature: number;
  readonly onTemperatureChange: (value: number) => void;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
}

/**
 * Lists available models and reports selection changes for downstream generation requests.
 */
export const ModelSelector = ({
  models,
  selectedModelId,
  onModelChange,
  temperature,
  onTemperatureChange,
  disabled = false,
  isLoading = false,
}: ModelSelectorProps) => {
  return (
    <div className="flex items-center gap-4">
      <Select
        disabled={disabled || isLoading || models.length === 0}
        value={selectedModelId ?? undefined}
        onValueChange={onModelChange}
      >
        <SelectTrigger className="w-40">
          <SelectValue
            placeholder={isLoading ? "Loading models..." : "Select a model"}
          />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between w-full">
                {model.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Temperature slider (wired to RunParameters.temperature) */}
      <div className="flex items-center gap-3 min-w-[220px]">
        <Label
          htmlFor="header-temp"
          className="whitespace-nowrap text-xs text-muted-foreground"
        >
          Temperature
        </Label>
        <div className="flex-1 max-w-[180px]">
          <Slider
            id="header-temp"
            min={0}
            max={2}
            step={0.1}
            value={[temperature]}
            disabled={disabled}
            onValueChange={([v]) => onTemperatureChange(v)}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
          {temperature.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
