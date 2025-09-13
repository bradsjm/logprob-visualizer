import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ModelInfo } from "@/types/logprob";

interface ModelSelectorProps {
  selectedModel: ModelInfo;
  onModelChange: (model: ModelInfo) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4" },
  { id: "gpt-4o-mini", name: "GPT-4 Mini" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

export const ModelSelector = ({ selectedModel, onModelChange, temperature, onTemperatureChange }: ModelSelectorProps) => {
  return (
    <div className="flex items-center gap-4">
      <Select
        value={selectedModel.id}
        onValueChange={(modelId) => {
          const model = AVAILABLE_MODELS.find(m => m.id === modelId);
          if (model) {
            onModelChange(model);
          }
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between w-full">{model.name}</div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Temperature slider (wired to RunParameters.temperature) */}
      <div className="flex items-center gap-3 min-w-[220px]">
        <Label htmlFor="header-temp" className="whitespace-nowrap text-xs text-muted-foreground">
          Temperature
        </Label>
        <div className="flex-1 max-w-[180px]">
          <Slider
            id="header-temp"
            min={0}
            max={2}
            step={0.1}
            value={[temperature]}
            onValueChange={([v]) => onTemperatureChange(v)}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{temperature.toFixed(1)}</span>
      </div>
    </div>
  );
};
